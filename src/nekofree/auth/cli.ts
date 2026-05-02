/**
 * NekoFree Auth CLI Helpers
 *
 * Functions for listing, adding, removing and validating auth connections.
 * These return formatted strings suitable for terminal output.
 */

import {
	connectionExists,
	deleteConnection,
	listConnections,
	loadConnection,
	saveConnection,
} from "./storage.js"
import { validateConnection } from "./validator.js"
import type { AuthConnection } from "./types.js"

export function addConnection(conn: AuthConnection): { ok: boolean; message: string } {
	if (connectionExists(conn.id)) {
		return { ok: false, message: `Connection "${conn.id}" already exists. Remove it first.` }
	}
	try {
		saveConnection(conn)
		return { ok: true, message: `Connection "${conn.id}" saved.` }
	} catch (err) {
		return { ok: false, message: `Failed to save: ${err instanceof Error ? err.message : String(err)}` }
	}
}

export function removeConnection(id: string): { ok: boolean; message: string } {
	const ok = deleteConnection(id)
	if (!ok) {
		return { ok: false, message: `Connection "${id}" not found.` }
	}
	return { ok: true, message: `Connection "${id}" removed.` }
}

export function formatConnectionList(): string {
	const connections = listConnections()
	if (connections.length === 0) {
		return "No auth connections configured. Use /auth add to create one."
	}
	const lines = ["Configured auth connections:", ""]
	for (const c of connections) {
		const authType = c.auth.type
		const base = c.baseUrl || "—"
		const lastUsed = c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "never"
		lines.push(`  • ${c.name} (${c.id})`)
		lines.push(`    type: ${authType} | base: ${base} | last used: ${lastUsed}`)
	}
	return lines.join("\n")
}

export async function validateAndReport(id: string): Promise<string> {
	const conn = loadConnection(id)
	if (!conn) {
		return `Connection "${id}" not found.`
	}
	const result = await validateConnection(conn)
	if (result.ok) {
		return `✓ ${conn.name} is healthy (HTTP ${result.statusCode})`
	}
	return `✗ ${conn.name} failed: ${result.error}`
}
