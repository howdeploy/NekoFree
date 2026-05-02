/**
 * NekoFree — чистые типы.
 * Не импортируй legacy-модули Claude Code напрямую.
 */

export interface NfProviderConfig {
	apiKey?: string
	model?: string
	baseUrl?: string
	openaiCompat?: string
	region?: string
	projectId?: string
}

export interface NfConfig {
	activeProvider: string
	providers: Record<string, NfProviderConfig>
}

export interface ProviderField {
	key: string
	label: string
	placeholder?: string
	mask?: boolean
}

export interface ProviderModel {
	value: string
	label: string
	description: string
}

export interface ProviderDef {
	id: string
	label: string
	description: string
	baseUrl?: string
	fields: ProviderField[]
	models?: ProviderModel[]
	oauth?: string
	envSetup(config: NfProviderConfig): void
	envClear(): void
}

export interface GatewayRequest {
	body: string
	baseUrl: string
	apiKey: string
}
