import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
export const PORT = process.env.PORT || 8000;
export const LOCAL_SMART_DIR = path.join(os.homedir(), '.local_smart');
export const LOG_FILE = path.join(LOCAL_SMART_DIR, 'logs', 'agent.log');
export const TASKS_FILE = path.join(LOCAL_SMART_DIR, 'tasks.json');
