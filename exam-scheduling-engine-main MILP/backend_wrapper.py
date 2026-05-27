"""
backend_wrapper.py
==================
Wrapper tự động nhận diện thư mục chạy giải thuật ILP 
và cập nhật cấu hình dữ liệu mới từ Frontend, sử dụng tên cột đồng bộ rút gọn.
Đã cô lập luồng stdout sạch để Node.js parse JSON không bao giờ bị lỗi.
"""
import sys
import os
import json
import pandas as pd
from collections import defaultdict

def main():
    # 🌟 KỸ THUẬT CÔ LẬP LUỒNG: Giữ lại stdout gốc để nhả dữ liệu JSON cuối cùng
    original_stdout = sys.stdout
    # Ép tất cả các lệnh print() thông thường của hệ thống và module import đi qua luồng stderr
    sys.stdout = sys.stderr

    # 1. TỰ ĐỘNG XÁC ĐỊNH THƯ MỤC BACKEND NGAY TẠI VỊ TRÍ FILE NÀY
    CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
    backend_root = CURRENT_DIR

    # Add backend root to Python path so we can import 'config' and 'src'
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)

    print(f"[WRAPPER] Thư mục hoạt động backend: {backend_root}")

    # Read JSON overrides from stdin (if any)
    stdin_data = ''
    try:
        stdin_data = sys.stdin.read()
    except Exception:
        stdin_data = ''

    overrides = {}
    if stdin_data and stdin_data.strip():
        try:
            overrides = json.loads(stdin_data)
        except Exception as e:
            print(f"[wrapper] Failed to parse JSON from stdin: {e}")

    # Safely import the backend config module
    try:
        import config
    except ImportError as e:
        print(f"[wrapper] Failed to import 'config' from backend-root '{backend_root}': {e}")
        sys.exit(10)

    # ==========================================================================
    # CƠ CHẾ ÉP BUỘC TỰ ĐỘNG: ƯU TIÊN FILE DỮ LIỆU MỚI DO FRONTEND IMPORT
    # ==========================================================================
    staff_candidates = [
        os.path.join(config.DATA_DIR, "can_bo_new.csv"),
        os.path.join(config.DATA_DIR, "can_bo_new.xlsx"),
        os.path.join(config.DATA_DIR, "can_bo.csv"),
        os.path.join(config.DATA_DIR, "can_bo.xlsx"),
        config.INPUT_STAFF_FILE,
    ]
    shift_candidates = [
        os.path.join(config.DATA_DIR, "ca_thi_new.csv"),
        os.path.join(config.DATA_DIR, "ca_thi_new.xlsx"),
        os.path.join(config.DATA_DIR, "ca_thi.csv"),
        os.path.join(config.DATA_DIR, "ca_thi.xlsx"),
        config.INPUT_SHIFT_FILE,
    ]

    selected_staff = next((p for p in staff_candidates if os.path.exists(p)), None)
    selected_shift = next((p for p in shift_candidates if os.path.exists(p)), None)

    if selected_staff:
        config.INPUT_STAFF_FILE = selected_staff
        print(f"[wrapper - FORCE] Đã phát hiện và ép nạp file cán bộ: {selected_staff}")
    else:
        print(f"[wrapper - WARN] Không tìm thấy file cán bộ mới hoặc mặc định. Sử dụng cấu hình hiện tại: {config.INPUT_STAFF_FILE}")

    if selected_shift:
        config.INPUT_SHIFT_FILE = selected_shift
        print(f"[wrapper - FORCE] Đã phát hiện và ép nạp file ca thi: {selected_shift}")
    else:
        print(f"[wrapper - WARN] Không tìm thấy file ca thi mới hoặc mặc định. Sử dụng cấu hình hiện tại: {config.INPUT_SHIFT_FILE}")
    if "config" in overrides:
        ui_config = overrides["config"]
        mapping = {
            "fairnessWeight": "FAIRNESS_WEIGHT",
            "distanceWeight": "DISTANCE_WEIGHT",
            # "distanceFairnessWeight": "DISTANCE_FAIRNESS_WEIGHT",  # (DEPRECATED)
            "genderWeight": "SAME_DAY_DIFF_FACILITY_WEIGHT",
            "ageWeight": "FAIRNESS_WEIGHT",
            "agePriority": "WEIGHT_AGE_PRIORITY",
            "closeShiftWeight": "WEIGHT_CLOSE_SHIFT",
            "sameDayDiffFacilityWeight": "WEIGHT_SAME_DAY_DIFF_FACILITY",
            "minShiftWeight": "WEIGHT_MIN_SHIFT",
            "weekendWeight": "WEEKEND_WEIGHT"
        }
        alias_mapping = {
            "fairnessWeight": "WEIGHT_FAIRNESS",
            "distanceWeight": "WEIGHT_DISTANCE",
            # "distanceFairnessWeight": "WEIGHT_DISTANCE_FAIRNESS",  # (DEPRECATED)
            "ageWeight": "WEIGHT_FAIRNESS",
            "agePriority": "AGE_WEIGHT",
            "sameDayDiffFacilityWeight": "WEIGHT_SAME_DAY_DIFF_FACILITY",
            "weekendWeight": "WEIGHT_WEEKEND"
        }
        for ui_key, backend_key in mapping.items():
            if ui_key in ui_config:
                try:
                    if ui_key == "agePriority":
                        value = 3.0 if bool(ui_config[ui_key]) else 0.0
                    else:
                        value = float(ui_config[ui_key])
                    setattr(config, backend_key, value)
                    if ui_key in alias_mapping:
                        setattr(config, alias_mapping[ui_key], value)
                    print(f"[wrapper] Overrode config.{backend_key} = {value}")
                except Exception as e:
                    print(f"[wrapper] Failed to set config.{backend_key}: {e}")

    # Now import backend modules and execute main flow
    try:
        from src.loader import load_data
        from src.model import run_ilp_scheduler
        from src.exporter import export_results
    except Exception as e:
        print(f"[wrapper] Failed to import backend modules: {e}")
        raise

    print("=" * 60)
    print("[WRAPPER] Running backend with runtime config overrides")
    print("=" * 60)
    print(f"[wrapper] Using INPUT_SHIFT_FILE={config.INPUT_SHIFT_FILE}")
    print(f"[wrapper] Using INPUT_STAFF_FILE={config.INPUT_STAFF_FILE}")

    try:
        # Load data from the paths specified in config
        shift_df, staff_df = load_data(config.INPUT_SHIFT_FILE, config.INPUT_STAFF_FILE)
        
        # Execute ILP core optimization
        print(f"[wrapper] shift_df columns: {list(shift_df.columns)}")
        print(f"[wrapper] staff_df columns: {list(staff_df.columns)}")
        best_assignments, flattened_slots, runtime_metrics = run_ilp_scheduler(shift_df, staff_df)
        
        # Export the final optimal schedule to the output Excel file
        export_results(best_assignments, flattened_slots, staff_df, config.OUTPUT_SCHEDULE_FILE)

        # 🌟 ĐÓNG GÓI JSON SỬ DỤNG TÊN CỘT ĐỒNG BỘ GỌN GÀNG ĐỂ TRẢ VỀ CHO FRONTEND
        staff_ids = staff_df['Mã cán bộ'].astype(str).tolist()
        
        if pd.api.types.is_datetime64_any_dtype(flattened_slots['Ngày']):
            date_strings = flattened_slots['Ngày'].dt.strftime('%d/%m/%Y').astype(str).tolist()
        else:
            date_strings = flattened_slots['Ngày'].astype(str).tolist()
            
        ca_strings = flattened_slots['Ca thi'].astype(str).tolist()
        cs_strings = flattened_slots['Cơ sở'].astype(str).tolist()

        assignment_map = defaultdict(list)
        for slot_index, staff_index in enumerate(best_assignments):
            # Tái tạo chính xác chuỗi kết hợp truyền thống làm ID ca thi đẩy sang kết quả JSON
            full_shift_string = f"{date_strings[slot_index]} - {ca_strings[slot_index]} ({cs_strings[slot_index]})"
            assignment_map[full_shift_string].append(str(staff_ids[staff_index]))

        output_data = {
            'success': True,
            'assignments': [
                {'shiftId': shift_id, 'staffIds': staff_list, 'staffNames': staff_list}
                for shift_id, staff_list in assignment_map.items()
            ],
            'metrics': {
                'totalShifts': len(assignment_map),
                'totalAssignments': int(len(best_assignments)),
                'totalStaff': int(len(staff_ids)),
                'avg_shifts_per_staff': runtime_metrics.get('avg_shifts_per_staff') if runtime_metrics else None,
                'max_shifts_per_staff': runtime_metrics.get('max_shifts_per_staff') if runtime_metrics else None,
                'min_shifts_per_staff': runtime_metrics.get('min_shifts_per_staff') if runtime_metrics else None,
                'penalties': runtime_metrics.get('penalties', {}) if runtime_metrics else {}
            }
        }

        # JSON sạch cho Node.js (ghi cả stdout gốc và stderr — Windows có thể gộp luồng)
        json_payload = json.dumps(output_data, ensure_ascii=False)
        for stream in (original_stdout, sys.stderr):
            stream.write(json_payload + "\n")
            stream.flush()

        print("\n[WRAPPER] PROCESS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    except Exception as e:
        print(f"\n[WRAPPER] Critical error during execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
    