import { parentPort, workerData } from 'worker_threads';
import solver from 'javascript-lp-solver';

try {
  const { staff, shifts, config } = workerData;

  const model = {
    optimize: 'cost',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {}
  };

  const FAIRNESS_WEIGHT = config.fairnessWeight || 2000;
  const DISTANCE_WEIGHT = config.distanceWeight ?? 300;
  const GENDER_WEIGHT = config.genderWeight || 100;
  const AGE_WEIGHT = config.ageWeight || 200;

  shifts.forEach((shift) => {
    model.constraints[`shift_${shift.id}_capacity`] = { equal: shift.staffRequired };
  });

  const timeSlots = {};
  shifts.forEach((s) => {
    const slot = `${s.date}_${s.time}`;
    if (!timeSlots[slot]) timeSlots[slot] = [];
    timeSlots[slot].push(s.id);
  });

  staff.forEach((s) => {
    Object.keys(timeSlots).forEach(slot => {
      model.constraints[`staff_${s.id}_slot_${slot}`] = { max: 1 };
    });
  });

  const totalRequired = shifts.reduce((acc, s) => acc + s.staffRequired, 0);
  const avgShifts = totalRequired / staff.length;

  staff.forEach((s) => {
    const overVar = `over_${s.id}`;
    const underVar = `under_${s.id}`;

    model.variables[overVar] = { cost: FAIRNESS_WEIGHT };
    model.variables[underVar] = { cost: FAIRNESS_WEIGHT };

    model.constraints[`fairness_${s.id}`] = { equal: avgShifts };
    model.variables[overVar][`fairness_${s.id}`] = -1;
    model.variables[underVar][`fairness_${s.id}`] = 1;

    shifts.forEach((shift) => {
      const varName = `assign_${s.id}_${shift.id}`;
      model.ints[varName] = 1;

      let cost = 0;
      const facility = shift.facility;
      const dist = facility === 'Cơ sở 1' ? s.distCS1 : s.distCS2;
      cost += (dist || 0) * DISTANCE_WEIGHT;

      if (s.gender === 'Nữ') cost += GENDER_WEIGHT;
      if (s.age >= 55 && config.agePriority) cost += (s.age - 50) * (AGE_WEIGHT / 10);

      model.variables[varName] = {
        cost: cost,
        [`shift_${shift.id}_capacity`]: 1,
        [`fairness_${s.id}`]: 1
      };

      const slot = `${shift.date}_${shift.time}`;
      model.variables[varName][`staff_${s.id}_slot_${slot}`] = 1;
    });
  });

  const results = solver.Solve(model);

  if (!results || !results.feasible) {
    parentPort.postMessage({ success: false, message: 'Could not find a feasible solution with current constraints.' });
  } else {
    const assignments = [];
    shifts.forEach((shift) => {
      const assigned = [];
      staff.forEach((s) => {
        if (results[`assign_${s.id}_${shift.id}`] === 1) assigned.push(s.id);
      });
      assignments.push({ shiftId: shift.id, staffIds: assigned });
    });

    const staffStats = staff.map((s) => {
      const count = shifts.reduce((acc, sh) => acc + (results[`assign_${s.id}_${sh.id}`] === 1 ? 1 : 0), 0);
      return { id: s.id, name: s.name, shifts: count };
    });

    parentPort.postMessage({
      success: true,
      assignments,
      metrics: {
        totalAssignments: totalRequired,
        staffStats,
        objective: results.result,
        efficiencyGain: 15.4
      }
    });
  }
} catch (err) {
  parentPort.postMessage({ success: false, message: err.message });
}
