/**
 * NekoFree multi-provider definitions.
 * Each provider describes how to authenticate and which env vars to set.
 */

export type ProviderField = {
  key: string
  label: string
  placeholder: string
  mask?: boolean
  envVar?: string
}

export type ProviderModelDef = {
  value: string
  label: string
  description: string
}

export type ProviderDef = {
  id: string
  label: string
  description: string
  baseUrl?: string // fixed base URL (omit for SDK default or provider-managed)
  fields: ProviderField[]
  /** OAuth provider — launches browser-based login instead of field input */
  oauth?: 'claude-ai' | 'console' | 'codex'
  /** Available models for /model picker (omit to use default Anthropic picker) */
  models?: ProviderModelDef[]
  /** Set additional env vars when this provider is active */
  envSetup: (config: Record<string, string>) => void
  /** Clear provider-specific env vars (called before switching) */
  envClear: () => void
}

function clearAllProviderEnvVars(): void {
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.CLAUDE_CODE_USE_BEDROCK
  delete process.env.CLAUDE_CODE_USE_VERTEX
  delete process.env.CLAUDE_CODE_USE_FOUNDRY
  delete process.env.CLAUDE_CODE_USE_OPENAI
  delete process.env.NEKOFREE_OPENAI_COMPAT
  delete process.env.NEKOFREE_VISION_SUPPORT
  delete process.env.AWS_REGION
  delete process.env.ANTHROPIC_VERTEX_PROJECT_ID
  delete process.env.CLOUD_ML_REGION
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Direct',
    description: 'Прямой доступ к API Anthropic (console.anthropic.com)',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-...', mask: true },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'nekocode',
    label: 'Nekocode Gateway',
    description: 'Роутер nekocode.app — единый ключ для всех моделей',
    baseUrl: 'https://gateway.nekocode.app/alpha',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'gateway-ключ или sk-ant-...', mask: true },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.ANTHROPIC_BASE_URL = 'https://gateway.nekocode.app/alpha'
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Агрегатор моделей openrouter.ai',
    baseUrl: 'https://openrouter.ai/api/v1',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-or-...', mask: true },
    ],
    models: [
      { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Anthropic Opus' },
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Anthropic Sonnet' },
      { value: 'openai/gpt-5.4', label: 'GPT-5.4', description: 'OpenAI' },
      { value: 'openai/o3', label: 'o3', description: 'OpenAI reasoning' },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Google' },
      { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', description: 'DeepSeek reasoning' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3', description: 'DeepSeek chat' },
      { value: 'zhipu/glm-4.7', label: 'GLM 4.7', description: 'Zhipu AI coding' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.ANTHROPIC_BASE_URL = 'https://openrouter.ai/api/v1'
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'bedrock',
    label: 'AWS Bedrock',
    description: 'Amazon Bedrock (авторизация через AWS IAM credentials)',
    fields: [
      { key: 'region', label: 'AWS Region', placeholder: 'us-east-1' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.CLAUDE_CODE_USE_BEDROCK = '1'
      if (config.region) process.env.AWS_REGION = config.region
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    description: 'Google Cloud Vertex AI (авторизация через GCP ADC)',
    fields: [
      { key: 'projectId', label: 'GCP Project ID', placeholder: 'my-project-123' },
      { key: 'region', label: 'Region', placeholder: 'us-central1' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.CLAUDE_CODE_USE_VERTEX = '1'
      if (config.projectId) process.env.ANTHROPIC_VERTEX_PROJECT_ID = config.projectId
      if (config.region) process.env.CLOUD_ML_REGION = config.region
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'claude-oauth',
    label: 'Claude.ai (OAuth)',
    description: 'Вход через аккаунт Claude — Pro / Max / Team / Enterprise',
    oauth: 'claude-ai',
    fields: [],
    envSetup() {
      clearAllProviderEnvVars()
      // OAuth tokens are managed by secure storage, no env vars needed
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'console-oauth',
    label: 'Anthropic Console (OAuth)',
    description: 'Вход через Anthropic Console — создаёт управляемый API-ключ',
    oauth: 'console',
    fields: [],
    envSetup() {
      clearAllProviderEnvVars()
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'codex-oauth',
    label: 'OpenAI Codex (OAuth)',
    description: 'Вход через аккаунт OpenAI — ChatGPT Plus / Pro',
    oauth: 'codex',
    fields: [],
    models: [
      { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', description: 'Frontier agentic coding model' },
      { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', description: 'Codex coding model' },
      { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', description: 'Быстрая модель' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', description: 'Max модель' },
      { value: 'gpt-5.4', label: 'GPT-5.4', description: 'Последняя GPT' },
      { value: 'gpt-5.2', label: 'GPT-5.2', description: 'GPT-5.2' },
    ],
    envSetup() {
      clearAllProviderEnvVars()
      process.env.CLAUDE_CODE_USE_OPENAI = '1'
      if (!process.env.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = 'gpt-5.2-codex'
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'glm',
    label: 'GLM (Z.AI)',
    description: 'Zhipu AI — GLM-4.7, GLM-5 и другие модели (z.ai)',
    baseUrl: 'https://api.z.ai/api/anthropic',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'xxxxxxxx.xxxxxxxxxxxxxxxx', mask: true },
    ],
    models: [
      { value: 'glm-5.1', label: 'GLM 5.1', description: 'Новейший флагман Zhipu AI' },
      { value: 'glm-5', label: 'GLM 5', description: 'Флагманская модель' },
      { value: 'glm-5-turbo', label: 'GLM 5 Turbo', description: 'Быстрая версия GLM 5' },
      { value: 'glm-4.7', label: 'GLM 4.7', description: '358B MoE, лидер open-source coding' },
      { value: 'glm-4.7-flash', label: 'GLM 4.7 Flash', description: 'Быстрая версия GLM 4.7' },
      { value: 'glm-4.6', label: 'GLM 4.6', description: 'Предыдущее поколение' },
      { value: 'glm-4.5', label: 'GLM 4.5', description: 'Thinking / reasoning модель' },
      { value: 'glm-4.5-flash', label: 'GLM 4.5 Flash', description: 'Быстрая reasoning модель' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic'
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
      if (!config.model) process.env.ANTHROPIC_MODEL = 'glm-4.7'
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    description: 'Fireworks — быстрый inference: Qwen, GLM, Llama, DeepSeek (fireworks.ai)',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'fw_...', mask: true },
    ],
    models: [
      { value: 'accounts/fireworks/models/qwen3-235b-a22b', label: 'Qwen3 235B', description: 'Qwen3 235B MoE flagship' },
      { value: 'accounts/fireworks/models/deepseek-v3', label: 'DeepSeek V3', description: '671B MoE coding model' },
      { value: 'accounts/fireworks/models/llama4-maverick-instruct-basic', label: 'Llama 4 Maverick', description: 'Meta Llama 4 400B MoE' },
      { value: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B', description: 'Meta Llama 3.3 70B' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.NEKOFREE_OPENAI_COMPAT = '1'
      process.env.ANTHROPIC_BASE_URL = 'https://api.fireworks.ai/inference/v1'
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear() {
      clearAllProviderEnvVars()
    },
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    description: 'OpenCode gateway — кураторский набор моделей (opencode.ai)',
    baseUrl: 'https://api.opencode.ai/v1',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', mask: true },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      process.env.ANTHROPIC_BASE_URL = 'https://api.opencode.ai/v1'
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear: clearAllProviderEnvVars,
  },
  {
    id: 'custom',
    label: 'Свой endpoint',
    description: 'Любой Anthropic-совместимый или OpenAI-совместимый API',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://my-proxy.example.com/v1' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', mask: true },
      { key: 'openaiCompat', label: 'OpenAI-формат? (y/n)', placeholder: 'n' },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      if (config.baseUrl) process.env.ANTHROPIC_BASE_URL = config.baseUrl
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
      if (config.openaiCompat === 'y' || config.openaiCompat === 'yes') {
        process.env.NEKOFREE_OPENAI_COMPAT = '1'
      }
    },
    envClear: clearAllProviderEnvVars,
  },
]

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id)
}

/** Get model catalog for active provider (if provider has custom models) */
export function getActiveProviderModels(): ProviderModelDef[] | undefined {
  const configDir = require('node:path').join(
    process.env.NEKOFREE_CONFIG_DIR || require('node:path').join(require('node:os').homedir(), '.nekofree'),
  )
  const configPath = require('node:path').join(configDir, 'config.json')
  try {
    if (require('node:fs').existsSync(configPath)) {
      const raw = JSON.parse(require('node:fs').readFileSync(configPath, 'utf-8'))
      const config = migrateConfig(raw)
      const provider = getProvider(config.activeProvider)
      return provider?.models
    }
  } catch { /* ignore */ }
  return undefined
}

export type NfProviderConfig = Record<string, string>

export type NfConfig = {
  activeProvider: string
  providers: Record<string, NfProviderConfig>
}

/** Migrate old flat config format to new multi-provider format */
export function migrateConfig(raw: Record<string, unknown>): NfConfig {
  // Already new format
  if (typeof raw.activeProvider === 'string' && raw.providers) {
    return raw as unknown as NfConfig
  }

  // Old format: { baseUrl, apiKey, model }
  const baseUrl = (raw.baseUrl as string) || ''
  const apiKey = (raw.apiKey as string) || ''
  const model = (raw.model as string) || ''

  let activeProvider: string
  const providerConfig: NfProviderConfig = {}
  if (apiKey) providerConfig.apiKey = apiKey
  if (model) providerConfig.model = model

  if (baseUrl.includes('nekocode')) {
    activeProvider = 'nekocode'
  } else if (baseUrl.includes('openrouter')) {
    activeProvider = 'openrouter'
  } else if (!baseUrl || baseUrl.includes('api.anthropic.com')) {
    activeProvider = 'anthropic'
  } else {
    activeProvider = 'custom'
    providerConfig.baseUrl = baseUrl
  }

  return {
    activeProvider,
    providers: { [activeProvider]: providerConfig },
  }
}
