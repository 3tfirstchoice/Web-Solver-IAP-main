# main.py
import pandas as pd
import config
from src.loader import load_staff_data, load_shift_data, validate_data
from src.model import ExamSchedulerModel
from src.exporter import export_to_excel


def main():
    print("="*60)
    print("EXAM SCHEDULING SOLVER - INTEGER LINEAR PROGRAMMING")
    print("="*60)

    # 1. Load dữ liệu
    print("\nLoading data...")
    staff_df = load_staff_data(config.INPUT_STAFF_FILE)
    shift_df = load_shift_data(config.INPUT_SHIFT_FILE)

    print(f"   - Staff: {len(staff_df)}")
    print(f"   - Shifts: {len(shift_df)}")

    # 2. Kiểm tra dữ liệu
    validate_data(staff_df, shift_df)

    # 3. Khởi tạo và xây dựng mô hình ILP
    print("\nBuilding ILP model...")
    model = ExamSchedulerModel(staff_df, shift_df)
    model.create_model()

    # 4. Giải mô hình
    print("\nSolving problem...")
    status = model.solve(time_limit=config.TIME_LIMIT)

    # 5. Trích xuất kết quả
    from pulp import LpStatus
    if LpStatus[model.prob.status] == "Optimal":
        model.extract_solution()
        
        # 6. Xuất file Excel
        output_file = export_to_excel(model, staff_df, shift_df)
        
        # 7. In thống kê
        stats = model.get_summary_stats()
        print("\n" + "="*60)
        print("RESULT STATISTICS")
        print("="*60)
        print(f"Total assignments: {stats['total_assignments']}")
        print(f"Avg shifts/staff: {stats['avg_shifts_per_staff']}")
        print(f"Max shifts: {stats['max_shifts_per_staff']}")
        print(f"Min shifts: {stats['min_shifts_per_staff']}")
        print(f"Gap (Max-Min): {stats['max_shifts_per_staff'] - stats['min_shifts_per_staff']}")
        print(f"Output file: {output_file}")
        print("="*60)
        
    else:
        print("ERROR: No optimal solution found or timeout exceeded.")

    print("\nDone!")


if __name__ == "__main__":
    main()