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

export type ProviderDef = {
  id: string
  label: string
  description: string
  baseUrl?: string // fixed base URL (omit for SDK default or provider-managed)
  fields: ProviderField[]
  /** Set additional env vars when this provider is active */
  envSetup: (config: Record<string, string>) => void
  /** Clear provider-specific env vars (called before switching) */
  envClear: () => void
}

function clearAllProviderEnvVars(): void {
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.CLAUDE_CODE_USE_BEDROCK
  delete process.env.CLAUDE_CODE_USE_VERTEX
  delete process.env.CLAUDE_CODE_USE_FOUNDRY
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
    id: 'custom',
    label: 'Свой endpoint',
    description: 'Любой OpenAI-совместимый API или прокси',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://my-proxy.example.com/v1' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', mask: true },
    ],
    envSetup(config) {
      clearAllProviderEnvVars()
      if (config.baseUrl) process.env.ANTHROPIC_BASE_URL = config.baseUrl
      if (config.apiKey) process.env.ANTHROPIC_API_KEY = config.apiKey
    },
    envClear: clearAllProviderEnvVars,
  },
]

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id)
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
