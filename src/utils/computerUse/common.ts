// NekoFree: Computer Use removed (requires @ant/ private packages)
export const COMPUTER_USE_MCP_SERVER_NAME = 'computer-use'
export function isComputerUseMCPServer(_name: string): boolean { return false }
export function getComputerUseAvailability(): { available: false; reason: string } {
  return { available: false, reason: 'Computer Use not available in NekoFree' }
}
