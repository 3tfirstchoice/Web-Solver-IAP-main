# src/model.py
from collections import defaultdict, deque

import numpy as np
import pandas as pd
from pulp import LpProblem, LpMinimize, LpVariable, LpStatus, value, PULP_CBC_CMD

from .constraints import add_hard_constraints, add_objective, _staff_distance, _normalize_facility
from .loader import prepare_shift_df, prepare_staff_df, build_flattened_slots


class ExamSchedulerModel:
    def __init__(self, staff_df, shift_df):
        self.staff_df = staff_df
        self.shift_df = shift_df
        self.prob = None
        self.assignment_vars = {}
        self.solution = None

    def create_model(self):
        self.prob = LpProblem("Exam_Scheduling_ILP", LpMinimize)
        self._create_variables()
        add_hard_constraints(self.prob, self.assignment_vars, self.staff_df, self.shift_df)
        add_objective(self.prob, self.assignment_vars, self.staff_df, self.shift_df)
        print(f"[OK] Model created with {len(self.assignment_vars)} staff variables")
        return self.prob

    def _create_variables(self):
        staff_col = "MS của CÁN BỘ COI THI"
        for cb in self.staff_df[staff_col]:
            self.assignment_vars[cb] = {
                ca: LpVariable(f"assign_{cb}_{ca}", cat="Binary")
                for ca in self.shift_df["UNIQUE_KEY"]
            }

    def solve(self, time_limit=None):
        import config

        gap = getattr(config, "GAP_REL", 0.05)

        print("[INFO] Solving with CBC solver...")
        if time_limit is not None:
            solver = PULP_CBC_CMD(msg=1, timeLimit=time_limit, gapRel=gap)
        else:
            solver = PULP_CBC_CMD(msg=1, gapRel=gap)

        status = self.prob.solve(solver)
        status_name = LpStatus.get(self.prob.status, str(self.prob.status))
        print(f"[OK] Status: {status_name}")
        return status

    def extract_solution(self):
        if not self.prob or value(self.prob.objective) is None:
            print("[WARN] Model not solved yet")
            return None

        data = []
        staff_col = "MS của CÁN BỘ COI THI"
        for cb in self.assignment_vars:
            for ca, var in self.assignment_vars[cb].items():
                if value(var) > 0.5:
                    data.append(
                        {
                            staff_col: cb,
                            "UNIQUE_KEY": ca,
                            "Assigned": 1,
                        }
                    )

        self.solution = pd.DataFrame(data)
        print(f"[INFO] Extracted {len(self.solution)} assignments")
        return self.solution

    def get_summary_stats(self):
        if self.solution is None or self.solution.empty:
            return {
                "total_assignments": 0,
                "total_shifts": 0,
                "total_staff": 0,
                "average_staff_per_shift": 0.0,
                "max_shifts_per_staff": 0,
                "min_shifts_per_staff": 0,
                "avg_shifts_per_staff": 0.0,
                "std_shifts_per_staff": 0.0,
                "diff_max_min": 0,
            }
        staff_col = "MS của CÁN BỘ COI THI"
        counts = self.solution.groupby(staff_col).size()
        return {
            "total_assignments": int(len(self.solution)),
            "total_shifts": int(len(self.shift_df)),
            "total_staff": int(len(self.staff_df)),
            "average_staff_per_shift": float(len(self.solution) / len(self.shift_df)) if len(self.shift_df) else 0.0,
            "max_shifts_per_staff": int(counts.max()),
            "min_shifts_per_staff": int(counts.min()),
            "avg_shifts_per_staff": float(counts.mean()),
            "std_shifts_per_staff": float(counts.std()),
            "diff_max_min": int(counts.max()) - int(counts.min()),
        }

    def get_penalty_breakdown(self):
        if self.solution is None or self.solution.empty:
            return {
                'fairness': 0.0,
                'minShift': 0.0,
                'distance': 0.0,
            }

        config = __import__("config")
        staff_col = "MS của CÁN BỘ COI THI"
        shift_lookup = self.shift_df.set_index("UNIQUE_KEY")
        staff_lookup = self.staff_df.set_index(staff_col)

        total_slots = int(self.shift_df["Số lượng cán bộ cần thiết"].sum())
        num_staff = len(self.staff_df)
        avg_shifts = total_slots / num_staff if num_staff else 0

        assignment_set = {
            (str(row[staff_col]), str(row["UNIQUE_KEY"]))
            for _, row in self.solution.iterrows()
        }

        fairness = 0.0
        distance = 0.0
        min_shift = 0.0
        age_priority = 0.0
        facility_conflict = 0.0
        rest_gap = 0.0

        staff_by_date = {}
        staff_total_distance = {}

        for cb in self.staff_df[staff_col]:
            assigned_count = 0
            staff_by_date[cb] = {}
            staff_row = staff_lookup.loc[cb]
            age = int(staff_row.get("Tuổi", 0))

            staff_distance = 0.0
            for ca in shift_lookup.index:
                if (cb, ca) not in assignment_set:
                    continue

                assigned_count += 1
                shift_row = shift_lookup.loc[ca]
                facility = _normalize_facility(shift_row.get("Cơ sở", ""))
                date_time = str(shift_row.get("MS Ca thi", ""))
                if "_" in date_time:
                    date_str, time_str = date_time.split("_", 1)
                    try:
                        time_code = int(time_str)
                    except ValueError:
                        time_code = 0
                else:
                    date_str = date_time
                    time_code = 0

                shift_distance = _staff_distance(staff_row, shift_row.get("Cơ sở", ""))
                staff_distance += shift_distance
                distance += config.DISTANCE_WEIGHT * (float(shift_distance)/10.0)

                if age >= config.AGE_THRESHOLD:
                    age_priority += config.WEIGHT_AGE_PRIORITY * max(0, age - config.AGE_THRESHOLD)


                staff_by_date[cb].setdefault(date_str, []).append((time_code, facility))

            if assigned_count == 0:
                min_shift += config.WEIGHT_MIN_SHIFT

            staff_total_distance[cb] = staff_distance
            fairness += abs(assigned_count - avg_shifts) * config.FAIRNESS_WEIGHT

        # if staff_total_distance:
        #     avg_distance = sum(staff_total_distance.values()) / len(staff_total_distance)
        #     distance_fairness = config.WEIGHT_DISTANCE_FAIRNESS * sum(
        #         abs(dist - avg_distance)
        #         for dist in staff_total_distance.values()
        #     )  # (DEPRECATED - removed from objective)

        for cb, date_map in staff_by_date.items():
            for _, entries in date_map.items():
                facilities = {fac for _, fac in entries if fac}
                if len(facilities) > 1:
                    facility_conflict += config.WEIGHT_SAME_DAY_DIFF_FACILITY

                entries.sort()
                for i in range(len(entries) - 1):
                    t1, _ = entries[i]
                    for t2, _ in entries[i + 1:]:
                        gap = t2 - t1
                        if gap > 2:
                            break
                        rest_gap += config.WEIGHT_CLOSE_SHIFT

        return {
            'fairness': float(fairness),
            'minShift': float(min_shift),
            'distance': float(distance),
            # 'distanceFairness': float(distance_fairness),  # (DEPRECATED)
            'facilityConflict': float(facility_conflict),
            'restGap': float(rest_gap),
            'agePriority': float(age_priority),
        }


def _solution_to_chromosome(solution, staff_df, flattened_slots):
    staff_col = "MS của CÁN BỘ COI THI"
    staff_ids = staff_df["Mã cán bộ"].astype(str).tolist()
    staff_idx_map = {sid: i for i, sid in enumerate(staff_ids)}

    if staff_col in staff_df.columns:
        id_to_ma = dict(
            zip(
                staff_df[staff_col].astype(str),
                staff_df["Mã cán bộ"].astype(str),
            )
        )
    else:
        id_to_ma = {sid: sid for sid in staff_ids}

    key_slots = defaultdict(deque)
    key_col = "UNIQUE_KEY" if "UNIQUE_KEY" in flattened_slots.columns else "MS Ca thi"
    for idx, row in flattened_slots.iterrows():
        key_slots[str(row[key_col])].append(idx)

    best_assignments = [-1] * len(flattened_slots)
    for _, sol in solution.iterrows():
        cb = str(sol[staff_col])
        ca = str(sol["UNIQUE_KEY"])
        ma_cb = id_to_ma.get(cb, cb)
        if ma_cb not in staff_idx_map:
            continue
        if key_slots[ca]:
            slot_i = key_slots[ca].popleft()
            best_assignments[slot_i] = staff_idx_map[ma_cb]

    unfilled = best_assignments.count(-1)
    if unfilled:
        raise RuntimeError(f"Incomplete ILP assignment: {unfilled} slots unfilled")
    return np.array(best_assignments, dtype=int)


def run_ilp_scheduler(shift_df, staff_df, time_limit=None):
    """Entry point for backend_wrapper (replaces run_nsga2_scheduler)."""
    import config

    shift_df = prepare_shift_df(shift_df.copy())
    staff_df = prepare_staff_df(staff_df.copy())
    flattened_slots = build_flattened_slots(shift_df)

    model = ExamSchedulerModel(staff_df, shift_df)
    model.create_model()
    tl = time_limit if time_limit is not None else getattr(config, "TIME_LIMIT", None)
    model.solve(time_limit=tl)

    solution = model.extract_solution()
    if solution is None or solution.empty:
        raise RuntimeError("ILP solver produced no assignments")

    metrics = model.get_summary_stats()
    metrics['penalties'] = model.get_penalty_breakdown()

    best_assignments = _solution_to_chromosome(solution, staff_df, flattened_slots)
    return best_assignments, flattened_slots, metrics


# Backward-compatible alias expected by old wrapper imports
run_nsga2_scheduler = run_ilp_scheduler
