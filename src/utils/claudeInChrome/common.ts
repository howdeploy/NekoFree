// NekoFree: Chrome integration removed (requires @ant/claude-for-chrome-mcp)
export const CLAUDE_IN_CHROME_MCP_SERVER_NAME = 'claude-in-chrome'
export function isClaudeInChromeMCPServer(_name: string): boolean { return false }
export function openInChrome(): void {}
export function isTrackedClaudeInChromeTabId(_id: string): boolean { return false }
