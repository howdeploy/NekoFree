/**
 * NekoFree Auth Tool Helper
 *
 * Allows the agent to call any saved AuthConnection from tools/skills.
 *
 * Usage from a skill or tool:
 *   const result = await callConnectionApi('github', 'GET', '/user')
 *   const result = await callConnectionApi('stripe', 'POST', '/v1/customers', { email: '...' })
 */

import { loadConnection } from "./storage.js"
import { createConnector } from "./connector.js"

export interface ApiCallResult {
	ok: boolean
	status: number
	data: unknown
	error?: string
}

/**
 * Call an API endpoint using a saved auth connection.
 *
 * @param connectionId The ID of the saved AuthConnection
 * @param method HTTP method
 * @param path URL path (relative to connection baseUrl) or absolute URL
 * @param body Optional JSON body
 */
export async function callConnectionApi(
	connectionId: string,
	method: string,
	path: string,
	body?: Record<string, unknown>,
): Promise<ApiCallResult> {
	const conn = loadConnection(connectionId)
	if (!conn) {
		return { ok: false, status: 0, data: null, error: `Connection "${connectionId}" not found` }
	}

	const connector = createConnector(conn)
	if (!connector.isAuthenticated()) {
		return { ok: false, status: 0, data: null, error: `Connection "${connectionId}" is not authenticated` }
	}

	try {
		const init: RequestInit = { method }
		if (body) {
			init.headers = { "Content-Type": "application/json" }
			init.body = JSON.stringify(body)
		}
		const response = await connector.fetch(path, init)
		let data: unknown = null
		const contentType = response.headers.get("content-type") || ""
		if (contentType.includes("application/json")) {
			data = await response.json()
		} else {
			data = await response.text()
		}
		return {
			ok: response.ok,
			status: response.status,
			data,
			error: response.ok ? undefined : `HTTP ${response.status}: ${data}`,
		}
	} catch (err) {
		return {
			ok: false,
			status: 0,
			data: null,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

/**
 * List all available connection IDs for the agent to use.
 */
export function listConnectionIds(): string[] {
	const { listConnections } = require("./storage.js")
	return listConnections().map((c: { id: string }) => c.id)
}
