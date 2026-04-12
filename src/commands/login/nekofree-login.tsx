import * as React from 'react'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Box, Text } from '../../ink.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Select } from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import {
  PROVIDERS,
  getProvider,
  migrateConfig,
  type NfConfig,
  type NfProviderConfig,
} from './providers.js'

const NF_DIR = join(
  process.env.NEKOFREE_CONFIG_DIR || join(homedir(), '.nekofree'),
)
const NF_CONFIG = join(NF_DIR, 'config.json')

function readConfig(): NfConfig {
  try {
    if (!existsSync(NF_DIR)) mkdirSync(NF_DIR, { recursive: true })
    if (existsSync(NF_CONFIG)) {
      const raw = JSON.parse(readFileSync(NF_CONFIG, 'utf-8'))
      return migrateConfig(raw)
    }
  } catch { /* corrupted → fresh */ }
  return { activeProvider: '', providers: {} }
}

function saveConfig(config: NfConfig): void {
  if (!existsSync(NF_DIR)) mkdirSync(NF_DIR, { recursive: true })
  writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
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

// ── Wizard states ──

type WizardState =
  | { step: 'select' }
  | { step: 'field'; providerId: string; fieldIdx: number; values: Record<string, string> }

function LoginWizard({ onDone, initialProvider }: {
  onDone: LocalJSXCommandOnDone
  initialProvider?: string
}) {
  const config = React.useMemo(() => readConfig(), [])

  const [state, setState] = React.useState<WizardState>(() => {
    if (initialProvider) {
      const def = getProvider(initialProvider)
      if (def) {
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

  // Handle no-field provider activation via initialProvider
  React.useEffect(() => {
    if (initialProvider && state.step === 'select') {
      const def = getProvider(initialProvider)
      if (def && def.fields.length === 0) {
        config.activeProvider = initialProvider
        if (!config.providers[initialProvider]) config.providers[initialProvider] = {}
        saveConfig(config)
        applyProvider(initialProvider, config.providers[initialProvider]!)
        onDone(`Провайдер переключён на ${def.label}.\nПерезапустите nekofree.`, { display: 'system' })
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

    if (def.fields.length === 0) {
      // No fields — just switch
      config.activeProvider = providerId
      if (!config.providers[providerId]) config.providers[providerId] = {}
      saveConfig(config)
      applyProvider(providerId, config.providers[providerId]!)
      onDone(`Провайдер: ${def.label}.\nПерезапустите nekofree.`, { display: 'system' })
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
      onDone(
        `Провайдер: ${def.label}\n${summary}\nПерезапустите nekofree для полного применения.`,
        { display: 'system' },
      )
    }
  }, [state, config, onDone])

  // ── Render ──

  if (state.step === 'select') {
    return (
      <Dialog title="NekoFree — выбор провайдера" onCancel={handleCancel} isCancelActive={false}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Выберите API-провайдер:</Text>
          </Box>
          <Select
            options={options}
            onChange={handleProviderSelect}
            onCancel={handleCancel}
            visibleOptionCount={6}
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
        onCancel={handleCancel}
        isCancelActive={false}
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

  return null
}

// ── Command entry point ──

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const trimmed = (args || '').trim()

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
      onDone(`Провайдер переключён на ${def.label}.\nПерезапустите nekofree.`, { display: 'system' })
      return null
    }

    // Not configured yet — open wizard for this provider
    return <LoginWizard onDone={onDone} initialProvider={providerId} />
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
    onDone(`Custom endpoint: ${url}\nПерезапустите nekofree.`, { display: 'system' })
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
    onDone(`Модель: ${model} (провайдер: ${active})\nПерезапустите nekofree.`, { display: 'system' })
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
    onDone(
      `API-ключ сохранён для ${def?.label || active}: ${maskKey(trimmed)}\nПерезапустите nekofree.`,
      { display: 'system' },
    )
    return null
  }

  // /login — interactive wizard
  return <LoginWizard onDone={onDone} />
}
