/**
 * NekoFree Generic Auth Framework
 *
 * Unified authentication for any API or subscription.
 * Supports: API Key, Bearer Token, OAuth 2.0, Basic Auth.
 */

export type AuthType = "apiKey" | "bearer" | "oauth2" | "basic"

/** API Key authentication */
export interface ApiKeyAuth {
	type: "apiKey"
	/** Where to inject the key */
	in: "header" | "query"
	/** Header name (e.g. "X-API-Key") or query param name (e.g. "api_key") */
	name: string
	/** The key value */
	value: string
}

/** Bearer Token authentication */
export interface BearerAuth {
	type: "bearer"
	/** The token value */
	token: string
}

/** Basic Auth (username:password base64) */
export interface BasicAuth {
	type: "basic"
	username: string
	password: string
}

/** OAuth 2.0 configuration */
export interface OAuth2Auth {
	type: "oauth2"
	clientId: string
	clientSecret?: string
	/** Authorization endpoint URL */
	authorizationEndpoint?: string
	/** Token endpoint URL */
	tokenEndpoint?: string
	/** Requested scopes */
	scope?: string
	/** Current access token */
	accessToken?: string
	/** Refresh token */
	refreshToken?: string
	/** Unix timestamp (ms) when access token expires */
	expiresAt?: number
}

/** Union of all auth configurations */
export type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | OAuth2Auth

/** A stored connection to an external API or service */
export interface AuthConnection {
	/** Unique identifier (e.g. "github", "stripe-prod") */
	id: string
	/** Human-readable name */
	name: string
	/** Optional base URL for all requests */
	baseUrl?: string
	/** Authentication method and credentials */
	auth: AuthConfig
	/** Optional health check endpoint */
	healthCheckUrl?: string
	/** When the connection was created */
	createdAt: string
	/** When the connection was last used */
	lastUsedAt?: string
}

/** Result of validating a connection */
export interface ValidationResult {
	ok: boolean
	statusCode?: number
	error?: string
}

/** Options for creating an authenticated request */
export interface RequestOptions {
	/** Override the connection's baseUrl */
	baseUrl?: string
	/** Additional headers to merge */
	headers?: HeadersInit
}
