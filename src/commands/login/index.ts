import type { Command } from '../../commands.js'

export default () =>
  ({
    type: 'local',
    name: 'login',
    description: 'Установить API-ключ для gateway.nekocode.app',
    argumentHint: '<api-key>',
    supportsNonInteractive: true,
    isEnabled: () => true,
    load: () => import('./nekofree-login.js'),
  }) satisfies Command
