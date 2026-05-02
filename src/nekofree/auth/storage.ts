/**
 * NekoFree Auth Storage
 *
 * Persists auth connections to ~/.nekofree/connections/<id>.json.
 * Each connection lives in its own file for atomic updates.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { AuthConnection } from "./types.js"

function getConnectionsDir(): string {
	const dir = join(
		process.env.NEKOFREE_CONFIG_DIR || join(homedir(), ".nekofree"),
		"connections",
	)
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true })
	}
	return dir
}

function getPath(id: string): string {
	// Sanitize id to prevent path traversal
	const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
	return join(getConnectionsDir(), `${safeId}.json`)
}

export function loadConnection(id: string): AuthConnection | null {
	const path = getPath(id)
	if (!existsSync(path)) return null
	try {
		const raw = readFileSync(path, "utf-8")
		return JSON.parse(raw) as AuthConnection
	} catch {
		return null
	}
}

export function saveConnection(connection: AuthConnection): void {
	const path = getPath(connection.id)
	// biome-ignore lint/suspicious/noConsole: intentional debug output
	writeFileSync(path, JSON.stringify(connection, null, 2) + "\n")
}

export function deleteConnection(id: string): boolean {
	const path = getPath(id)
	if (!existsSync(path)) return false
	try {
		unlinkSync(path)
		return true
	} catch {
		return false
	}
}

export function listConnections(): AuthConnection[] {
	const dir = getConnectionsDir()
	const entries = readdirSync(dir, { withFileTypes: true })
	const connections: AuthConnection[] = []
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue
		const id = entry.name.slice(0, -5)
		const conn = loadConnection(id)
		if (conn) connections.push(conn)
	}
	// Sort by name for stable listing
	return connections.sort((a, b) => a.name.localeCompare(b.name))
}

export function connectionExists(id: string): boolean {
	return existsSync(getPath(id))
}
