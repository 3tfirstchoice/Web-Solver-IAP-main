import { spawn } from 'child_process';
import { engineRoot, resolvePythonExecutable } from './resolve-python.mjs';

const python = resolvePythonExecutable();
const cwd = engineRoot();

console.log(`[backend:start] python=${python}`);
console.log(`[backend:start] cwd=${cwd}`);

const proc = spawn(python, ['main.py'], {
  cwd,
  env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
  stdio: 'inherit',
  shell: false,
});

proc.on('error', (err) => {
  console.error('[backend:start] Failed to start Python:', err.message);
  process.exit(1);
});

proc.on('exit', (code) => process.exit(code ?? 1));
