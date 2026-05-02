import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Select } from '../../components/CustomSelect/select.js'
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow.js'
import { runCodexOAuthFlow } from '../../services/oauth/codex-client.js'
import { saveCodexOAuthTokens } from '../../utils/auth.js'
import { Spinner } from '../../components/Spinner.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  listConnections,
  loadConnection,
  saveConnection,
} from '../../nekofree/auth/storage.js'
import { runOAuthFlow } from '../../nekofree/auth/oauth-client.js'
import { validateConnection } from '../../nekofree/auth/validator.js'
import { AUTH_PRESETS, buildConnectionFromPreset } from '../../nekofree/auth/presets.js'
import type { AuthConnection } from '../../nekofree/auth/types.js'
import {
  PROVIDERS,
  getProvider,
  migrateConfig,
  type NfConfig,
  type NfProviderConfig,
} from './providers.js'

/**
 * Read NekoFree provider config from GlobalConfig (same config.json, single source of truth).
 * Uses the locked config system to avoid race conditions with GlobalConfig writes.
 */
function readConfig(): NfConfig {
  const raw = getGlobalConfig() as Record<string, unknown>
  if (typeof raw.activeProvider === 'string' && raw.providers) {
    return { activeProvider: raw.activeProvider, providers: raw.providers as Record<string, NfProviderConfig> }
  }
  return migrateConfig(raw)
}

/**
 * Save NekoFree provider config through GlobalConfig's locked write system.
 * This prevents race conditions with concurrent GlobalConfig writes (numStartups, tips, etc.).
 */
function saveConfig(config: NfConfig): void {
  saveGlobalConfig(current => ({
    ...current,
    activeProvider: config.activeProvider,
    providers: config.providers,
  } as typeof current))
}

function maskKey(key: string): string {
  if (key.length <= 12) return '***'
  return key.slice(0, 8) + '...' + key.slice(-4)
}

function applyProvider(providerId: string, providerConfig: NfProviderConfig): void {
  const def = getProvider(providerId)
  if (def) def.envSetup(providerConfig)
}

function formatProviderStatus(config: NfConfig): string {
  const lines: string[] = []
  for (const p of PROVIDERS) {
    const pc = config.providers[p.id]
    const active = config.activeProvider === p.id ? ' ← активный' : ''
    if (pc) {
      const details = Object.entries(pc)
        .map(([k, v]) => k === 'apiKey' ? `${k}: ${maskKey(v)}` : `${k}: ${v}`)
        .join(', ')
      lines.push(`  ✓ ${p.label} (${details})${active}`)
    } else {
      lines.push(`  · ${p.label} — не настроен${active}`)
    }
  }
  return lines.join('\n')
}

// ── Codex OAuth (separate from ConsoleOAuthFlow) ──

function CodexOAuthWizard({ onDone, onCancel }: {
  onDone: () => void
  onCancel: () => void
}) {
  const [status, setStatus] = React.useState<'starting' | 'waiting' | 'success' | 'error'>('starting')
  const [url, setUrl] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const tokens = await runCodexOAuthFlow(async (authUrl) => {
          if (!cancelled) {
            setUrl(authUrl)
            setStatus('waiting')
          }
        })
        if (!cancelled) {
          saveCodexOAuthTokens(tokens)
          setStatus('success')
          onDone()
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
          setStatus('error')
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Dialog title="OpenAI Codex — OAuth" onCancel={onCancel}>
      <Box flexDirection="column">
        {status === 'starting' && (
          <Box><Spinner /><Text> Запуск авторизации OpenAI...</Text></Box>
        )}
        {status === 'waiting' && (
          <Box flexDirection="column">
            <Text>Откройте ссылку в браузере для авторизации:</Text>
            <Text color="cyan">{url}</Text>
            <Box marginTop={1}><Text dimColor>Ожидание ответа... (ESC для отмены)</Text></Box>
          </Box>
        )}
        {status === 'error' && (
          <Box flexDirection="column">
            <Text color="red">Ошибка: {error}</Text>
            <Text dimColor>ESC для возврата</Text>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}

// ── Wizard states ──

type WizardState =
  | { step: 'select' }
  | { step: 'field'; providerId: string; fieldIdx: number; values: Record<string, string> }
  | { step: 'oauth'; providerId: string }
  | { step: 'generic-select' }
  | { step: 'generic-preset' }
  | { step: 'generic-preset-credential'; presetId: string }
  | { step: 'generic-create'; fieldIdx: number; values: Record<string, string>; authType?: string }
  | { step: 'generic-oauth'; connection: AuthConnection }

function LoginWizard({ onDone, onLoginSuccess, initialProvider }: {
  onDone: LocalJSXCommandOnDone
  onLoginSuccess: () => void
  initialProvider?: string
}) {
  const config = React.useMemo(() => readConfig(), [])

  const [state, setState] = React.useState<WizardState>(() => {
    if (initialProvider) {
      const def = getProvider(initialProvider)
      if (def) {
        // OAuth providers → go straight to OAuth flow
        if (def.oauth) {
          return { step: 'oauth', providerId: initialProvider }
        }
        const existing = config.providers[initialProvider] || {}
        if (def.fields.length === 0) {
          // No fields needed — just activate
          return { step: 'select' } // will be handled in effect
        }
        return { step: 'field', providerId: initialProvider, fieldIdx: 0, values: { ...existing } }
      }
    }
    return { step: 'select' }
  })

  // Handle no-field non-OAuth provider activation via initialProvider
  React.useEffect(() => {
    if (initialProvider && state.step === 'select') {
      const def = getProvider(initialProvider)
      if (def && def.fields.length === 0 && !def.oauth) {
        config.activeProvider = initialProvider
        if (!config.providers[initialProvider]) config.providers[initialProvider] = {}
        saveConfig(config)
        applyProvider(initialProvider, config.providers[initialProvider]!)
        onLoginSuccess()
        onDone(`Провайдер переключён на ${def.label}.`, { display: 'system' })
      }
    }
  }, [])

  const [inputValue, setInputValue] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)
  const columns = Math.max(20, useTerminalSize().columns - 4)

  // ── Provider selection ──

  const options = React.useMemo(() =>
    PROVIDERS.map(p => {
      const configured = !!config.providers[p.id]
      const active = config.activeProvider === p.id
      const mark = active ? ' ● ' : configured ? ' ✓ ' : '   '
      return {
        label: `${mark}${p.label}`,
        value: p.id,
        description: p.description,
      }
    }),
  [config])

  const handleProviderSelect = React.useCallback((providerId: string) => {
    const def = getProvider(providerId)
    if (!def) return

    // OAuth providers → launch OAuth flow
    if (def.oauth) {
      setState({ step: 'oauth', providerId })
      return
    }

    // Generic Auth provider → show connection selector
    if (providerId === 'generic') {
      setState({ step: 'generic-select' })
      return
    }

    if (def.fields.length === 0) {
      // No fields — just switch
      config.activeProvider = providerId
      if (!config.providers[providerId]) config.providers[providerId] = {}
      saveConfig(config)
      applyProvider(providerId, config.providers[providerId]!)
      onLoginSuccess()
      onDone(`Провайдер: ${def.label}.`, { display: 'system' })
      return
    }

    const existing = config.providers[providerId] || {}
    setState({ step: 'field', providerId, fieldIdx: 0, values: { ...existing } })
    setInputValue(existing[def.fields[0]!.key] || '')
    setCursorOffset(0)
  }, [config, onDone])

  const handleCancel = React.useCallback(() => {
    onDone('Отменено.', { display: 'system' })
  }, [onDone])

  // ESC in field step → go back to provider selection (or previous field)
  const handleFieldCancel = React.useCallback(() => {
    if (state.step !== 'field') return
    const def = getProvider(state.providerId)
    if (def && state.fieldIdx > 0) {
      // Go back to previous field
      const prevField = def.fields[state.fieldIdx - 1]!
      setState({ ...state, fieldIdx: state.fieldIdx - 1 })
      setInputValue(state.values[prevField.key] || '')
      setCursorOffset(0)
    } else {
      // Go back to provider selection
      setState({ step: 'select' })
      setInputValue('')
    }
  }, [state])

  // ── OAuth completion ──

  const handleOAuthDone = React.useCallback(() => {
    if (state.step !== 'oauth') return
    const def = getProvider(state.providerId)
    config.activeProvider = state.providerId
    if (!config.providers[state.providerId]) config.providers[state.providerId] = {}
    saveConfig(config)
    applyProvider(state.providerId, config.providers[state.providerId]!)
    onLoginSuccess()
    onDone(
      `OAuth авторизация завершена (${def?.label || state.providerId}).`,
      { display: 'system' },
    )
  }, [state, config, onDone])

  // ── Field input ──

  const handleFieldSubmit = React.useCallback((input: string) => {
    if (state.step !== 'field') return
    const def = getProvider(state.providerId)
    if (!def) return

    const field = def.fields[state.fieldIdx]!
    const trimmed = input.trim()

    if (field.mask && trimmed.length < 5) {
      onDone('Ошибка: значение слишком короткое.', { display: 'system' })
      return
    }

    const newValues = { ...state.values, [field.key]: trimmed }
    const nextIdx = state.fieldIdx + 1

    if (nextIdx < def.fields.length) {
      // More fields to fill
      const nextField = def.fields[nextIdx]!
      setState({ ...state, fieldIdx: nextIdx, values: newValues })
      setInputValue(newValues[nextField.key] || '')
      setCursorOffset(0)
    } else {
      // All fields filled — save
      config.activeProvider = state.providerId
      config.providers[state.providerId] = newValues
      saveConfig(config)
      applyProvider(state.providerId, newValues)

      const summary = Object.entries(newValues)
        .map(([k, v]) => k === 'apiKey' ? `${k}: ${maskKey(v as string)}` : `${k}: ${v}`)
        .join(', ')
      onLoginSuccess()
      onDone(
        `Провайдер: ${def.label}\n${summary}`,
        { display: 'system' },
      )
    }
  }, [state, config, onDone])

  // ── Generic Auth handlers ──

  const genericConnections = React.useMemo(() => listConnections(), [state])

  const handleGenericSelect = React.useCallback((connectionId: string) => {
    if (connectionId === '__new__') {
      setState({ step: 'generic-preset' })
      return
    }
    // Activate existing connection
    config.activeProvider = 'generic'
    config.providers.generic = { connectionId }
    saveConfig(config)
    applyProvider('generic', config.providers.generic!)
    onLoginSuccess()
    const conn = loadConnection(connectionId)
    onDone(
      `Generic Auth: ${conn?.name || connectionId} (${conn?.auth.type || 'unknown'})`,
      { display: 'system' },
    )
  }, [config, onDone])

  const handleGenericCreateSubmit = React.useCallback((input: string) => {
    if (state.step !== 'generic-create') return
    const trimmed = input.trim()

    const fields = ['id', 'name', 'baseUrl', 'authType', 'credential']
    const field = fields[state.fieldIdx]!
    const newValues = { ...state.values, [field]: trimmed }
    const nextIdx = state.fieldIdx + 1

    if (field === 'authType') {
      setState({ ...state, fieldIdx: nextIdx, values: newValues, authType: trimmed })
      setInputValue('')
      setCursorOffset(0)
      return
    }

    if (nextIdx < fields.length) {
      setState({ ...state, fieldIdx: nextIdx, values: newValues })
      setInputValue('')
      setCursorOffset(0)
    } else {
      // All fields filled — create connection
      const authType = (state.authType || newValues.authType || 'bearer') as AuthConnection['auth']['type']
      let auth: AuthConnection['auth']
      switch (authType) {
        case 'apiKey':
          auth = { type: 'apiKey', in: 'header', name: 'X-API-Key', value: newValues.credential || '' }
          break
        case 'bearer':
          auth = { type: 'bearer', token: newValues.credential || '' }
          break
        case 'basic': {
          const [user, pass] = (newValues.credential || ':').split(':')
          auth = { type: 'basic', username: user || '', password: pass || '' }
          break
        }
        case 'oauth2': {
          auth = { type: 'oauth2', clientId: newValues.credential || '', accessToken: '' }
          const conn: AuthConnection = {
            id: newValues.id || 'default',
            name: newValues.name || newValues.id || 'Untitled',
            baseUrl: newValues.baseUrl || undefined,
            auth,
            createdAt: new Date().toISOString(),
          }
          saveConnection(conn)
          // Launch browser OAuth flow
          setState({ step: 'generic-oauth', connection: conn })
          return
        }
        default:
          auth = { type: 'bearer', token: newValues.credential || '' }
      }

      const conn: AuthConnection = {
        id: newValues.id || 'default',
        name: newValues.name || newValues.id || 'Untitled',
        baseUrl: newValues.baseUrl || undefined,
        auth,
        createdAt: new Date().toISOString(),
      }
      saveConnection(conn)

      config.activeProvider = 'generic'
      config.providers.generic = { connectionId: conn.id }
      saveConfig(config)
      applyProvider('generic', config.providers.generic!)
      onLoginSuccess()
      onDone(
        `Generic Auth создан: ${conn.name} (${auth.type})`,
        { display: 'system' },
      )
    }
  }, [state, config, onDone])

  // ── Generic preset handlers ──

  const handlePresetSelect = React.useCallback((presetId: string) => {
    if (presetId === '__custom__') {
      setState({ step: 'generic-create', fieldIdx: 0, values: {} })
      setInputValue('')
      setCursorOffset(0)
      return
    }
    const preset = AUTH_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    if (preset.authType === 'oauth2') {
      // OAuth2 presets not yet supported via presets flow
      onDone('OAuth2 presets требуют ручной настройки через Custom.', { display: 'system' })
      return
    }
    setState({ step: 'generic-preset-credential', presetId })
    setInputValue('')
    setCursorOffset(0)
  }, [onDone])

  const handlePresetCredentialSubmit = React.useCallback((input: string) => {
    if (state.step !== 'generic-preset-credential') return
    const preset = AUTH_PRESETS.find(p => p.id === state.presetId)
    if (!preset) return
    const trimmed = input.trim()
    const conn = buildConnectionFromPreset(preset, trimmed)
    saveConnection(conn)

    config.activeProvider = 'generic'
    config.providers.generic = { connectionId: conn.id }
    saveConfig(config)
    applyProvider('generic', config.providers.generic!)
    onLoginSuccess()
    onDone(
      `Generic Auth: ${conn.name} (${conn.auth.type})`,
      { display: 'system' },
    )
  }, [state, config, onDone])

  // ── Generic OAuth completion ──

  const handleGenericOAuthDone = React.useCallback(async (conn: AuthConnection) => {
    const health = await validateConnection(conn)
    config.activeProvider = 'generic'
    config.providers.generic = { connectionId: conn.id }
    saveConfig(config)
    applyProvider('generic', config.providers.generic!)
    onLoginSuccess()
    const healthMsg = health.ok ? '✓ Health check passed' : `⚠ Health check: ${health.error}`
    onDone(
      `OAuth авторизация завершена: ${conn.name}\n${healthMsg}`,
      { display: 'system' },
    )
  }, [config, onDone])

  // ── Render ──

  if (state.step === 'select') {
    return (
      <Dialog title="NekoFree — выбор провайдера" onCancel={handleCancel}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Выберите API-провайдер:</Text>
          </Box>
          <Select
            options={options}
            onChange={handleProviderSelect}
            onCancel={handleCancel}
            visibleOptionCount={8}
            layout="compact-vertical"
          />
        </Box>
      </Dialog>
    )
  }

  if (state.step === 'field') {
    const def = getProvider(state.providerId)!
    const field = def.fields[state.fieldIdx]!
    const stepText = def.fields.length > 1
      ? ` (${state.fieldIdx + 1}/${def.fields.length})`
      : ''

    return (
      <Dialog
        title={`${def.label}${stepText}`}
        onCancel={handleFieldCancel}
      >
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>{field.label}:</Text>
          </Box>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleFieldSubmit}
            placeholder={field.placeholder}
            mask={field.mask ? '*' : undefined}
            focus={true}
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor={true}
          />
        </Box>
      </Dialog>
    )
  }

  if (state.step === 'oauth') {
    const def = getProvider(state.providerId)!

    // Codex uses its own OAuth flow (OpenAI, not Anthropic)
    if (def.oauth === 'codex') {
      return (
        <CodexOAuthWizard
          onDone={handleOAuthDone}
          onCancel={() => setState({ step: 'select' })}
        />
      )
    }

    // Claude.ai / Console — use ConsoleOAuthFlow with forced method
    const forceMethod = def.oauth === 'claude-ai' ? 'claudeai' as const : 'console' as const
    return (
      <Dialog
        title={`${def.label} — OAuth`}
        onCancel={() => {
          setState({ step: 'select' })
        }}
      >
        <ConsoleOAuthFlow
          onDone={handleOAuthDone}
          forceLoginMethod={forceMethod}
        />
      </Dialog>
    )
  }

  // ── Generic Auth: select connection ──

  if (state.step === 'generic-select') {
    const connOptions = genericConnections.map(c => ({
      label: `${c.name} (${c.id}) — ${c.auth.type}`,
      value: c.id,
      description: c.baseUrl || '—',
    }))
    connOptions.push({
      label: '+ Создать новое подключение',
      value: '__new__',
      description: 'Настроить новый REST API',
    })

    return (
      <Dialog title="Generic Auth — выбор подключения" onCancel={handleCancel}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Выберите сохранённое подключение или создайте новое:</Text>
          </Box>
          <Select
            options={connOptions}
            onChange={handleGenericSelect}
            onCancel={handleCancel}
            visibleOptionCount={8}
            layout="compact-vertical"
          />
        </Box>
      </Dialog>
    )
  }

  // ── Generic Auth: create connection ──

  if (state.step === 'generic-create') {
    const fields = ['id', 'name', 'baseUrl', 'authType', 'credential']
    const labels: Record<string, string> = {
      id: 'ID подключения (уникальный ключ)',
      name: 'Название',
      baseUrl: 'Base URL (опционально)',
      authType: 'Тип авторизации (apiKey / bearer / basic / oauth2)',
      credential: 'Ключ / токен / username:password',
    }
    const placeholders: Record<string, string> = {
      id: 'my-api',
      name: 'My API',
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      credential: 'sk-... или user:pass',
    }
    const field = fields[state.fieldIdx]!
    const stepText = ` (${state.fieldIdx + 1}/${fields.length})`

    return (
      <Dialog
        title={`Новое подключение${stepText}`}
        onCancel={() => setState({ step: 'generic-select' })}
      >
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>{labels[field]}:</Text>
          </Box>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleGenericCreateSubmit}
            placeholder={placeholders[field]}
            focus={true}
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor={true}
          />
        </Box>
      </Dialog>
    )
  }

  // ── Generic OAuth browser flow ──

  if (state.step === 'generic-oauth') {
    const [oauthStatus, setOauthStatus] = React.useState<'starting' | 'waiting' | 'success' | 'error'>('starting')
    const [oauthUrl, setOauthUrl] = React.useState('')
    const [oauthError, setOauthError] = React.useState('')

    React.useEffect(() => {
      let cancelled = false
      void (async () => {
        try {
          const updated = await runOAuthFlow(state.connection, (url) => {
            if (!cancelled) {
              setOauthUrl(url)
              setOauthStatus('waiting')
            }
          })
          if (!cancelled) {
            setOauthStatus('success')
            await handleGenericOAuthDone(updated)
          }
        } catch (err) {
          if (!cancelled) {
            setOauthError((err as Error).message)
            setOauthStatus('error')
          }
        }
      })()
      return () => { cancelled = true }
    }, [state.connection])

    return (
      <Dialog title="Generic OAuth — авторизация" onCancel={() => setState({ step: 'generic-select' })}>
        <Box flexDirection="column">
          {oauthStatus === 'starting' && (
            <Box><Spinner /><Text> Запуск OAuth...</Text></Box>
          )}
          {oauthStatus === 'waiting' && (
            <Box flexDirection="column">
              <Text>Откройте ссылку в браузере:</Text>
              <Text color="cyan">{oauthUrl}</Text>
              <Box marginTop={1}><Text dimColor>Ожидание ответа... (ESC для отмены)</Text></Box>
            </Box>
          )}
          {oauthStatus === 'error' && (
            <Box flexDirection="column">
              <Text color="red">Ошибка: {oauthError}</Text>
              <Text dimColor>ESC для возврата</Text>
            </Box>
          )}
        </Box>
      </Dialog>
    )
  }

  // ── Generic Auth: preset selection ──

  if (state.step === 'generic-preset') {
    const presetOptions = AUTH_PRESETS.map(p => ({
      label: p.name,
      value: p.id,
      description: p.description,
    }))
    presetOptions.push({
      label: '→ Свой вариант (ручная настройка)',
      value: '__custom__',
      description: 'Произвольный API с полным контролем',
    })

    return (
      <Dialog title="Generic Auth — выбор сервиса" onCancel={() => setState({ step: 'generic-select' })}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Выберите популярный сервис:</Text>
          </Box>
          <Select
            options={presetOptions}
            onChange={handlePresetSelect}
            onCancel={() => setState({ step: 'generic-select' })}
            visibleOptionCount={8}
            layout="compact-vertical"
          />
        </Box>
      </Dialog>
    )
  }

  // ── Generic Auth: preset credential ──

  if (state.step === 'generic-preset-credential') {
    const preset = AUTH_PRESETS.find(p => p.id === state.presetId)!
    const placeholder = preset.authType === 'basic' ? 'user:password' : 'sk-...'
    const label = preset.authType === 'basic' ? 'Логин:пароль' : 'API Key / Token'

    return (
      <Dialog title={`${preset.name} — авторизация`} onCancel={() => setState({ step: 'generic-preset' })}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>{label}:</Text>
            <Text dimColor>{preset.description}</Text>
          </Box>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handlePresetCredentialSubmit}
            placeholder={placeholder}
            mask={preset.authType !== 'apiKey' && preset.authType !== 'bearer' ? undefined : '*'}
            focus={true}
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor={true}
          />
        </Box>
      </Dialog>
    )
  }

  return null
}

// ── Command entry point ──

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const trimmed = (args || '').trim()
  const onLoginSuccess = () => { context.onChangeAPIKey() }

  // /login --list
  if (trimmed === '--list') {
    const config = readConfig()
    if (!config.activeProvider) {
      onDone('Ни один провайдер не настроен. Используйте /login для настройки.', { display: 'system' })
      return null
    }
    onDone(`Настроенные провайдеры:\n${formatProviderStatus(config)}`, { display: 'system' })
    return null
  }

  // /login --provider <id>
  if (trimmed.startsWith('--provider ')) {
    const providerId = trimmed.slice(11).trim().toLowerCase()
    const def = getProvider(providerId)
    if (!def) {
      const ids = PROVIDERS.map(p => p.id).join(', ')
      onDone(`Неизвестный провайдер: ${providerId}\nДоступные: ${ids}`, { display: 'system' })
      return null
    }

    const config = readConfig()
    const existing = config.providers[providerId]
    if (existing && Object.keys(existing).length > 0) {
      // Already configured — just switch
      config.activeProvider = providerId
      saveConfig(config)
      applyProvider(providerId, existing)
      onLoginSuccess()
      onDone(`Провайдер переключён на ${def.label}.`, { display: 'system' })
      return null
    }

    // Not configured yet — open wizard for this provider
    return <LoginWizard onDone={onDone} onLoginSuccess={onLoginSuccess} initialProvider={providerId} />
  }

  // /login --url <url> (legacy compat → custom provider)
  if (trimmed.startsWith('--url ')) {
    const url = trimmed.slice(6).trim()
    if (!url) {
      onDone('Ошибка: укажите URL после --url', { display: 'system' })
      return null
    }
    const config = readConfig()
    if (!config.providers.custom) config.providers.custom = {}
    config.providers.custom.baseUrl = url
    config.activeProvider = 'custom'
    saveConfig(config)
    applyProvider('custom', config.providers.custom)
    onLoginSuccess()
    onDone(`Custom endpoint: ${url}`, { display: 'system' })
    return null
  }

  // /login --model <model>
  if (trimmed.startsWith('--model ')) {
    const model = trimmed.slice(8).trim()
    if (!model) {
      onDone('Ошибка: укажите модель после --model', { display: 'system' })
      return null
    }
    const config = readConfig()
    const active = config.activeProvider || 'anthropic'
    if (!config.providers[active]) config.providers[active] = {}
    config.providers[active]!.model = model
    saveConfig(config)
    process.env.ANTHROPIC_MODEL = model
    onLoginSuccess()
    onDone(`Модель: ${model} (провайдер: ${active})`, { display: 'system' })
    return null
  }

  // /login <key> — quick save to active provider
  if (trimmed && !trimmed.startsWith('--')) {
    if (trimmed.length < 10) {
      onDone('Ошибка: ключ слишком короткий.', { display: 'system' })
      return null
    }
    const config = readConfig()
    const active = config.activeProvider || 'anthropic'
    if (!config.providers[active]) config.providers[active] = {}
    config.providers[active]!.apiKey = trimmed
    config.activeProvider = active
    saveConfig(config)
    applyProvider(active, config.providers[active]!)

    const def = getProvider(active)
    onLoginSuccess()
    onDone(
      `API-ключ сохранён для ${def?.label || active}: ${maskKey(trimmed)}`,
      { display: 'system' },
    )
    return null
  }

  // /login — interactive wizard
  return <LoginWizard onDone={onDone} onLoginSuccess={onLoginSuccess} />
}
