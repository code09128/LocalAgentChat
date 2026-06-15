import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { LOCAL_SMART_DIR } from '../config.js';
import {
  ProfileConfig,
  DEFAULT_PROFILE,
  DEFAULT_SYSTEM_PROMPT,
  ProviderParams,
} from '../../shared/model-providers.js';

const PROFILE_FILE = path.join(LOCAL_SMART_DIR, 'profile.json');

export function getActiveProviderParams(profile: ProfileConfig): ProviderParams {
  const ps = profile.providerSettings?.[profile.activeProfile];
  return {
    temperature: ps?.temperature ?? profile.temperature,
    topP:        ps?.topP        ?? profile.topP,
    systemPrompt:ps?.systemPrompt ?? profile.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  };
}

export function getProfile(): ProfileConfig {
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read profile file:', e);
    writeLog('ERROR', `Failed to read profile file: ${e}`);
  }
  return DEFAULT_PROFILE;
}

function saveProfile(profile: ProfileConfig): void {
  fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true });
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
  writeLog('INFO', `System: Agent profile updated (Active Profile: ${profile.activeProfile})`);
}

const router = Router();

router.get('/profile', (_req, res) => {
  res.json(getProfile());
});

router.post('/profile', (req, res) => {
  const profile: ProfileConfig = req.body;
  if (!profile || typeof profile.activeProfile !== 'string') {
    return res.status(400).json({ error: 'Invalid profile payload' });
  }
  saveProfile(profile);
  res.json({ success: true });
});

export default router;
