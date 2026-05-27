# AppIAP — Hướng dẫn chạy local (Hợp nhất)

Mục đích: hướng dẫn này mô tả cách lưu hai repository cạnh nhau trong một thư mục cha (ví dụ `C:\...\AppIAP`) và chạy frontend (React/TypeScript) cùng backend (Python NSGA-II) một cách thuận tiện.

Yêu cầu nền tảng
- Windows 10/11
- Python 3.10+ (hoặc 3.9+) — để cài các dependencies Python
- Node.js 18+ và `npm`

Cấu trúc thư mục khuyến nghị

AppIAP/
├─ exam-scheduling-solver NSGA II/        # frontend + Node server
└─ exam-scheduling-engine-main NSGA II/  # Python solver (unchanged)

Tổng quan công nghệ
- Frontend: Vite + React + TypeScript
- Server: Node (Express thin wrapper) để spawn Python solver
- Backend: Python với `pymoo`, `pandas`, `numpy`, `openpyxl` (NSGA-II)

Nguyên tắc vận hành
- Không tạo virtualenv trong thư mục backend. Thay vào đó tạo một `.venv` trong `exam-scheduling-solver NSGA II` và cài các dependency backend vào đó. `server.ts` đã cấu hình để ưu tiên Python trong `.venv` này.

1) Cài đặt lần đầu

Mở PowerShell và chuyển vào thư mục solver:

```powershell
cd "C:\path\to\AppIAP\exam-scheduling-solver NSGA II"
```

a) Tạo và kích hoạt virtualenv (nếu chưa có):

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
```

b) Cài dependencies Python của backend vào `.venv`:

```powershell
python -m pip install --upgrade pip
python -m pip install -r "..\exam-scheduling-engine-main NSGA II\requirements.txt"
```

c) Cài dependencies Node cho solver (frontend + server):

```powershell
npm install
```

2) Mô tả dữ liệu đầu vào và đầu ra

- Dữ liệu vào (Excel) nằm trong thư mục backend `exam-scheduling-engine-main NSGA II\data\` (ví dụ `ca_thi.xlsx`, `can_bo.xlsx`).
- Kết quả đầu ra: `outputs/Ket_Qua_Xep_Lich.xlsx` trong thư mục backend.

Yêu cầu cột chính (tóm tắt):
- Shifts (`ca_thi.xlsx`): ngày, mã ca, cơ sở, số lượng cần
- Staff (`can_bo.xlsx`): tên, tuổi, cơ sở, khoảng cách đến các CS

3) Chạy hệ thống

a) Chạy backend trực tiếp (khi `.venv` đang active):

```powershell
cd "..\exam-scheduling-engine-main NSGA II"
..\"exam-scheduling-solver NSGA II"\.venv\Scripts\python.exe main.py
```

b) Chạy backend qua script từ solver (không cần rời folder solver):

```powershell
cd "C:\path\to\AppIAP\exam-scheduling-solver NSGA II"
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

Mở `exam-scheduling-engine-main NSGA II\config.py` để điều chỉnh các tham số như `POPULATION_SIZE`, `NUM_GENERATIONS`, trọng số mục tiêu và hệ số phạt. Tổng quan gợi ý:
- Tăng `POPULATION_SIZE` & `NUM_GENERATIONS` cho chất lượng tốt hơn (đổi lại thời gian)
- Giảm để chạy nhanh hơn trên các instance lớn

Ngoài ra Bạn có thể điều chỉnh trực tiếp từ giao diện (không cần mở `config.py`).

- Cách hoạt động: server bây giờ hỗ trợ chạy một wrapper (`backend_wrapper.py`) nằm trong `exam-scheduling-solver NSGA II`.
- Frontend có thể gửi một POST tới endpoint `/api/solve` với body JSON chứa một trường `params` (object). Các key trong `params` tương ứng với tên biến trong `config.py`.

Ví dụ JSON body (HTTP POST):

```json
{
	"params": {
		"POPULATION_SIZE": 200,
		"NUM_GENERATIONS": 800,
		"NO_ASSIGNMENT_PENALTY": 200000
	}
}
```

Khi `params` được gửi, server sẽ chạy `backend_wrapper.py`, truyền `params` qua STDIN, wrapper sẽ ghi đè các thuộc tính trên module `config` trước khi khởi chạy solver — không cần thay đổi file trong backend.

Gợi ý UI: thêm form trong app để chỉnh các tham số then nhấn "Run Solver" — frontend chỉ việc gửi body JSON ở trên tới `/api/solve`.

Lưu ý an toàn: chỉ cho phép các tham số đã được whitelist từ UI (ví dụ `POPULATION_SIZE`, `NUM_GENERATIONS`, các hệ số phạt và trọng số mục tiêu) để tránh thiết lập sai lệch.

7) Troubleshooting nhanh

- Missing module: cài lại dependencies vào `.venv` của solver
- Không thấy file output: kiểm tra `outputs/` trong backend và logs stdout/stderr trên terminal của server
- Solver chạy lâu: giảm population/generations hoặc tăng CPU

8) Tự động hóa (tùy chọn)

Nếu muốn mình có thể tạo một script PowerShell (`setup_and_run.ps1`) trong `exam-scheduling-solver NSGA II` để:
- tạo và kích hoạt `.venv`
- cài dependencies backend vào `.venv`
- chạy `npm install`
- khởi `npm run dev`

9) Tài liệu tham khảo

- NSGA-II / pymoo: https://pymoo.org/
- Vite: https://vitejs.dev/
- Express: https://expressjs.com/

---
