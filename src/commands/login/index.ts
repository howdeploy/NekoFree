import type { Command } from '../../commands.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: 'Настроить API-провайдер (Anthropic, Nekocode, OpenRouter, Bedrock, Vertex)',
    argumentHint: '[api-key | --provider <id> | --list | --model <m>]',
    isEnabled: () => true,
    load: () => import('./nekofree-login.js'),
  }) satisfies Command
