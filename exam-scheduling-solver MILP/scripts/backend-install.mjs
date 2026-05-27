import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { engineRoot, resolvePythonExecutable } from './resolve-python.mjs';

const solverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const venvDir = path.join(solverRoot, '.venv');
const venvPython =
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

let python = resolvePythonExecutable();

if (!fs.existsSync(venvPython)) {
  console.log('[backend:install] Creating .venv in solver folder...');
  const create = spawnSync(python, ['-m', 'venv', venvDir], { stdio: 'inherit', shell: false });
  if (create.status !== 0) {
    console.error('[backend:install] Failed to create virtualenv');
    process.exit(create.status ?? 1);
  }
  python = venvPython;
}

const requirements = path.join(engineRoot(), 'requirements.txt');
console.log(`[backend:install] Using ${python}`);
console.log(`[backend:install] Installing from ${requirements}`);

const pip = spawnSync(python, ['-m', 'pip', 'install', '--upgrade', 'pip'], { stdio: 'inherit' });
if (pip.status !== 0) process.exit(pip.status ?? 1);

const install = spawnSync(python, ['-m', 'pip', 'install', '-r', requirements], { stdio: 'inherit' });
process.exit(install.status ?? 1);
