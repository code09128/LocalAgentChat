import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { writeLog } from './local_smart.js';

export interface PythonBackendStatus {
  enabled: boolean;
  running: boolean;
  pid: number | null;
  port: number;
  projectDir: string;
  executable: string;
}

function resolvePythonExecutable(projectDir: string, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) return customPath;

  const candidates = [
    path.join(projectDir, '.venv', 'bin', 'python'),
    path.join(projectDir, '.venv', 'Scripts', 'python.exe'),
    path.join(projectDir, 'venv', 'bin', 'python'),
    path.join(projectDir, 'venv', 'Scripts', 'python.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return customPath || 'python3';
}

class PythonBackendManager {
  private process: ChildProcess | null = null;
  private port = Number(process.env.PYTHON_PORT || 8002);
  private projectDir = process.env.PYTHON_PROJECT_DIR || path.resolve(process.cwd(), '../swarm_core_ai/far_swarm_ai_local');
  private executable = resolvePythonExecutable(this.projectDir, process.env.PYTHON_PATH);
  private enabled = process.env.ENABLE_PYTHON_BACKEND === 'true';

  public getStatus(): PythonBackendStatus {
    this.executable = resolvePythonExecutable(this.projectDir, process.env.PYTHON_PATH);
    return {
      enabled: this.enabled,
      running: this.process !== null && !this.process.killed,
      pid: this.process?.pid ?? null,
      port: this.port,
      projectDir: this.projectDir,
      executable: this.executable,
    };
  }

  public async start(): Promise<{ success: boolean; message: string }> {
    if (this.process && !this.process.killed) {
      return { success: true, message: `Python backend is already running (PID: ${this.process.pid})` };
    }

    const scriptPath = path.join(this.projectDir, 'main.py');
    if (!fs.existsSync(scriptPath)) {
      const msg = `Python main script not found at: ${scriptPath}`;
      console.warn(`[PythonManager] ${msg}`);
      writeLog('WARNING', `PythonManager: ${msg}`);
      return { success: false, message: msg };
    }

    try {
      this.executable = resolvePythonExecutable(this.projectDir, process.env.PYTHON_PATH);
      writeLog('INFO', `PythonManager: Spawning ${this.executable} main.py in ${this.projectDir}`);
      this.process = spawn(this.executable, ['main.py'], {
        cwd: this.projectDir,
        env: {
          ...process.env,
          PORT: String(this.port),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          console.log(`[Python:stdout] ${text}`);
          writeLog('DEBUG', `[Python:stdout] ${text}`);
        }
      });

      this.process.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          console.error(`[Python:stderr] ${text}`);
          writeLog('WARNING', `[Python:stderr] ${text}`);
        }
      });

      this.process.on('close', (code) => {
        console.log(`[PythonManager] Process exited with code ${code}`);
        writeLog('INFO', `PythonManager: Process exited with code ${code}`);
        this.process = null;
      });

      this.process.on('error', (err) => {
        console.error('[PythonManager] Process error:', err);
        writeLog('ERROR', `PythonManager error: ${err.message}`);
        this.process = null;
      });

      return { success: true, message: `Python backend started (PID: ${this.process.pid}) on port ${this.port}` };
    } catch (error: any) {
      const msg = `Failed to start Python backend: ${error?.message || error}`;
      console.error(`[PythonManager] ${msg}`);
      writeLog('ERROR', `PythonManager: ${msg}`);
      return { success: false, message: msg };
    }
  }

  public stop(): { success: boolean; message: string } {
    if (!this.process || this.process.killed) {
      this.process = null;
      return { success: true, message: 'Python backend is not running' };
    }

    try {
      const pid = this.process.pid;
      this.process.kill('SIGTERM');
      this.process = null;
      const msg = `Python backend (PID: ${pid}) stopped`;
      writeLog('INFO', `PythonManager: ${msg}`);
      return { success: true, message: msg };
    } catch (error: any) {
      const msg = `Failed to stop Python backend: ${error?.message || error}`;
      writeLog('ERROR', `PythonManager: ${msg}`);
      return { success: false, message: msg };
    }
  }

  public autoStartIfEnabled() {
    if (this.enabled) {
      console.log('[PythonManager] ENABLE_PYTHON_BACKEND=true, launching backend...');
      this.start();
    }
  }
}

export const pythonManager = new PythonBackendManager();
