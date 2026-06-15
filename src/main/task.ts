import fs from 'fs';
import path from 'path';
import { TASKS_FILE } from './config.js';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TASKS: TaskItem[] = [
  {
    id: '1',
    title: 'Design local-smart Architecture',
    description: 'Structure folders, design API endpoints and SSE log-tailer.',
    status: 'done',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Setup React and TailwindCSS 4',
    description: 'Create components, import custom typography and styling variables.',
    status: 'in_progress',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Integrate SSE Live Log Streaming',
    description: 'Ensure client connects to /api/monitor/stream and receives real-time log details.',
    status: 'todo',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    title: 'Build SSH Tunnel Gateway',
    description: 'Draft tunneling configuration screen and backend logic wrapper.',
    status: 'todo',
    priority: 'low',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export function ensureTasksFile() {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(DEFAULT_TASKS, null, 2), 'utf-8');
  }
}

export function getTasks(): TaskItem[] {
  ensureTasksFile();
  try {
    const data = fs.readFileSync(TASKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read tasks file:", e);
    return DEFAULT_TASKS;
  }
}

export function saveTasks(tasks: TaskItem[]) {
  ensureTasksFile();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}
