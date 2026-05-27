# AppIAP — Hướng dẫn chạy local (Hợp nhất)

Mục đích: hướng dẫn này mô tả cách lưu hai repository cạnh nhau trong một thư mục cha (ví dụ `C:\...\AppIAP`) và chạy frontend (React/TypeScript) cùng backend (Python ILP/MILP) một cách thuận tiện.

Yêu cầu nền tảng
- Windows 10/11
- Python 3.10+ (hoặc 3.9+) — để cài các dependencies Python
- Node.js 18+ và `npm`

Cấu trúc thư mục khuyến nghị

AppIAP/
├─ exam-scheduling-solver MILP/        # frontend + Node server
└─ exam-scheduling-engine-main MILP/  # Python solver (ILP)

Tổng quan công nghệ
- Frontend: Vite + React + TypeScript
- Server: Node (Express thin wrapper) để spawn Python solver
- Backend: Python với `PuLP`, `pandas`, `numpy`, `openpyxl` (ILP)

Nguyên tắc vận hành
- Không tạo virtualenv trong thư mục backend. Thay vào đó tạo một `.venv` trong `exam-scheduling-solver MILP` và cài các dependency backend vào đó. `server.ts` đã cấu hình để ưu tiên Python trong `.venv` này.

1) Cài đặt lần đầu

Mở PowerShell và chuyển vào thư mục solver:

```powershell
cd "C:\path\to\AppIAP\exam-scheduling-solver MILP"
```

a) Tạo và kích hoạt virtualenv (nếu chưa có):

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
```

Hoặc dùng script tự động:

```powershell
npm run backend:install
```

b) Cài dependencies Python của backend vào `.venv`:

```powershell
python -m pip install --upgrade pip
python -m pip install -r "..\exam-scheduling-engine-main MILP\requirements.txt"
```

c) Cài dependencies Node cho solver (frontend + server):

```powershell
npm install
```

2) Mô tả dữ liệu đầu vào và đầu ra

- Dữ liệu vào (CSV) nằm trong thư mục backend `exam-scheduling-engine-main MILP\data\` (ví dụ `ca_thi_new.csv`, `can_bo_new.csv`).
- Kết quả đầu ra: `outputs/Ket_Qua_Xep_Lich.xlsx` trong thư mục backend.

Yêu cầu cột chính (tóm tắt):
- Shifts (`ca_thi`): ngày, mã ca, cơ sở, số lượng cần
- Staff (`can_bo`): tên, tuổi, cơ sở, khoảng cách đến các CS

3) Chạy hệ thống

a) Chạy backend trực tiếp (khi `.venv` đang active):

```powershell
cd "..\exam-scheduling-engine-main MILP"
..\"exam-scheduling-solver MILP"\.venv\Scripts\python.exe main.py
```

b) Chạy backend qua script từ solver (không cần rời folder solver):

```powershell
cd "C:\path\to\AppIAP\exam-scheduling-solver MILP"
npm run backend:start
```

c) Chạy frontend dev server (UI):

```powershell
npm run dev
```

Mở: http://localhost:3000

Ghi chú: `npm run dev` khởi server Node (Express) và UI; khi người dùng nhấn "Run Solver" giao diện sẽ gọi API `/api/solve` để spawn Python solver.

4) Cấu hình server

- `server.ts` tự động dò Python theo môi trường:
	- `process.env.PYTHON_PATH` nếu được set
	- hoặc `./.venv/Scripts/python.exe` nếu tồn tại
	- hoặc `../exam-scheduling-engine-main MILP/.venv/Scripts/python.exe`

Bạn có thể ép dùng Python khác bằng cách export biến môi trường:

```powershell
$env:PYTHON_PATH = "C:\Python\python.exe"
npm run dev
```

5) Cách xử lý xung đột port

Nếu port 3000 bị chiếm:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

6) Tinh chỉnh tham số thuật toán

Mở `exam-scheduling-engine-main MILP\config.py` để điều chỉnh trọng số mục tiêu, `TIME_LIMIT`, `GAP_REL`, v.v.

Ngoài ra bạn có thể điều chỉnh trực tiếp từ giao diện (không cần mở `config.py`).

- Cách hoạt động: server chạy `backend_wrapper.py` trong thư mục `exam-scheduling-engine-main MILP`.
- Frontend gửi POST tới `/api/solve` với body JSON (cấu hình, dữ liệu staff/shifts). Wrapper đọc từ stdin và ghi đè `config` trước khi chạy solver.

7) Troubleshooting nhanh

- Missing module: chạy `npm run backend:install` trong thư mục solver
- Không thấy file output: kiểm tra `outputs/` trong backend và logs stdout/stderr trên terminal của server
- Solver chạy lâu: tăng/giảm `TIME_LIMIT` trong `config.py`
- Sau khi đổi tên thư mục: xóa `.venv` cũ (nếu có) rồi chạy lại `npm run backend:install`

8) Tài liệu tham khảo

- PuLP: https://coin-or.github.io/PuLP/
- Vite: https://vitejs.dev/
- Express: https://expressjs.com/

---
