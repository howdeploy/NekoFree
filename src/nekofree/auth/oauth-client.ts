/**
 * NekoFree Generic OAuth 2.0 Client
 *
 * PKCE authorization code flow for ANY OAuth 2.0 provider.
 * Works with GitHub, Google, Stripe, Discord, and custom IdPs.
 */

import {
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "../../services/oauth/crypto.js"
import { OAuthListener } from "./oauth-listener.js"
import type { AuthConnection } from "./types.js"
import { saveConnection } from "./storage.js"

function assertOAuth2(conn: AuthConnection): asserts conn is AuthConnection & { auth: { type: "oauth2" } } {
	if (conn.auth.type !== "oauth2") {
		throw new Error(`Connection "${conn.id}" is not OAuth2`)
	}
}

export function buildAuthUrl(
	conn: AuthConnection,
	codeChallenge: string,
	state: string,
	redirectUri: string,
): string {
	assertOAuth2(conn)
	const auth = conn.auth
	if (!auth.authorizationEndpoint) {
		throw new Error(`Connection "${conn.id}" missing authorizationEndpoint`)
	}
	const url = new URL(auth.authorizationEndpoint)
	url.searchParams.set("client_id", auth.clientId)
	url.searchParams.set("response_type", "code")
	url.searchParams.set("redirect_uri", redirectUri)
	url.searchParams.set("code_challenge", codeChallenge)
	url.searchParams.set("code_challenge_method", "S256")
	url.searchParams.set("state", state)
	if (auth.scope) url.searchParams.set("scope", auth.scope)
	return url.toString()
}

export async function exchangeCode(
	conn: AuthConnection,
	code: string,
	codeVerifier: string,
	redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }> {
	assertOAuth2(conn)
	const auth = conn.auth
	if (!auth.tokenEndpoint) {
		throw new Error(`Connection "${conn.id}" missing tokenEndpoint`)
	}

	const body = new URLSearchParams()
	body.set("grant_type", "authorization_code")
	body.set("client_id", auth.clientId)
	body.set("code", code)
	body.set("redirect_uri", redirectUri)
	body.set("code_verifier", codeVerifier)
	if (auth.clientSecret) body.set("client_secret", auth.clientSecret)

	const res = await fetch(auth.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Token exchange failed (${res.status}): ${text}`)
	}

	const data = (await res.json()) as Record<string, unknown>
	return {
		accessToken: String(data.access_token),
		refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
		expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
		scope: data.scope ? String(data.scope) : undefined,
	}
}

export async function refreshAccessToken(
	conn: AuthConnection,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
	assertOAuth2(conn)
	const auth = conn.auth
	if (!auth.tokenEndpoint) {
		throw new Error(`Connection "${conn.id}" missing tokenEndpoint`)
	}
	if (!auth.refreshToken) {
		throw new Error(`Connection "${conn.id}" has no refresh token`)
	}

	const body = new URLSearchParams()
	body.set("grant_type", "refresh_token")
	body.set("client_id", auth.clientId)
	body.set("refresh_token", auth.refreshToken)
	if (auth.clientSecret) body.set("client_secret", auth.clientSecret)

	const res = await fetch(auth.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Token refresh failed (${res.status}): ${text}`)
	}

	const data = (await res.json()) as Record<string, unknown>
	return {
		accessToken: String(data.access_token),
		refreshToken: data.refresh_token ? String(data.refresh_token) : auth.refreshToken,
		expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
	}
}

/**
 * Run the full OAuth 2.0 browser flow.
 *
 * @param conn The OAuth2 connection config (must have authorizationEndpoint, tokenEndpoint, clientId)
 * @param onUrl Called with the authorization URL to open in browser
 * @returns Updated connection with accessToken, refreshToken, expiresAt
 */
export async function runOAuthFlow(
	conn: AuthConnection,
	onUrl: (url: string) => void,
): Promise<AuthConnection> {
	assertOAuth2(conn)

	const listener = new OAuthListener()
	const port = await listener.start()
	const redirectUri = `http://127.0.0.1:${port}/callback`

	const codeVerifier = generateCodeVerifier()
	const codeChallenge = generateCodeChallenge(codeVerifier)
	const state = generateState()

	const authUrl = buildAuthUrl(conn, codeChallenge, state, redirectUri)
	onUrl(authUrl)

	try {
		const code = await listener.waitForCode(state)
		const tokens = await exchangeCode(conn, code, codeVerifier, redirectUri)

		const updated: AuthConnection = {
			...conn,
			auth: {
				...conn.auth,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken || conn.auth.refreshToken,
				expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
			},
		}
		saveConnection(updated)
		return updated
	} finally {
		listener.close()
	}
}
