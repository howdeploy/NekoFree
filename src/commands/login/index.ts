import type { Command } from '../../commands.js'
import { hasAnthropicApiKeyAuth } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasAnthropicApiKeyAuth()
      ? 'Switch Anthropic accounts'
      : 'Sign in with your Anthropic account',
    isEnabled: () => false, // NekoFree: OAuth disabled
    load: () => import('./login.js'),
  }) satisfies Command
