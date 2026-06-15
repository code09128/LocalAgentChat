import fs from 'fs';
import path from 'path';
import { LOG_FILE } from './config.js';
export function ensureLogFile() {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, `${getTimestamp()} INFO Office Monitor Booted\n`, 'utf-8');
    }
}
export function getTimestamp() {
    const now = new Date();
    const pad = (n, size = 2) => String(n).padStart(size, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const msStr = pad(now.getMilliseconds(), 3);
    return `${dateStr} ${timeStr},${msStr}`;
}
export function writeLog(level, msg) {
    ensureLogFile();
    const line = `${getTimestamp()} ${level} ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
}
