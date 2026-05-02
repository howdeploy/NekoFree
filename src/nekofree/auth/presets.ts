/**
 * NekoFree Auth Presets
 *
 * Pre-configured connection templates for popular APIs.
 * Users pick a preset and only need to enter their credential.
 */

import type { AuthConnection } from "./types.js"

export interface AuthPreset {
	id: string
	name: string
	baseUrl: string
	authType: "apiKey" | "bearer" | "basic" | "oauth2"
	/** Default header name for apiKey auth */
	apiKeyName?: string
	/** Default query param name for apiKey auth */
	apiKeyQueryName?: string
	/** Where to put the apiKey: 'header' | 'query' */
	apiKeyIn?: "header" | "query"
	/** OAuth2 endpoints (for oauth2 presets) */
	oauth2?: {
		authorizationEndpoint: string
		tokenEndpoint: string
		scope?: string
	}
	/** Human-readable description */
	description: string
}

export const AUTH_PRESETS: AuthPreset[] = [
	{
		id: "github",
		name: "GitHub API",
		baseUrl: "https://api.github.com",
		authType: "bearer",
		description: "Personal access token from github.com/settings/tokens",
	},
	{
		id: "stripe",
		name: "Stripe",
		baseUrl: "https://api.stripe.com",
		authType: "bearer",
		description: "Secret key from dashboard.stripe.com/apikeys",
	},
	{
		id: "notion",
		name: "Notion",
		baseUrl: "https://api.notion.com",
		authType: "bearer",
		description: "Integration token from notion.so/my-integrations",
	},
	{
		id: "openweather",
		name: "OpenWeatherMap",
		baseUrl: "https://api.openweathermap.org/data/2.5",
		authType: "apiKey",
		apiKeyIn: "query",
		apiKeyQueryName: "appid",
		description: "API key from openweathermap.org/api",
	},
	{
		id: "slack",
		name: "Slack",
		baseUrl: "https://slack.com/api",
		authType: "bearer",
		description: "Bot token from api.slack.com/apps",
	},
	{
		id: "discord",
		name: "Discord",
		baseUrl: "https://discord.com/api/v10",
		authType: "bearer",
		description: "Bot token from discord.com/developers/applications",
	},
	{
		id: "twilio",
		name: "Twilio",
		baseUrl: "https://api.twilio.com",
		authType: "basic",
		description: "Account SID + Auth Token (format: SID:token)",
	},
	{
		id: "sendgrid",
		name: "SendGrid",
		baseUrl: "https://api.sendgrid.com",
		authType: "bearer",
		description: "API key from app.sendgrid.com/settings/api_keys",
	},
	{
		id: "openai-generic",
		name: "OpenAI (generic)",
		baseUrl: "https://api.openai.com",
		authType: "bearer",
		description: "OpenAI API key for direct REST access",
	},
	{
		id: "anthropic-generic",
		name: "Anthropic (generic)",
		baseUrl: "https://api.anthropic.com",
		authType: "bearer",
		description: "Anthropic API key for direct REST access",
	},
]

/** Build an AuthConnection from a preset + user-provided credential */
export function buildConnectionFromPreset(
	preset: AuthPreset,
	credential: string,
): AuthConnection {
	let auth: AuthConnection["auth"]
	switch (preset.authType) {
		case "apiKey":
			auth = {
				type: "apiKey",
				in: preset.apiKeyIn || "header",
				name: preset.apiKeyName || preset.apiKeyQueryName || "X-API-Key",
				value: credential,
			}
			break
		case "bearer":
			auth = { type: "bearer", token: credential }
			break
		case "basic": {
			const [user, pass] = credential.split(":")
			auth = { type: "basic", username: user || credential, password: pass || "" }
			break
		}
		default:
			auth = { type: "bearer", token: credential }
	}

	return {
		id: preset.id,
		name: preset.name,
		baseUrl: preset.baseUrl,
		auth,
		createdAt: new Date().toISOString(),
	}
}
