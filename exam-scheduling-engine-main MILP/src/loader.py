import pandas as pd
import os

def clean_column_names(df):
    """
    Chuẩn hóa tên cột thông minh: Khử hoàn toàn dấu tiếng Việt và khoảng trắng 
    để dò tìm chính xác bất chấp lỗi font mã hóa hệ thống, bảo toàn độc lập giữa ID cán bộ và ID ca thi.
    """
    mapping = {}
    for col in df.columns:
        c = str(col).lower().strip()
        
        # Bảng mã khử dấu Tiếng Việt thô chống lỗi so khớp chuỗi
        replacements = {
            'á':'a','à':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a','â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
            'é':'e','è':'e','ẻ':'e','ẽ':'e','ẹ':'e','ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
            'í':'i','ì':'i','ỉ':'i','ĩ':'i','ị':'i',
            'ó':'o','ò':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o','ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
            'ú':'u','ù':'u','ủ':'u','ũ':'u','ụ':'u','ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
            'ý':'y','ỳ':'y','ỷ':'y','ỹ':'y','ỵ':'y',
            'đ':'d'
        }
        c_unaccented = c
        for k, v in replacements.items():
            c_unaccented = c_unaccented.replace(k, v)
        
        # 1. Kiểm tra các cột khoảng cách địa lý
        if 'khoang cach' in c_unaccented or 'dist' in c_unaccented:
            if 'cs1' in c_unaccented or '1' in c_unaccented: mapping[col] = 'Khoảng cách đến CS1'
            elif 'cs2' in c_unaccented or '2' in c_unaccented: mapping[col] = 'Khoảng cách đến CS2'
            continue
        if 'cs1' in c_unaccented:
            mapping[col] = 'Khoảng cách đến CS1'
            continue
        if 'cs2' in c_unaccented:
            mapping[col] = 'Khoảng cách đến CS2'
            continue

        # 2. Kiểm tra cột số lượng cán bộ yêu cầu
        if 'so luong' in c_unaccented or 'thiet' in c_unaccented:
            if 'can bo' in c_unaccented or 'cb' in c_unaccented:
                mapping[col] = 'Số lượng cán bộ cần thiết'
                continue

        # 0. Cột cơ sở — xử lý trước rule chung (tránh nhầm với mô tả ca thi)
        if (
            c_unaccented in ('facility', 'coso', 'cs', 'co so')
            or 'co so' in c_unaccented
            or (c_unaccented.startswith('co') and 'so' in c_unaccented)
        ):
            mapping[col] = 'Cơ sở'
            continue

        # 3a. Mã ca thi dạng ID (MS Ca thi) — tách khỏi mô tả ca
        if 'ms ca thi' in c_unaccented or c_unaccented == 'ms ca thi':
            mapping[col] = 'MS Ca thi'
            continue

        # 3. Phân loại cột ID cốt lõi (Mã cán bộ / Mã ca thi) dựa trên chuỗi đã khử dấu
        if 'ma' in c_unaccented or 'ms' in c_unaccented or 'id' in c_unaccented:
            if 'can bo' in c_unaccented or 'cb' in c_unaccented or 'coi thi' in c_unaccented:
                mapping[col] = 'Mã cán bộ'
                continue
            elif 'ca thi' in c_unaccented:
                mapping[col] = 'Mã ca thi'
                continue

        # 4. Bảo toàn cột "Ca thi" thô dạng mô tả chuỗi thời gian
        if 'ca thi' in c_unaccented:
            if 'can bo' not in c_unaccented and 'coi thi' not in c_unaccented:
                mapping[col] = 'Ca thi'
                continue
            else:
                mapping[col] = 'Mã cán bộ'
                continue

        # 5. Các cột thông tin cơ bản khác
        if 'tuoi' in c_unaccented: 
            mapping[col] = 'Tuổi'
        elif 'gioi tinh' in c_unaccented or 'gender' in c_unaccented: 
            mapping[col] = 'Giới tính'
    
    return df.rename(columns=mapping)

def load_data(shift_path, staff_path):
    """
    Loads shift and staff data from Excel or CSV files with smart column auto-fixing.
    """
    try:
        # --- ĐỌC FILE CA THI ---
        if shift_path.endswith('.xlsx') or shift_path.endswith('.xls'):
            shift_df = pd.read_excel(shift_path)
        else:
            shift_df = pd.read_csv(shift_path, encoding='utf-8-sig')

        # --- ĐỌC FILE CÁN BỘ ---
        if staff_path.endswith('.xlsx') or staff_path.endswith('.xls'):
            staff_df = pd.read_excel(staff_path)
        else:
            staff_df = pd.read_csv(staff_path, encoding='utf-8-sig')

        shift_df = shift_df.loc[:, ~shift_df.columns.duplicated()].copy()
        staff_df = staff_df.loc[:, ~staff_df.columns.duplicated()].copy()

        # --- ĐÁNH GIÁ SƠ BỘ VỀ NHẦM LẪN FILE SHIFT/STAFF ---
        if 'Mã ca thi' in staff_df.columns and ('Mã cán bộ' in shift_df.columns or 'MS của CÁN BỘ COI THI' in shift_df.columns):
            print(f"[WARN] staff_df có cột ca thi. Hoán đổi shift_df và staff_df để xử lý.")
            shift_df, staff_df = staff_df, shift_df

        # --- ĐẢM BẢO CÓ ĐỦ CỘT KHÔNG BỊ CRASH ---
        if 'Số lượng cán bộ cần thiết' not in shift_df.columns:
            shift_df['Số lượng cán bộ cần thiết'] = 2
        if 'Tuổi' not in staff_df.columns: staff_df['Tuổi'] = 40
        if 'Khoảng cách đến CS1' not in staff_df.columns: staff_df['Khoảng cách đến CS1'] = 0.0
        if 'Khoảng cách đến CS2' not in staff_df.columns: staff_df['Khoảng cách đến CS2'] = 0.0

        # --- CHUẨN HÓA KIỂU DỮ LIỆU CỘT VẬT LÝ ---
        shift_df['Số lượng cán bộ cần thiết'] = pd.to_numeric(shift_df['Số lượng cán bộ cần thiết'], errors='coerce').fillna(2).astype(int)
        staff_df['Tuổi'] = pd.to_numeric(staff_df['Tuổi'], errors='coerce').fillna(40).astype(int)
        staff_df['Khoảng cách đến CS1'] = pd.to_numeric(staff_df['Khoảng cách đến CS1'], errors='coerce').fillna(0.0)
        staff_df['Khoảng cách đến CS2'] = pd.to_numeric(staff_df['Khoảng cách đến CS2'], errors='coerce').fillna(0.0)

        # Định dạng chuỗi văn bản sạch cho các ID cốt lõi
        if 'Mã cán bộ' in staff_df.columns:
            staff_df['Mã cán bộ'] = staff_df['Mã cán bộ'].astype(str).str.strip()
        if 'Mã ca thi' in shift_df.columns:
            shift_df['Mã ca thi'] = shift_df['Mã ca thi'].astype(str).str.strip()

        shift_df = prepare_shift_df(shift_df)
        staff_df = prepare_staff_df(staff_df)

        print(f"[INFO] Data loaded successfully: {len(shift_df)} shifts, {len(staff_df)} staff members.")
        return shift_df, staff_df

    except Exception as e:
        err_msg = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"[ERROR] Failed to read data files. Loi: {err_msg}")
        raise e


def _read_single_file(input_path):
    if input_path.endswith(".xlsx") or input_path.endswith(".xls"):
        return pd.read_excel(input_path)
    return pd.read_csv(input_path, encoding="utf-8-sig")


def _normalize_facility_name(value):
    if pd.isna(value):
        return None
    value = str(value).strip()
    lower = value.lower()
    # CS2 trước CS1 — tránh nhầm chuỗi chứa số 1/2 không liên quan
    if (
        "cs2" in lower
        or "co so 2" in lower
        or "cơ sở 2" in lower
        or lower == "2"
        or (lower.endswith("2") and "so" in lower)
    ):
        return "Cơ sở 2"
    if (
        "cs1" in lower
        or "co so 1" in lower
        or "cơ sở 1" in lower
        or lower == "1"
        or (lower.endswith("1") and "so" in lower)
    ):
        return "Cơ sở 1"
    return value


def _ensure_co_so_column(shift_df):
    if "Cơ sở" in shift_df.columns:
        return shift_df
    for col in list(shift_df.columns):
        c = str(col).lower().strip()
        c_plain = c.replace("ơ", "o").replace("ở", "o")
        if "co so" in c_plain or c_plain in ("coso", "facility", "cs"):
            return shift_df.rename(columns={col: "Cơ sở"})
    return shift_df


def prepare_shift_df(shift_df):
    shift_df = clean_column_names(shift_df)
    lower_rename = {}
    for col in shift_df.columns:
        key = str(col).lower().strip()
        aliases = {
            "id": "Mã ca thi",
            "staffrequired": "Số lượng cán bộ cần thiết",
            "facility": "Cơ sở",
            "date": "Ngày",
            "dayofweek": "Thứ",
            "name": "Ca thi",
        }
        if key in aliases:
            lower_rename[col] = aliases[key]
    if lower_rename:
        shift_df = shift_df.rename(columns=lower_rename)
    shift_df = shift_df.loc[:, ~shift_df.columns.duplicated()].copy()
    shift_df = _ensure_co_so_column(shift_df)

    if "MS Ca thi" not in shift_df.columns and "Mã ca thi" in shift_df.columns:
        shift_df["MS Ca thi"] = shift_df["Mã ca thi"].astype(str)
    if "Mã ca thi" not in shift_df.columns and "MS Ca thi" in shift_df.columns:
        shift_df["Mã ca thi"] = shift_df["MS Ca thi"]
    if "Ca thi" not in shift_df.columns and "MS Ca thi" in shift_df.columns:
        shift_df["Ca thi"] = shift_df["MS Ca thi"]

    if "Cơ sở" in shift_df.columns:
        shift_df["Cơ sở"] = shift_df["Cơ sở"].apply(_normalize_facility_name)

    if "Số lượng cán bộ cần thiết" not in shift_df.columns:
        shift_df["Số lượng cán bộ cần thiết"] = 2
    shift_df["Số lượng cán bộ cần thiết"] = (
        pd.to_numeric(shift_df["Số lượng cán bộ cần thiết"], errors="coerce").fillna(2).astype(int)
    )

    if "Cơ sở" not in shift_df.columns:
        raise ValueError(
            "Shift data must include a facility column (Cơ sở / facility / Co so). "
            f"Found columns: {list(shift_df.columns)}"
        )

    id_col = None
    for col in ("MS Ca thi", "Mã ca thi"):
        if col in shift_df.columns:
            sample = str(shift_df[col].iloc[0])
            if "_" in sample or (len(sample) >= 4 and sample[:4].isdigit()):
                id_col = col
                break
    if id_col is None and "Mã ca thi" in shift_df.columns:
        id_col = "Mã ca thi"
    elif id_col is None and "MS Ca thi" in shift_df.columns:
        id_col = "MS Ca thi"
    if id_col is None:
        raise ValueError(f"Cannot find shift id column. Columns: {list(shift_df.columns)}")

    shift_df["UNIQUE_KEY"] = (
        shift_df[id_col].astype(str)
        + "|"
        + shift_df["Cơ sở"].astype(str)
    )

    if "Ngày" in shift_df.columns:
        shift_df["Ngày"] = pd.to_datetime(shift_df["Ngày"], errors="coerce")

    shift_df = _aggregate_duplicate_shifts(shift_df)
    return shift_df


def _aggregate_duplicate_shifts(shift_df):
    """Gộp các dòng trùng UNIQUE_KEY (cùng mã ca + cơ sở) — tránh lỗi PuLP overlapping constraint names."""
    if shift_df.empty or "UNIQUE_KEY" not in shift_df.columns:
        return shift_df
    dup_mask = shift_df["UNIQUE_KEY"].duplicated(keep=False)
    if not dup_mask.any():
        return shift_df

    n_dup_rows = int(dup_mask.sum())
    n_unique_dup_keys = shift_df.loc[dup_mask, "UNIQUE_KEY"].nunique()
    print(
        f"[WARN] Found {n_dup_rows} duplicate shift rows ({n_unique_dup_keys} keys) — "
        "aggregating staff required counts."
    )

    sum_col = "Số lượng cán bộ cần thiết"
    agg = {sum_col: "sum"}
    for col in shift_df.columns:
        if col not in (sum_col, "UNIQUE_KEY"):
            agg[col] = "first"

    return shift_df.groupby("UNIQUE_KEY", as_index=False).agg(agg)


def prepare_staff_df(staff_df):
    staff_df = clean_column_names(staff_df)
    lower_rename = {}
    for col in staff_df.columns:
        key = str(col).lower().strip()
        aliases = {
            "id": "Mã cán bộ",
            "age": "Tuổi",
            "gender": "Giới tính",
            "distcs1": "Khoảng cách đến CS1",
            "distcs2": "Khoảng cách đến CS2",
        }
        if key in aliases:
            lower_rename[col] = aliases[key]
    if lower_rename:
        staff_df = staff_df.rename(columns=lower_rename)
    staff_df = staff_df.loc[:, ~staff_df.columns.duplicated()].copy()

    if "MS của CÁN BỘ COI THI" in staff_df.columns:
        staff_df["Mã cán bộ"] = staff_df["MS của CÁN BỘ COI THI"]
    elif "Mã cán bộ" in staff_df.columns:
        staff_df["MS của CÁN BỘ COI THI"] = staff_df["Mã cán bộ"]

    if "Tuổi" not in staff_df.columns:
        staff_df["Tuổi"] = 40
    staff_df["Tuổi"] = pd.to_numeric(staff_df["Tuổi"], errors="coerce").fillna(40).astype(int)

    for col in ("Khoảng cách đến CS1", "Khoảng cách đến CS2"):
        if col not in staff_df.columns:
            staff_df[col] = 0.0
        staff_df[col] = pd.to_numeric(staff_df[col], errors="coerce").fillna(0.0)

    rename_dist = {
        "Khoảng cách đến Cơ sở 1 (km)": "Khoảng cách đến CS1",
        "Khoảng cách đến Cơ sở 2 (km)": "Khoảng cách đến CS2",
    }
    staff_df = staff_df.rename(columns={k: v for k, v in rename_dist.items() if k in staff_df.columns})

    return staff_df


def build_flattened_slots(shift_df):
    rows = []
    for _, shift in shift_df.iterrows():
        n = int(shift.get("Số lượng cán bộ cần thiết", 1))
        for _ in range(max(n, 0)):
            rows.append(shift.to_dict())
    return pd.DataFrame(rows)


def load_shift_data(shift_path):
    df = _read_single_file(shift_path)
    return prepare_shift_df(df)


def load_staff_data(staff_path):
    df = _read_single_file(staff_path)
    return prepare_staff_df(df)


def validate_data(staff_df, shift_df):
    required_shift = ["UNIQUE_KEY", "Số lượng cán bộ cần thiết"]
    required_staff = ["MS của CÁN BỘ COI THI", "Tuổi"]
    missing_shift = [c for c in required_shift if c not in shift_df.columns]
    missing_staff = [c for c in required_staff if c not in staff_df.columns]
    if missing_shift:
        raise ValueError(f"Shift data missing columns: {missing_shift}")
    if missing_staff:
        raise ValueError(f"Staff data missing columns: {missing_staff}")
    total_need = int(shift_df["Số lượng cán bộ cần thiết"].sum())
    if total_need <= 0:
        raise ValueError("No invigilator slots required in shift data")
    print(f"[OK] Data validation passed ({total_need} slots, {len(staff_df)} staff)")