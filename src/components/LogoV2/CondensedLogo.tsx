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

function getApiEndpoint(): string {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  try {
    const url = new URL(baseUrl);
    return url.host;
  } catch {
    return baseUrl || 'api.anthropic.com';
  }
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
  const apiEndpoint = getApiEndpoint();
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
