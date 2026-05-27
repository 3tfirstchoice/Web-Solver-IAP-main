import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

function engineDataDir() {
  return path.join(process.cwd(), '..', 'exam-scheduling-engine-main MILP', 'data');
}

function parseCsvLine(text: string): string[] {
  let insideQuote = false;
  const entries: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (insideQuote && next === '"') {
        current += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      entries.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  entries.push(current.trim());
  return entries;
}

function readCsvFile(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function parseStaffRows(rows: string[][]) {
  if (rows.length <= 1) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const idx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const idIdx = idx(['id', 'macanbo', 'macb', 'mscb']);
  const nameIdx = idx(['name', 'ten', 'hoten']);
  const genderIdx = idx(['gender', 'gioitinh']);
  const ageIdx = idx(['age', 'tuoi']);
  const cs1Idx = idx(['distcs1', 'khoangcachdencs1', 'cs1']);
  const cs2Idx = idx(['distcs2', 'khoangcachdencs2', 'cs2']);

  const staff: Array<{
    id: string;
    name: string;
    gender: string;
    age: number;
    distCS1: number;
    distCS2: number;
    assignedCount: number;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[idIdx >= 0 ? idIdx : 0]?.replace(/^"|"$/g, '') ?? '';
    if (!id) continue;
    staff.push({
      id,
      name: (nameIdx >= 0 ? row[nameIdx] : `Cán bộ ${id}`)?.replace(/^"|"$/g, '') ?? `Cán bộ ${id}`,
      gender: (genderIdx >= 0 ? row[genderIdx] : 'Nam')?.replace(/^"|"$/g, '') ?? 'Nam',
      age: parseInt(row[ageIdx >= 0 ? ageIdx : 2] ?? '40', 10) || 40,
      distCS1: parseFloat(row[cs1Idx >= 0 ? cs1Idx : 3] ?? '0') || 0,
      distCS2: parseFloat(row[cs2Idx >= 0 ? cs2Idx : 4] ?? '0') || 0,
      assignedCount: 0,
    });
  }
  return staff;
}

function normalizeFacilityValue(facility: string): string {
  const raw = (facility || '').trim();
  const lower = raw.toLowerCase();
  if (
    /\bcs\s*2\b/i.test(lower) ||
    /cơ\s*sở\s*2/i.test(lower) ||
    /co\s*so\s*2/i.test(lower) ||
    /^2$/.test(lower) ||
    (lower.includes('so') && /(^|\s)2(\s|$)/.test(lower))
  ) {
    return 'Cơ sở 2';
  }
  if (
    /\bcs\s*1\b/i.test(lower) ||
    /cơ\s*sở\s*1/i.test(lower) ||
    /co\s*so\s*1/i.test(lower) ||
    /^1$/.test(lower) ||
    (lower.includes('so') && /(^|\s)1(\s|$)/.test(lower))
  ) {
    return 'Cơ sở 1';
  }
  return raw || 'Cơ sở 1';
}

function parseShiftRows(rows: string[][]) {
  if (rows.length <= 1) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const idx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const idIdx = idx(['id', 'macathi', 'maca', 'mscathi']);
  const nameIdx = idx(['name', 'cathi', 'ten']);
  const dateIdx = idx(['date', 'ngay']);
  const timeIdx = idx(['time', 'gio', 'thoigian']);
  const dowIdx = idx(['dayofweek', 'thu']);
  const facilityIdx = idx(['facility', 'coso', 'cs']);
  const reqIdx = idx(['staffrequired', 'soluong', 'canbo']);

  const shifts: Array<{
    id: string;
    name: string;
    date: string;
    time: string;
    dayOfWeek: string;
    facility: string;
    staffRequired: number;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[idIdx >= 0 ? idIdx : 0]?.replace(/^"|"$/g, '') ?? '';
    if (!id) continue;
    const facilityRaw = (facilityIdx >= 0 ? row[facilityIdx] : '')?.replace(/^"|"$/g, '') ?? '';
    const facility = normalizeFacilityValue(facilityRaw);

    shifts.push({
      id,
      name: (nameIdx >= 0 ? row[nameIdx] : id)?.replace(/^"|"$/g, '') ?? id,
      date: (dateIdx >= 0 ? row[dateIdx] : '')?.replace(/^"|"$/g, '').split(' ')[0] ?? '',
      time: (timeIdx >= 0 ? row[timeIdx] : '')?.replace(/^"|"$/g, '') ?? '',
      dayOfWeek: (dowIdx >= 0 ? row[dowIdx] : '')?.replace(/^"|"$/g, '') ?? '',
      facility,
      staffRequired: parseInt(row[reqIdx >= 0 ? reqIdx : row.length - 1] ?? '2', 10) || 2,
    });
  }
  return aggregateShiftRows(shifts);
}

function aggregateShiftRows(
  shifts: Array<{
    id: string;
    name: string;
    date: string;
    time: string;
    dayOfWeek: string;
    facility: string;
    staffRequired: number;
  }>
) {
  const map = new Map<string, (typeof shifts)[number]>();
  for (const s of shifts) {
    const fac = normalizeFacilityValue(s.facility);
    const key = `${s.id}|${fac}`;
    const prev = map.get(key);
    if (prev) {
      prev.staffRequired += s.staffRequired;
    } else {
      map.set(key, { ...s, facility: fac });
    }
  }
  return Array.from(map.values());
}

function resolvePythonExe(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  const candidates = [
    path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), '.venv', 'bin', 'python'),
    path.join(process.cwd(), '..', 'exam-scheduling-engine-main MILP', '.venv', 'Scripts', 'python.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'python';
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Convert body parser JSON syntax errors into JSON responses.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ success: false, message: 'Invalid JSON body', error: err.message });
    }
    next(err);
  });

  // Dataset on disk (same files the Python solver reads)
  app.get('/api/data', (_req, res) => {
    try {
      const dataDir = engineDataDir();
      const staff = parseStaffRows(readCsvFile(path.join(dataDir, 'can_bo_new.csv')));
      const shifts = parseShiftRows(readCsvFile(path.join(dataDir, 'ca_thi_new.csv')));
      return res.json({ success: true, staff, shifts });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message, staff: [], shifts: [] });
    }
  });

  // Solver API - run Python backend and capture JSON output
  let currentProcess: ChildProcessWithoutNullStreams | null = null;

  const isSolverActive = (proc: ChildProcessWithoutNullStreams | null) => {
    return proc !== null && proc.exitCode === null && proc.signalCode === null;
  };

  app.get('/api/solve/status', (req, res) => {
    return res.json({
      success: true,
      active: !!currentProcess && isSolverActive(currentProcess),
      hasProcess: !!currentProcess,
      pid: currentProcess?.pid ?? null,
      exitCode: currentProcess?.exitCode ?? null,
      signalCode: currentProcess?.signalCode ?? null,
    });
  });

  app.post('/api/solve', (req, res) => {
    console.log('[api/solve] incoming request', { body: req.body, currentProcess: currentProcess ? { pid: currentProcess.pid, exitCode: currentProcess.exitCode, signalCode: currentProcess.signalCode, killed: currentProcess.killed } : null });

    if (currentProcess && isSolverActive(currentProcess)) {
      return res.status(409).json({ success: false, message: 'Solver already running' });
    }
    if (currentProcess && !isSolverActive(currentProcess)) {
      console.log('[api/solve] stale solver process detected, clearing currentProcess');
      currentProcess = null;
    }

    try {
      const repoRoot = path.join(process.cwd(), '..', 'exam-scheduling-engine-main MILP');
      const pythonExe = resolvePythonExe();
      const scriptPath = path.join(repoRoot, 'main.py');
      const cwd = repoRoot;
      //const config = req.body?.config || {};

      // Run the solver without creating Excel output during API solve.
      // const args: string[] = [
      //   scriptPath,
      //   '--skip-export',
      //   '--json-summary',
      // ];
      
      // --- ĐOẠN SỬA 1: Gửi cấu hình & dữ liệu từ frontend xuống Python qua stdin ---

      const dataDir = path.join(repoRoot, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 1. Ghi file dữ liệu cán bộ mới an toàn (Bọc nháy kép tránh lỗi dấu phẩy + Thêm BOM UTF-8)
      if (req.body?.staff && Array.isArray(req.body.staff) && req.body.staff.length > 0) {
        const staffCsvPath = path.join(dataDir, 'can_bo_new.csv');
        const headers = Object.keys(req.body.staff[0]).join(',');
        const rows = req.body.staff.map((s: any) => 
          Object.values(s).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        fs.writeFileSync(staffCsvPath, `\uFEFF${headers}\n${rows}`, 'utf-8');
        console.log(`[Node.js] Đã ghi đè file dữ liệu cán bộ mới: ${staffCsvPath}`);
      }

      // 2. Ghi file dữ liệu ca thi mới an toàn
      if (req.body?.shifts && Array.isArray(req.body.shifts) && req.body.shifts.length > 0) {
        const shiftCsvPath = path.join(dataDir, 'ca_thi_new.csv');
        const shiftCsvHeaders = ['id', 'name', 'date', 'time', 'dayOfWeek', 'facility', 'staffRequired'] as const;
        const headers = shiftCsvHeaders.join(',');
        const rows = req.body.shifts.map((s: any) =>
          shiftCsvHeaders
            .map((h) => `"${String(s[h] ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ).join('\n');

        fs.writeFileSync(shiftCsvPath, `\uFEFF${headers}\n${rows}`, 'utf-8');
        console.log(`[Node.js] Đã ghi đè file dữ liệu ca thi mới: ${shiftCsvPath}`);
      }
      // =================================================================

      
      const wrapperScript = path.join(repoRoot, 'backend_wrapper.py');
      const args: string[] = [
        wrapperScript,
        // '--backend-root',
        // repoRoot
      ];

      console.log(`Starting MILP Python solver with: ${pythonExe}`);
      console.log(`Solver script: ${wrapperScript}`);
      console.log(`Working directory: ${cwd}`);
      console.log(`Solver args: ${args.join(' ')}`);

      const proc = spawn(pythonExe, args, {
        cwd,
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
        },
      });
      currentProcess = proc;

      // Gửi cấu hình trọng số & yêu cầu đè dữ liệu xuống Python qua stdin
      if (req.body) {
        proc.stdin.write(JSON.stringify(req.body));
        proc.stdin.end();
      }
      // --- HẾT ĐOẠN SỬA 1 ---

      let stdoutBuf = '';
      let stderrBuf = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        const s = chunk.toString();
        stdoutBuf += s;
        // Mirror Python stdout to Node terminal so user can observe solver progress live
        try { console.log('[python stdout]', s); } catch (e) { /* ignore logging errors */ }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString();
        console.error('[python stderr]', chunk.toString());
      });

      proc.on('error', (err: any) => {
        currentProcess = null;
        console.error('Python process error:', err);
        res.status(500).json({ success: false, message: String(err) });
      });

      const parseSolverJson = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return null;

        // Prefer a single-line payload emitted by backend_wrapper.py
        const lines = trimmed.split(/\r?\n/);
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.includes('"success"')) {
            try {
              return JSON.parse(line);
            } catch (_) {
              /* try next line */
            }
          }
        }

        try {
          return JSON.parse(trimmed);
        } catch (_) {
          const lastOpen = trimmed.lastIndexOf('{');
          const lastClose = trimmed.lastIndexOf('}');
          if (lastOpen >= 0 && lastClose > lastOpen) {
            const candidate = trimmed.slice(lastOpen, lastClose + 1);
            try {
              return JSON.parse(candidate);
            } catch (__) {
              return null;
            }
          }
          return null;
        }
      };

      proc.on('close', (code: number) => {
        currentProcess = null;
        if (code === 0) {
          // backend_wrapper logs to stderr; JSON may appear on stdout OR stderr (Windows)
          const combined = `${stdoutBuf}\n${stderrBuf}`;
          const parsed: any =
            parseSolverJson(stdoutBuf) ||
            parseSolverJson(stderrBuf) ||
            parseSolverJson(combined);

          // #region agent log
          try {
            const logPath = path.join(process.cwd(), '..', 'debug-540e2c.log');
            fs.appendFileSync(
              logPath,
              JSON.stringify({
                sessionId: '540e2c',
                hypothesisId: 'F',
                location: 'server.ts:close',
                message: 'parsed solver response',
                data: {
                  stdoutLen: stdoutBuf.length,
                  stderrLen: stderrBuf.length,
                  parsedSuccess: !!parsed?.success,
                  assignmentCount: parsed?.assignments?.length ?? 0,
                },
                timestamp: Date.now(),
              }) + '\n',
              'utf-8'
            );
          } catch (_) { /* ignore */ }
          // #endregion

          if (parsed?.success && Array.isArray(parsed.assignments)) {
            return res.json({
              ...parsed,
              algorithm: parsed.algorithm || 'ILP',
            });
          }

          return res.status(500).json({
            success: false,
            message: 'Solver finished but returned no parseable assignments JSON.',
            algorithm: 'ILP',
            assignments: [],
            metrics: parsed?.metrics ?? {},
            stdoutLen: stdoutBuf.length,
            stderrLen: stderrBuf.length,
          });
        }
        return res.status(500).json({ success: false, message: `Python solver exited with code ${code}`, raw: stdoutBuf, stderr: stderrBuf });
      });
    } catch (err: any) {
      currentProcess = null;
      res.status(500).json({ success: false, message: err.message });
    }
  });


  // =================================================================
  // 🚀 API NHẬN DATA CSV THUẦN TỪ FRONTEND VÀ GHI THÀNH FILE VẬT LÝ
  // =================================================================
  app.post('/api/upload-csv', (req, res) => {
    const { type, filename, text } = req.body;
    console.log(`[api/upload-csv] Nhận yêu cầu lưu file: ${filename} (Loại: ${type})`);

    if (!text) {
      return res.status(400).json({ success: false, message: 'Dữ liệu file trống!' });
    }

    try {
      // Xác định đường dẫn đến thư mục data của Engine Python
      const repoRoot = path.join(process.cwd(), '..', 'exam-scheduling-engine-main MILP');
      const dataDir = path.join(repoRoot, 'data');

      // Tự động tạo thư mục 'data' nếu chưa tồn tại
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Ép tên file cố định theo chuẩn để Python dễ nạp (hoặc dùng filename tùy chọn)
      const targetFileName = type === 'staff' ? 'can_bo_new.csv' : 'ca_thi_new.csv';
      const targetPath = path.join(dataDir, targetFileName);

      // Ghi file kèm mã hóa BOM UTF-8 để tránh lỗi tiếng Việt có dấu khi Excel/Python đọc
      fs.writeFileSync(targetPath, `\uFEFF${text}`, 'utf-8');
      console.log(`[Node.js] Đã ghi file thành công: ${targetPath}`);

      return res.json({ 
        success: true, 
        message: `Đã lưu file thành công thành ${targetFileName}` 
      });
    } catch (error: any) {
      console.error('[api/upload-csv] Lỗi ghi file:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });
  
  //----------------------------------------------------------------------------------



  app.post('/api/solve/stop', async (req, res) => {
    if (!currentProcess) return res.json({ success: false, message: 'No solver running' });
    try {
      currentProcess.kill();
      currentProcess = null;
      return res.json({ success: true, message: 'Solver stopped' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Export Excel - Chỉ việc lấy file đã tạo gửi về, KHÔNG chạy lại Python
  app.post('/api/export', async (req, res) => {
    try {
      const repoRoot = path.join(process.cwd(), '..', 'exam-scheduling-engine-main MILP');
      const outFile = path.join(repoRoot, 'outputs', 'Ket_Qua_Xep_Lich.xlsx');

      if (fs.existsSync(outFile)) {
        return res.download(outFile, 'Ket_Qua_Xep_Lich.xlsx');
      } else {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy file kết quả. Vui lòng đảm bảo thuật toán đã chạy xong.',
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
