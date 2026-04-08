import * as React from 'react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Box, Text } from '../../ink.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { LocalJSXCommandContext } from '../../commands.js'

const NF_DIR = join(
  process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.nekofree'),
)
const NF_CONFIG = join(NF_DIR, 'config.json')

function readConfig(): Record<string, unknown> {
  try {
    if (existsSync(NF_CONFIG)) {
      return JSON.parse(readFileSync(NF_CONFIG, 'utf-8'))
    }
  } catch {
    /* corrupted config — start fresh */
  }
  return {}
}

function maskKey(key: string): string {
  if (key.length <= 12) return '***'
  return key.slice(0, 8) + '...' + key.slice(-4)
}

function saveKey(apiKey: string): string {
  const config = readConfig()
  config.apiKey = apiKey
  writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
  process.env.ANTHROPIC_API_KEY = apiKey
  return `API-ключ сохранён: ${maskKey(apiKey)}\nПерезапустите nekofree для полного применения.`
}

function LoginPrompt({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const [value, setValue] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)
  const columns = Math.max(20, useTerminalSize().columns - 4)

  const handleSubmit = React.useCallback(
    (input: string) => {
      const trimmed = input.trim()
      if (trimmed.length < 10) {
        onDone('Ошибка: ключ слишком короткий.', { display: 'system' })
        return
      }
      onDone(saveKey(trimmed), { display: 'system' })
    },
    [onDone],
  )

  const handleCancel = React.useCallback(() => {
    onDone('Отменено.', { display: 'system' })
  }, [onDone])

  return (
    <Dialog
      title="NekoFree — API ключ"
      onCancel={handleCancel}
      isCancelActive={false}
    >
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text>Введите API-ключ для gateway.nekocode.app:</Text>
        </Box>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="sk-ant-… или gateway-ключ"
          mask="*"
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

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const trimmed = (args || '').trim()

  // /login <key> — save immediately, no UI
  if (trimmed) {
    if (trimmed.startsWith('--url ')) {
      const url = trimmed.slice(6).trim()
      if (!url) {
        onDone('Ошибка: укажите URL после --url', { display: 'system' })
        return null
      }
      const config = readConfig()
      config.baseUrl = url
      writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
      process.env.ANTHROPIC_BASE_URL = url
      onDone(`Base URL установлен: ${url}\nПерезапустите nekofree.`, {
        display: 'system',
      })
      return null
    }

    if (trimmed.startsWith('--model ')) {
      const model = trimmed.slice(8).trim()
      if (!model) {
        onDone('Ошибка: укажите модель после --model', { display: 'system' })
        return null
      }
      const config = readConfig()
      config.model = model
      writeFileSync(NF_CONFIG, JSON.stringify(config, null, 2) + '\n')
      process.env.ANTHROPIC_MODEL = model
      onDone(`Модель установлена: ${model}\nПерезапустите nekofree.`, {
        display: 'system',
      })
      return null
    }

    if (trimmed.length < 10) {
      onDone('Ошибка: ключ слишком короткий.', { display: 'system' })
      return null
    }

    onDone(saveKey(trimmed), { display: 'system' })
    return null
  }

  // /login without args — interactive prompt
  return <LoginPrompt onDone={onDone} />
}
