// ──────────────────────────────────────────────────────────────────────
// Model Provider Configuration types & defaults
// Sourced from farobot_litellm_guide.py & ai_service .env
// ──────────────────────────────────────────────────────────────────────

export type ProviderType = 'farobot' | 'azure_openai' | 'ollama' | 'openai' | 'gemini' | 'claude';
export type ModelCategory = 'chat' | 'reasoning' | 'code' | 'image' | 'embedding' | 'ocr';

export interface ModelDefinition {
  id: string;
  name: string;
  category: ModelCategory;
  note?: string;
  requiresMinTokens?: number;
}

export interface ProviderConfig {
  id: ProviderType;
  label: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  selectedModel: string;
  /** Only for Ollama: host URL for listing models */
  ollamaHost?: string;
  /** Azure extras */
  deploymentName?: string;
  apiVersion?: string;
}

// ── FArobot LiteLLM Catalog ────────────────────────────────────────────
export const FAROBOT_MODELS: ModelDefinition[] = [
  { id: 'gpt-4.1',           name: 'GPT-4.1',              category: 'chat',      note: '推薦，通用高品質' },
  { id: 'gpt-4.1-mini',      name: 'GPT-4.1 Mini',         category: 'chat',      note: '輕量快速' },
  { id: 'gpt-4o',            name: 'GPT-4o',                category: 'chat',      note: '多模態' },
  { id: 'gpt-5-chat',        name: 'GPT-5 Chat',            category: 'chat',      note: '最新 GPT-5' },
  { id: 'gpt-5.4-mini',      name: 'GPT-5.4 Mini',          category: 'chat',      note: 'GPT-5 輕量版' },
  { id: 'gpt-5-mini',        name: 'GPT-5 Mini',            category: 'reasoning', note: 'max_tokens >= 200', requiresMinTokens: 200 },
  { id: 'gpt-5-nano',        name: 'GPT-5 Nano',            category: 'reasoning', note: 'max_tokens >= 200', requiresMinTokens: 200 },
  { id: 'deepseek-v4-pro',   name: 'DeepSeek V4 Pro',       category: 'chat',      note: 'DeepSeek 旗艦' },
  { id: 'mistral-large-3',   name: 'Mistral Large 3',       category: 'chat',      note: 'Mistral 旗艦' },
  { id: 'kimi-k2.6',         name: 'Kimi K2.6',             category: 'reasoning', note: 'max_tokens >= 200', requiresMinTokens: 200 },
  { id: 'gpt-5.3-codex',     name: 'GPT-5.3 Codex',         category: 'code',      note: '走 /v1/responses endpoint' },
  { id: 'gpt-image-2',       name: 'GPT Image 2',           category: 'image',     note: '圖片生成' },
  { id: 'text-embedding-3-large', name: 'Text Embedding 3 Large', category: 'embedding', note: '3072 維，高精度' },
  { id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', category: 'embedding', note: '1536 維，快速' },
  { id: 'mistral-document-ai-2512', name: 'Mistral OCR',    category: 'ocr',       note: '走 /ocr，PDF/圖片轉文字' },
];

// ── Default Provider Configs ───────────────────────────────────────────
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'farobot',
    label: 'FArobot AI Foundry',
    endpoint: 'https://ai-foundry.farobottech.com:4443',
    apiKey: '',
    enabled: false,
    selectedModel: 'gpt-4.1',
  },
  {
    id: 'azure_openai',
    label: 'Azure OpenAI',
    endpoint: 'https://far-ai-eastus2.openai.azure.com/',
    apiKey: '',
    enabled: false,
    selectedModel: 'gpt-5.4-mini',
    deploymentName: 'gpt-5.4-mini',
    apiVersion: '2024-12-01-preview',
  },
  {
    id: 'openai',
    label: 'OpenAI (Direct)',
    endpoint: 'https://api.openai.com',
    apiKey: '',
    enabled: false,
    selectedModel: 'gpt-4o',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    enabled: false,
    selectedModel: 'gemini-1.5-pro',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com',
    apiKey: '',
    enabled: false,
    selectedModel: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    endpoint: 'http://localhost:11434',
    apiKey: '',
    enabled: true,
    selectedModel: '',
    ollamaHost: 'http://localhost:11434',
  },
];

// ── Shared Profile / Permissions Types ────────────────────────────────

export interface ProviderParams {
  temperature: number;
  topP: number;
  systemPrompt: string;
}

export interface Permissions {
  executeTerminal: boolean;
  readFile: boolean;
  writeFile: boolean;
  internetAccess: boolean;
  executeGit?: boolean;
}

export interface ProfileConfig {
  activeProfile: string;
  temperature: number;
  topP: number;
  systemPrompt: string;
  providerSettings: Record<string, ProviderParams>;
  permissions: Permissions;
}

export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful coding assistant designed to help developers build secure local desktop automation applications.';

export const DEFAULT_PROFILE: ProfileConfig = {
  activeProfile: 'ollama',
  temperature: 0.7,
  topP: 0.9,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  providerSettings: {},
  permissions: {
    executeTerminal: true,
    readFile: true,
    writeFile: false,
    internetAccess: true,
    executeGit: false,
  },
};
