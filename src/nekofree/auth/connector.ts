/**
 * NekoFree Auth Connector
 *
 * Creates authenticated fetch requests for any AuthConnection.
 */

import type { AuthConnection, RequestOptions } from "./types.js"
import { saveConnection } from "./storage.js"

function buildAuthHeaders(conn: AuthConnection): Record<string, string> {
	switch (conn.auth.type) {
		case "apiKey": {
			if (conn.auth.in === "header") {
				return { [conn.auth.name]: conn.auth.value }
			}
			return {}
		}
		case "bearer": {
			return { Authorization: `Bearer ${conn.auth.token}` }
		}
		case "basic": {
			const encoded = Buffer.from(`${conn.auth.username}:${conn.auth.password}`).toString("base64")
			return { Authorization: `Basic ${encoded}` }
		}
		case "oauth2": {
			const token = conn.auth.accessToken
			if (!token) return {}
			return { Authorization: `Bearer ${token}` }
		}
		default: {
			return {}
		}
	}
}

function buildUrl(conn: AuthConnection, input: string | URL, opts?: RequestOptions): string {
	const base = opts?.baseUrl || conn.baseUrl
	const inputStr = input instanceof URL ? input.toString() : input

	if (inputStr.startsWith("http://") || inputStr.startsWith("https://")) {
		return inputStr
	}
	if (!base) {
		return inputStr
	}
	const baseTrimmed = base.endsWith("/") ? base.slice(0, -1) : base
	const path = inputStr.startsWith("/") ? inputStr : `/${inputStr}`
	return `${baseTrimmed}${path}`
}

function injectApiKeyQuery(conn: AuthConnection, urlStr: string): string {
	if (conn.auth.type !== "apiKey" || conn.auth.in !== "query") return urlStr
	const url = new URL(urlStr)
	url.searchParams.set(conn.auth.name, conn.auth.value)
	return url.toString()
}

export class AuthConnector {
	constructor(private connection: AuthConnection) {}

	/** Get the underlying connection (read-only clone) */
	getConnection(): AuthConnection {
		return { ...this.connection }
	}

	/** Perform an authenticated fetch */
	async fetch(input: string | URL, init?: RequestInit & RequestOptions): Promise<Response> {
		const url = buildUrl(this.connection, input, init)
		const urlWithQuery = injectApiKeyQuery(this.connection, url)

		const authHeaders = buildAuthHeaders(this.connection)
		const mergedHeaders: Record<string, string> = {
			...authHeaders,
			...init?.headers,
		}

		// Update lastUsedAt
		this.connection.lastUsedAt = new Date().toISOString()
		try {
			saveConnection(this.connection)
		} catch {
			// Non-critical: don't fail the request if we can't persist lastUsedAt
		}

		return globalThis.fetch(urlWithQuery, {
			...init,
			headers: mergedHeaders,
		})
	}

	/** Raw auth headers for manual request building */
	getAuthHeaders(): Record<string, string> {
		return buildAuthHeaders(this.connection)
	}

	/** Check if this connector can make authenticated requests */
	isAuthenticated(): boolean {
		const auth = this.connection.auth
		switch (auth.type) {
			case "apiKey":
				return !!auth.value
			case "bearer":
				return !!auth.token
			case "basic":
				return !!auth.username && !!auth.password
			case "oauth2":
				return !!auth.accessToken
			default:
				return false
		}
	}
}

/** Convenience factory */
export function createConnector(connection: AuthConnection): AuthConnector {
	return new AuthConnector(connection)
}
