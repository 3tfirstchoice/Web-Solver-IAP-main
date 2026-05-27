import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const solverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolvePythonExecutable() {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }

  const candidates = [
    path.join(solverRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(solverRoot, '.venv', 'bin', 'python'),
    path.join(solverRoot, '..', 'exam-scheduling-engine-main MILP', '.venv', 'Scripts', 'python.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

export function engineRoot() {
  return path.join(solverRoot, '..', 'exam-scheduling-engine-main MILP');
}
