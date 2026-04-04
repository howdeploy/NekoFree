/**
 * NekoFree read-once hooks.
 * Prevents redundant file reads within a session by tracking what's been read.
 * When a file is re-read and hasn't changed (same mtime), returns an advisory
 * telling Claude the content is already in context — saving ~2000+ tokens per hit.
 *
 * Diff mode: When a file HAS changed since the last read, instead of allowing
 * a full re-read, shows only what changed (the diff). Claude already has the
 * old content in context — it just needs the delta. Saves 80-95% of tokens.
 *
 * Compaction-aware: PostCompact hook clears the cache because Claude may have
 * lost the earlier content from its working context.
 *
 * Config (env vars):
 *   READ_ONCE_DISABLED=1    Disable entirely
 *   READ_ONCE_TTL=1200      Seconds before a cached read expires (default: 1200 = 20min)
 *   READ_ONCE_DIFF=1        Show only diff when files change (default: 0)
 *   READ_ONCE_DIFF_MAX=40   Max diff lines before falling back to full re-read (default: 40)
 */
import { statSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { registerHookCallbacks } from '../bootstrap/state.js'
import type { HookInput, HookJSONOutput } from '../entrypoints/agentSdkTypes.js'
import type { HookCallback } from '../types/hooks.js'

// --- In-memory state (per-process, cleared on compact) ---

interface CacheEntry {
  mtimeMs: number
  ts: number
}

const cache = new Map<string, CacheEntry>()
const snapshots = new Map<string, string>()
let totalTokensSaved = 0

// --- Config ---

function isDisabled(): boolean {
  return process.env.READ_ONCE_DISABLED === '1'
}

function getTTL(): number {
  const v = process.env.READ_ONCE_TTL
  return v ? parseInt(v, 10) : 1200
}

function isDiffMode(): boolean {
  return process.env.READ_ONCE_DIFF === '1'
}

function getDiffMax(): number {
  const v = process.env.READ_ONCE_DIFF_MAX
  return v ? parseInt(v, 10) : 40
}

// --- Helpers ---

function estimateTokens(fileSize: number): number {
  // ~4 chars per token, line numbers add ~70%
  return Math.round((fileSize / 4) * 1.7)
}

function simpleDiff(oldContent: string, newContent: string): string[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diff: string[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const ol = oldLines[i]
    const nl = newLines[i]
    if (ol === nl) continue
    if (ol !== undefined && nl === undefined) {
      diff.push(`-${i + 1}: ${ol}`)
    } else if (ol === undefined && nl !== undefined) {
      diff.push(`+${i + 1}: ${nl}`)
    } else if (ol !== nl) {
      diff.push(`-${i + 1}: ${ol}`)
      diff.push(`+${i + 1}: ${nl}`)
    }
  }
  return diff
}

// --- PreToolUse callback for Read ---

async function handlePreReadToolUse(
  input: HookInput,
): Promise<HookJSONOutput> {
  if (isDisabled()) return {}

  const toolInput = (input as Record<string, unknown>).tool_input as
    | Record<string, unknown>
    | undefined
  if (!toolInput) return {}

  const filePath = toolInput.file_path as string | undefined
  if (!filePath) return {}

  // Partial reads (offset/limit) are never cached — user is exploring
  // a large file piece by piece, each chunk is different content
  if (toolInput.offset != null || toolInput.limit != null) return {}

  // Get current mtime
  let stat: { mtimeMs: number; size: number }
  try {
    const s = statSync(filePath)
    stat = { mtimeMs: s.mtimeMs, size: s.size }
  } catch {
    // File doesn't exist or unreadable — let Read handle the error
    return {}
  }

  const now = Date.now() / 1000
  const ttl = getTTL()
  const entry = cache.get(filePath)

  if (entry && entry.mtimeMs === stat.mtimeMs) {
    // File hasn't changed since last read
    const age = now - entry.ts

    if (age >= ttl) {
      // Cache expired — allow re-read (context may have compacted)
      cache.set(filePath, { mtimeMs: stat.mtimeMs, ts: now })
      if (isDiffMode()) {
        try {
          snapshots.set(filePath, readFileSync(filePath, 'utf-8'))
        } catch { /* ignore */ }
      }
      return {}
    }

    // Cache hit — file unchanged and within TTL
    const tokens = estimateTokens(stat.size)
    totalTokensSaved += tokens
    const minutesAgo = Math.floor(age / 60)
    const ttlMin = Math.floor(ttl / 60)
    const name = basename(filePath)

    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason:
          `read-once: ${name} (~${tokens} tokens) already in context ` +
          `(read ${minutesAgo}m ago, unchanged). ` +
          `Re-read allowed after ${ttlMin}m. ` +
          `Session savings: ~${totalTokensSaved} tokens.`,
      },
    }
  }

  // File changed or first read
  if (entry && isDiffMode() && snapshots.has(filePath)) {
    // File changed + diff mode + we have a snapshot
    try {
      const oldContent = snapshots.get(filePath)!
      const newContent = readFileSync(filePath, 'utf-8')
      const diffLines = simpleDiff(oldContent, newContent)

      if (diffLines.length > 0 && diffLines.length <= getDiffMax()) {
        // Diff is small enough — allow with diff in reason
        cache.set(filePath, { mtimeMs: stat.mtimeMs, ts: now })
        snapshots.set(filePath, newContent)

        const diffTokens = diffLines.length * 10
        const fullTokens = estimateTokens(stat.size)
        const saved = Math.max(0, fullTokens - diffTokens)
        totalTokensSaved += saved

        const name = basename(filePath)
        const diffText = diffLines.join('\n')

        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason:
              `read-once: ${name} changed since last read. ` +
              `You already have the previous version in context. ` +
              `Here are only the changes (saving ~${saved} tokens):\n\n` +
              `${diffText}\n\n` +
              `Apply this diff mentally to your cached version of the file.`,
          },
        }
      }
      // Diff too large — fall through to full re-read
    } catch {
      // Failed to read or diff — fall through
    }
  }

  // Record the read
  cache.set(filePath, { mtimeMs: stat.mtimeMs, ts: now })
  if (isDiffMode()) {
    try {
      snapshots.set(filePath, readFileSync(filePath, 'utf-8'))
    } catch { /* ignore */ }
  }

  return {}
}

// --- PostCompact callback ---

async function handlePostCompact(): Promise<HookJSONOutput> {
  cache.clear()
  snapshots.clear()
  totalTokensSaved = 0
  return {}
}

// --- Registration ---

export function registerReadOnceHooks(): void {
  const preReadHook: HookCallback = {
    type: 'callback',
    callback: handlePreReadToolUse,
    timeout: 1,
    internal: true,
  }

  const postCompactHook: HookCallback = {
    type: 'callback',
    callback: handlePostCompact,
    timeout: 1,
    internal: true,
  }

  registerHookCallbacks({
    PreToolUse: [{ matcher: 'Read', hooks: [preReadHook] }],
    PostCompact: [{ hooks: [postCompactHook] }],
  })
}
