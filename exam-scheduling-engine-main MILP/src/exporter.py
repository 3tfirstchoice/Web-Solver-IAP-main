import pandas as pd
import numpy as np

# ===========================================================================
# CÁC HÀM XÂY DỰNG SHEET DỮ LIỆU (HELPER FUNCTIONS)
# ===========================================================================

def _build_sheet_ca_thi(slots_df: pd.DataFrame) -> pd.DataFrame:
    """Sheet 1: Gom nhóm danh sách cán bộ theo từng ca thi cụ thể."""
    group_cols = [c for c in slots_df.columns if c not in ['MS_CB_Phan_Cong', 'Số lượng cán bộ cần thiết']]
    
    ca_thi_df = slots_df.groupby(group_cols, dropna=False).agg(
        Số_lượng_thực_tế=('MS_CB_Phan_Cong', 'count'),
        Danh_sách_CB_Phân_công=('MS_CB_Phan_Cong', lambda x: ', '.join(x.dropna()))
    ).reset_index()
    
    return ca_thi_df


def _build_sheet_can_bo(slots_df: pd.DataFrame, staff_df: pd.DataFrame, staff_id_col: str) -> pd.DataFrame:
    """Sheet 2: Thống kê lịch trực chi tiết cho từng cán bộ."""
    # 1. Xử lý định dạng ngày tháng an toàn
    if pd.api.types.is_datetime64_any_dtype(slots_df['Ngày']):
        date_str = slots_df['Ngày'].dt.strftime('%d/%m/%Y')
    else:
        date_str = slots_df['Ngày'].astype(str)

    # 2. Tạo chuỗi mô tả ca thi
    slots_df['Mô_tả_ca'] = slots_df['MS Ca thi'] + " (" + slots_df['Cơ sở'].astype(str) + ")"

    # 3. Gom nhóm theo mã cán bộ
    staff_shifts = slots_df.groupby('MS_CB_Phan_Cong').agg(
        Số_ca_trực=('Mô_tả_ca', 'count'),
        Danh_sách_ca=('Mô_tả_ca', lambda x: '; '.join(x))
    ).reset_index()

    # 4. Ghép với thông tin gốc của cán bộ
    can_bo_df = staff_df.merge(staff_shifts, left_on=staff_id_col, right_on='MS_CB_Phan_Cong', how='left')
    
    # 5. Xử lý người không có lịch
    can_bo_df['Số_ca_trực'] = can_bo_df['Số_ca_trực'].fillna(0).astype(int)
    can_bo_df['Danh_sách_ca'] = can_bo_df['Danh_sách_ca'].fillna("Không có lịch")
    
    # 6. Dọn dẹp cột thừa
    can_bo_df = can_bo_df.drop(columns=['MS_CB_Phan_Cong'], errors='ignore')
    can_bo_df = can_bo_df.rename(columns={'Số_ca_trực': 'Số ca trực', 'Danh_sách_ca': 'Danh sách ca'})
    
    return can_bo_df


def _build_sheet_thong_ke(ca_thi_df: pd.DataFrame, ca_counts: np.ndarray, 
                          total_assigns: int, total_staff: int) -> pd.DataFrame:
    """Sheet 3: Tính toán các chỉ số thống kê tổng thể."""
    max_ca = ca_counts.max()
    min_ca = ca_counts.min()

    stats_dict = {
        'Chỉ số': [
            'Tổng số ca thi',
            'Tổng số cán bộ',
            'Tổng số lượt phân công',
            'Trung bình ca/người',
            'Ca nhiều nhất (Max)',
            'Ca ít nhất (Min)',
            'Chênh lệch Max - Min (Gap)',
            'Độ lệch chuẩn (Std Dev)'
        ],
        'Giá trị': [
            len(ca_thi_df),
            total_staff,
            total_assigns,
            round(total_assigns / total_staff, 4),
            max_ca,
            min_ca,
            max_ca - min_ca,
            round(np.std(ca_counts.astype(float)), 4)
        ]
    }
    return pd.DataFrame(stats_dict)


# ===========================================================================
# HÀM XUẤT FILE CHÍNH (GỌI TỪ FILE MAIN / WRAPPER)
# ===========================================================================
def export_results(best_chromosome: np.ndarray, slots_df: pd.DataFrame, 
                   staff_df: pd.DataFrame, output_file: str) -> None:
    """
    Điểm vào chính: Nhận kết quả từ thuật toán và xuất ra file Excel gồm đúng 3 Sheets.
    Tự động xử lý ngoại lệ nếu file Excel đích đang bị mở bởi người dùng.
    """
    print(f"[EXPORT] Bắt đầu quá trình xuất file kết quả: {output_file}")

    # ==========================================================================
    # CƠ CHẾ ĐỒNG BỘ TIÊU ĐỀ CỘT CHỐT DÙNG 'Mã cán bộ'
    # ==========================================================================
    # Tự động tìm kiếm cột định danh cán bộ thực tế hiện có trong DataFrame
    detected_staff_col = None
    for col in staff_df.columns:
        if col in ['Mã cán bộ', 'MS của CÁN BỘ COI THI', 'Mã số cán bộ', 'MSCB']:
            detected_staff_col = col
            break
            
    # Nếu không tìm thấy theo danh sách chuẩn, bốc cột đầu tiên làm cột ID
    if not detected_staff_col and len(staff_df.columns) > 0:
        detected_staff_col = staff_df.columns[0]

    # Thực hiện nhân bản đồng bộ song song cả 2 tên cột để phục vụ các hàm helper phía dưới
    if detected_staff_col:
        staff_df['Mã cán bộ'] = staff_df[detected_staff_col]
        staff_df['MS của CÁN BỘ COI THI'] = staff_df[detected_staff_col]

    # Đồng bộ hóa mã ca thi cho slots_df
    if 'Mã ca thi' in slots_df.columns:
        slots_df['MS Ca thi'] = slots_df['Mã ca thi']
    elif 'MS Ca thi' in slots_df.columns and 'Mã ca thi' not in slots_df.columns:
        slots_df['Mã ca thi'] = slots_df['MS Ca thi']
        
    if 'MS Ca thi' not in slots_df.columns and len(slots_df.columns) > 0:
        slots_df['MS Ca thi'] = slots_df.columns[0]

    # Chốt biến đại diện dùng chung tên cột sạch
    staff_id_col = 'Mã cán bộ'
    staff_ids = staff_df[staff_id_col].values
    
    # Bản sao an toàn để xử lý dữ liệu xuất file
    working_slots_df = slots_df.copy()
    working_slots_df['MS_CB_Phan_Cong'] = staff_ids[best_chromosome]

    # ==========================================================================
    # XÂY DỰNG 3 DATAFRAMES CHO CÁC SHEETS (Sử dụng hàm Helper nội bộ)
    # ==========================================================================
    df_ca_thi   = _build_sheet_ca_thi(working_slots_df)
    df_can_bo   = _build_sheet_can_bo(working_slots_df, staff_df, 'MS của CÁN BỘ COI THI')
    ca_counts   = df_can_bo['Số ca trực'].values
    df_thong_ke = _build_sheet_thong_ke(df_ca_thi, ca_counts, len(working_slots_df), len(staff_df))

    # Chuẩn hóa định dạng cột Ngày sang dạng date thuần (bỏ phần giờ 00:00:00 nếu có)
    if 'Ngày' in df_ca_thi.columns and pd.api.types.is_datetime64_any_dtype(df_ca_thi['Ngày']):
        df_ca_thi['Ngày'] = df_ca_thi['Ngày'].dt.date

    # ==========================================================================
    # GHI DỮ LIỆU RA EXCEL FILE (CÓ CƠ CHẾ DỰ PHÒNG CHỐNG KHÓA FILE)
    # ==========================================================================
    try:
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df_ca_thi.to_excel(writer, sheet_name='Ca Thi', index=False)
            df_can_bo.to_excel(writer, sheet_name='Cán bộ', index=False)
            df_thong_ke.to_excel(writer, sheet_name='Tổng quan thống kê', index=False)
        print(f"[EXPORT] Xuất file Excel thành công mỹ mãn! Định vị tại: {output_file}")
        
    except PermissionError:
        # Nếu file gốc đang bị người dùng mở, tự động sinh tên file dự phòng kèm timestamp
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        alternative_file = output_file.replace(".xlsx", f"_{timestamp}.xlsx")
        
        print(f"[EXPORT - WARNING] File gốc đang bị khóa do đang mở! Tự động lưu dự phòng sang file mới: {alternative_file}")
        
        with pd.ExcelWriter(alternative_file, engine='openpyxl') as writer:
            df_ca_thi.to_excel(writer, sheet_name='Kết quả phân ca', index=False)
            df_can_bo.to_excel(writer, sheet_name='Thống kê cán bộ', index=False)
            df_thong_ke.to_excel(writer, sheet_name='Tổng quan thống kê', index=False)
            
        print(f"[EXPORT] Hệ thống đã cứu nguy! Xuất file thay thế thành công.")

    except Exception as e:
        print(f"[EXPORT - ERROR] Không thể ghi dữ liệu ra file Excel: {e}")
        raise e


def export_to_excel(model, staff_df, shift_df, output_file=None):
    """Xuất kết quả ILP ra Excel (dùng bởi main.py)."""
    import config
    from .model import _solution_to_chromosome
    from .loader import build_flattened_slots, prepare_shift_df

    output_file = output_file or config.OUTPUT_SCHEDULE_FILE
    if model.solution is None or model.solution.empty:
        print("[EXPORT] No solution to export")
        return output_file

    shift_df = prepare_shift_df(shift_df)
    flattened_slots = build_flattened_slots(shift_df)
    best_chromosome = _solution_to_chromosome(model.solution, staff_df, flattened_slots)
    export_results(best_chromosome, flattened_slots, staff_df, output_file)
    return output_file