import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { LocalCommandResult } from '../../types/command.js'

const NF_DIR = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.nekofree'))
const NF_CONFIG = join(NF_DIR, 'config.json')

function readConfig(): Record<string, unknown> {
  try {
    if (existsSync(NF_CONFIG)) {
      return JSON.parse(readFileSync(NF_CONFIG, 'utf-8'))
    }
  } catch { /* corrupted config — start fresh */ }
  return {}
}

function maskKey(key: string): string {
  if (key.length <= 12) return '***'
  return key.slice(0, 8) + '...' + key.slice(-4)
}

export async function call(args: string): Promise<LocalCommandResult> {
  const trimmed = args.trim()

  // /login without args — show current config and usage
  if (!trimmed) {
    const config = readConfig()
    const currentKey = (config.apiKey as string) || ''
    const currentUrl = (config.baseUrl as string) || 'https://gateway.nekocode.app/alpha'
    const currentModel = (config.model as string) || 'claude-opus-4-6'

    const lines = [
      '── NekoFree config ──',
      `  baseUrl: ${currentUrl}`,
      `  apiKey:  ${currentKey ? maskKey(currentKey) : '(не задан)'}`,
      `  model:   ${currentModel}`,
      '',
      'Использование:',
      '  /login <api-key>              — установить API-ключ',
      '  /login <api-key> <base-url>   — установить ключ и URL',
      '  /login --url <base-url>       — изменить только base URL',
      '  /login --model <model>        — изменить модель',
      '',
      `Конфиг: ${NF_CONFIG}`,
    ]
    return { type: 'text', value: lines.join('\n') }
  }

  const config = readConfig()

  // /login --url <base-url>
  if (trimmed.startsWith('--url ')) {
    const url = trimmed.slice(6).trim()
    if (!url) {
      return { type: 'text', value: 'Ошибка: укажите URL после --url' }
    }
    config.baseUrl = url
    writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
    process.env.ANTHROPIC_BASE_URL = url
    return { type: 'text', value: `Base URL установлен: ${url}\nПерезапустите nekofree для применения.` }
  }

  // /login --model <model>
  if (trimmed.startsWith('--model ')) {
    const model = trimmed.slice(8).trim()
    if (!model) {
      return { type: 'text', value: 'Ошибка: укажите модель после --model' }
    }
    config.model = model
    writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
    process.env.ANTHROPIC_MODEL = model
    return { type: 'text', value: `Модель установлена: ${model}\nПерезапустите nekofree для применения.` }
  }

  // Parse: /login <api-key> [base-url]
  const parts = trimmed.split(/\s+/)
  const apiKey = parts[0]!
  const baseUrl = parts[1]

  // Basic validation
  if (apiKey.length < 10) {
    return { type: 'text', value: 'Ошибка: ключ слишком короткий. Ожидается Anthropic API key (sk-ant-...) или gateway-ключ.' }
  }

  // Save API key
  config.apiKey = apiKey
  if (baseUrl) {
    config.baseUrl = baseUrl
  }
  writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')

  // Update env for current session
  process.env.ANTHROPIC_API_KEY = apiKey
  if (baseUrl) {
    process.env.ANTHROPIC_BASE_URL = baseUrl
  }

  const result = [
    `API-ключ сохранён: ${maskKey(apiKey)}`,
  ]
  if (baseUrl) {
    result.push(`Base URL: ${baseUrl}`)
  }
  result.push(`Конфиг: ${NF_CONFIG}`)
  result.push('Перезапустите nekofree для полного применения.')

  return { type: 'text', value: result.join('\n') }
}
