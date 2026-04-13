import * as React from 'react';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { truncate } from '../../utils/format.js';
import { getLogoDisplayData, truncatePath } from '../../utils/logoV2Utils.js';
import { renderModelSetting } from '../../utils/model/model.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';
import { NekoMascot } from './NekoMascot.js';
import { getProvider } from '../../commands/login/providers.js';
import { getGlobalConfig } from '../../utils/config.js';

function getActiveProviderLabel(): string {
  try {
    const cfg = getGlobalConfig() as Record<string, unknown>;
    const activeId = cfg.activeProvider as string | undefined;
    if (activeId) {
      const def = getProvider(activeId);
      if (def) return def.label;
    }
  } catch { /* ignore */ }
  // Fallback: derive from env vars
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  if (process.env.CLAUDE_CODE_USE_OPENAI) return 'OpenAI Codex';
  if (process.env.CLAUDE_CODE_USE_BEDROCK) return 'AWS Bedrock';
  if (process.env.CLAUDE_CODE_USE_VERTEX) return 'Google Vertex AI';
  if (baseUrl) {
    try { return new URL(baseUrl).host; } catch { return baseUrl; }
  }
  return 'Anthropic API';
}

export function CondensedLogo(): React.ReactElement {
  const { columns } = useTerminalSize();
  const agent = useAppState((s) => s.agent);
  const effortValue = useAppState((s) => s.effortValue);
  const model = useMainLoopModel();
  const modelDisplayName = renderModelSetting(model);
  const { version, cwd, agentName: agentNameFromSettings } = getLogoDisplayData();
  const agentName = agent ?? agentNameFromSettings;
  const effortSuffix = getEffortSuffix(model, effortValue);

  const maxWidth = Math.min(columns, 50);
  const modelText = truncate(modelDisplayName + effortSuffix, maxWidth);
  const apiEndpoint = getActiveProviderLabel();
  const cwdWidth = agentName ? maxWidth - agentName.length - 4 : maxWidth;
  const truncatedCwd = truncatePath(cwd, Math.max(cwdWidth, 10));
  const cwdLine = agentName ? `@${agentName} \u00b7 ${truncatedCwd}` : truncatedCwd;

  return (
    <OffscreenFreeze>
      <Box flexDirection="column" alignItems="center" width={columns}>
        <NekoMascot />
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Text bold={true}>NekoFree <Text dimColor={true}>v{truncate(version, 12)}</Text></Text>
          <Text dimColor={true}>{modelText}</Text>
          <Text dimColor={true}>{apiEndpoint}</Text>
          <Text dimColor={true}>{cwdLine}</Text>
        </Box>
      </Box>
    </OffscreenFreeze>
  );
}
