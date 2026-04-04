import * as React from 'react';
import { Box, Text } from '../../ink.js';

// Pixel-buddy cat palette (from claude-code-mascot-statusline)
const PALETTE: (string | null)[] = [
  null,      // 0: transparent
  '#3b4a6b', // 1: dark navy (outline)
  '#8bacd6', // 2: pastel blue (body)
  '#a4b4ea', // 3: lavender (ears, mouth)
  '#f8fafc', // 4: white (eyes)
  '#63d2a1', // 5: green (effects)
  '#6994d0', // 6: medium blue (effects)
  '#7db8ff', // 7: bright blue (effects)
  '#ff7a70', // 8: red (effects)
  '#5a6b8a', // 9: slate (whiskers)
  '#384058', // 10: dark
  '#2a2e3d', // 11: darker
];

// Idle frame (16x16 grid of palette indices)
const IDLE_SPRITE: number[][] = [
  [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],
  [0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],
  [1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],
  [1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],
  [9,9,2,1,1,2,2,2,2,2,2,1,1,2,9,9],
  [0,1,2,2,2,2,1,3,3,1,2,2,2,2,1,0],
  [0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],
  [0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],
  [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function renderHalfBlock(sprite: number[][], palette: (string | null)[]): string[] {
  const rows: string[] = [];
  for (let r = 0; r < sprite.length; r += 2) {
    const top = sprite[r]!;
    const bottom = sprite[r + 1] ?? new Array(top.length).fill(0);
    let line = '';
    for (let c = 0; c < top.length; c++) {
      const tc = palette[top[c]!] ?? null;
      const bc = palette[bottom[c]!] ?? null;
      if (!tc && !bc) {
        line += ' ';
        continue;
      }
      if (!tc) {
        const [cr, cg, cb] = hexToRgb(bc!);
        line += `\x1b[38;2;${cr};${cg};${cb}m\u2584\x1b[0m`;
      } else if (!bc) {
        const [cr, cg, cb] = hexToRgb(tc);
        line += `\x1b[38;2;${cr};${cg};${cb}m\u2580\x1b[0m`;
      } else if (tc === bc) {
        const [cr, cg, cb] = hexToRgb(tc);
        line += `\x1b[38;2;${cr};${cg};${cb}m\u2588\x1b[0m`;
      } else {
        const [tr, tg, tb] = hexToRgb(tc);
        const [br, bg, bb] = hexToRgb(bc);
        line += `\x1b[38;2;${tr};${tg};${tb};48;2;${br};${bg};${bb}m\u2580\x1b[0m`;
      }
    }
    rows.push(line);
  }
  // Remove trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1]!.trim() === '') {
    rows.pop();
  }
  return rows;
}

const RENDERED_LINES = renderHalfBlock(IDLE_SPRITE, PALETTE);

export function NekoMascot(): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center">
      {RENDERED_LINES.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
