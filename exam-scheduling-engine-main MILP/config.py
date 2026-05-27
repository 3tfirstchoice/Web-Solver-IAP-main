import os

# Project paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_DIR = os.path.join(BASE_DIR, 'outputs')
SRC_DIR = os.path.join(BASE_DIR, 'src')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Input data files
INPUT_STAFF_FILE = os.path.join(DATA_DIR, 'can_bo.xlsx')  # Danh sách cán bộ
INPUT_SHIFT_FILE = os.path.join(DATA_DIR, 'ca_thi.xlsx')  # Danh sách ca thi

# Output file
OUTPUT_SCHEDULE_FILE = os.path.join(OUTPUT_DIR, 'Ket_Qua_Xep_Lich.xlsx')

# ==========================================
# CẤU HÌNH TRỌNG SỐ ĐIỂM PHẠT (PENALTIES)
# ==========================================
# Trọng số càng cao thể hiện tiêu chí càng quan trọng.
# Lịch trình tốt là lịch trình có tổng điểm phạt càng thấp.
WEIGHT_FAIRNESS = 8                 # Phạt nếu số ca trực chênh lệch so với mức trung bình
WEIGHT_DISTANCE = 0.1               # Phạt dựa trên tổng khoảng cách di chuyển
# WEIGHT_DISTANCE_FAIRNESS = 10      # (DEPRECATED - removed from objective) Phạt nếu khoảng cách di chuyển không công bằng giữa các cán bộ
WEIGHT_SAME_DAY_DIFF_FACILITY = 6   # Phạt nếu gác >2 ca/ngày mà phải di chuyển 2 cơ sở khác nhau
WEIGHT_MIN_SHIFT = 5                # Phạt nếu có cán bộ không được gác ca nào (số ca = 0)
WEIGHT_AGE_PRIORITY = 3             # Phạt nếu xếp nhiều ca cho người lớn tuổi (>45 tuổi)
WEIGHT_PARTNER_DIVERSITY = 0        # Phạt nếu 2 người gác chung với nhau quá nhiều lần
WEIGHT_CONSECUTIVE_SHIFTS = 4       # Phạt nếu có cán bộ gác nhiều ca liên tiếp trong cùng một ngày

# ==========================================
# CÁC HẰNG SỐ LOGIC KHÁC (Tùy chọn)
# ==========================================
AGE_THRESHOLD = 45                  # Ngưỡng tuổi để tính ưu tiên
MAX_PARTNER_REPETITION = 2          # Số lần tối đa 2 người được gác chung trước khi bị phạt

# Solver limits
TIME_LIMIT = None
GAP_REL = 0.05

# Backward-compatible aliases expected by older code
FAIRNESS_WEIGHT = WEIGHT_FAIRNESS
DISTANCE_WEIGHT = WEIGHT_DISTANCE
# DISTANCE_FAIRNESS_WEIGHT = WEIGHT_DISTANCE_FAIRNESS  # (DEPRECATED)
SAME_DAY_DIFF_FACILITY_WEIGHT = WEIGHT_SAME_DAY_DIFF_FACILITY
MIN_SHIFT_WEIGHT = WEIGHT_MIN_SHIFT
AGE_WEIGHT = WEIGHT_AGE_PRIORITY
CLOSE_SHIFT_WEIGHT = WEIGHT_CONSECUTIVE_SHIFTS
PARTNER_DIVERSITY_WEIGHT = WEIGHT_PARTNER_DIVERSITY
WEEKEND_WEIGHT = 7

# Aliases for legacy model access
WEIGHT_CLOSE_SHIFT = CLOSE_SHIFT_WEIGHT
WEIGHT_AGE = AGE_WEIGHT
OLD_AGE_THRESHOLD = AGE_THRESHOLD
