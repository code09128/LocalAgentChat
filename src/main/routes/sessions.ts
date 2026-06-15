import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { LOCAL_SMART_DIR } from '../config.js';

const SESSIONS_FILE = path.join(LOCAL_SMART_DIR, 'sessions.json');

interface SessionMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export interface SessionItem {
  id: string;
  title: string;
  date: string;
  preview: string;
  messages: SessionMessage[];
}

export function getSessions(): SessionItem[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read sessions file:', e);
    writeLog('ERROR', `Failed to read sessions file: ${e}`);
  }
  return [];
}

export function saveSessions(sessions: SessionItem[]): void {
  fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

const router = Router();

router.get('/sessions', (_req, res) => {
  res.json(getSessions());
});

router.get('/sessions/:id', (req, res) => {
  const { id } = req.params;
  const session = getSessions().find(s => s.id === id);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

router.delete('/sessions', (_req, res) => {
  saveSessions([]);
  res.json({ success: true });
});

export default router;
