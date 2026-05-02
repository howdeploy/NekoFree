/**
 * NekoFree Auth Validator
 *
 * Lightweight health check for auth connections.
 */

import { AuthConnector } from "./connector.js"
import type { AuthConnection, ValidationResult } from "./types.js"

/**
 * Validate a connection by making a lightweight authenticated request.
 *
 * @param connection The connection to validate
 * @param path Optional override path (default: connection.healthCheckUrl or GET /)
 */
export async function validateConnection(
	connection: AuthConnection,
	path?: string,
): Promise<ValidationResult> {
	const connector = new AuthConnector(connection)

	if (!connector.isAuthenticated()) {
		return { ok: false, error: "Connection is missing credentials" }
	}

	const url = path || connection.healthCheckUrl || "/"

	try {
		const response = await connector.fetch(url, { method: "HEAD" })
		if (response.status >= 200 && response.status < 500) {
			return { ok: true, statusCode: response.status }
		}
		return {
			ok: false,
			statusCode: response.status,
			error: `Health check returned status ${response.status}`,
		}
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) }
	}
}
