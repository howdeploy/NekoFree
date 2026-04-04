#!/usr/bin/env node
// NekoFree statusline — self-contained pixel-buddy cat mascot + session stats.
// Reads Claude Code JSON from stdin, renders cat + stats to stdout.

const PALETTE = [null,"#3b4a6b","#8bacd6","#a4b4ea","#f8fafc","#63d2a1","#6994d0","#7db8ff","#ff7a70","#5a6b8a","#384058","#2a2e3d"];
const SPRITES = {
  idle:[[0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[9,9,2,1,1,2,2,2,2,2,2,1,1,2,9,9],[0,1,2,2,2,2,1,3,3,1,2,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  thinking:[[0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,6],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[9,9,2,1,1,2,2,2,2,2,2,1,1,2,9,9],[0,1,2,2,2,2,1,3,3,1,2,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  tool_running:[[0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,2,1,1,2,2,2,2,1,1,2,2,1,1],[1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1],[9,9,2,1,1,2,2,2,2,2,2,1,1,2,9,9],[0,1,2,2,2,2,1,2,2,1,2,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,7,1,1,2,2,2,2,2,2,1,1,7,0,0],[0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  tool_success:[[5,0,1,1,0,0,0,5,5,0,0,0,1,1,0,5],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[5,2,3,2,2,2,2,2,2,2,2,2,2,3,2,5],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,2,1,2,2,2,2,2,2,1,2,2,1,1],[1,1,2,1,2,1,2,2,2,2,1,2,1,2,1,1],[9,9,2,0,2,2,2,2,2,2,2,2,0,2,9,9],[0,1,2,2,2,2,1,3,3,1,2,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  tool_failure:[[0,0,1,1,0,0,0,8,8,0,0,0,1,1,0,0],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,1,1,2,2,2,2,2,2,1,1,2,1,1],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[9,9,2,1,1,7,2,2,2,2,2,1,1,2,9,9],[0,1,2,2,2,2,2,1,1,2,2,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  done:[[5,5,1,1,0,0,0,0,0,0,0,0,1,1,5,5],[0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0],[1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1],[0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1],[9,9,2,1,0,2,2,2,2,2,2,0,1,2,9,9],[0,1,2,2,2,5,1,3,3,1,5,2,2,2,1,0],[0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],[0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],[0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],[0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
};

// --- Renderer ---
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

const SPARKLE_IDX = 5; // green sparkle → render as "+"

function renderHalfBlock(sprite, palette) {
  const rows = [];
  const GREEN = '\x1b[32m', RST = '\x1b[0m';
  for (let r = 0; r < sprite.length; r += 2) {
    const top = sprite[r];
    const bottom = sprite[r+1] || new Array(top.length).fill(0);
    let line = '';
    for (let c = 0; c < top.length; c++) {
      const tIdx = top[c], bIdx = bottom[c];
      if (tIdx === SPARKLE_IDX || bIdx === SPARKLE_IDX) {
        const otherIdx = tIdx === SPARKLE_IDX ? bIdx : tIdx;
        const bg = palette[otherIdx] || null;
        if (bg) { const [r,g,b] = hexToRgb(bg); line += `\x1b[32;48;2;${r};${g};${b}m+${RST}`; }
        else { line += `${GREEN}+${RST}`; }
        continue;
      }
      const tc = palette[tIdx] || null;
      const bc = palette[bIdx] || null;
      if (!tc && !bc) { line += ' '; continue; }
      if (!tc) { const [r,g,b] = hexToRgb(bc); line += `\x1b[38;2;${r};${g};${b}m\u2584\x1b[0m`; }
      else if (!bc) { const [r,g,b] = hexToRgb(tc); line += `\x1b[38;2;${r};${g};${b}m\u2580\x1b[0m`; }
      else if (tc === bc) { const [r,g,b] = hexToRgb(tc); line += `\x1b[38;2;${r};${g};${b}m\u2588\x1b[0m`; }
      else { const [tr,tg,tb] = hexToRgb(tc); const [br,bg,bb] = hexToRgb(bc); line += `\x1b[38;2;${tr};${tg};${tb};48;2;${br};${bg};${bb}m\u2580\x1b[0m`; }
    }
    rows.push(line);
  }
  while (rows.length && rows[rows.length-1].trim() === '') rows.pop();
  return rows;
}

// --- State detection from Claude Code JSON ---
function detectState(input) {
  // NekoFree: activity phase is set by REPL → StatusLine → JSON
  return input.activity || 'idle';
}

// --- Stats ---
function buildStats(input) {
  const parts = [];
  const RST = '\x1b[0m', DIM = '\x1b[2m', WHITE = '\x1b[97m', BOLD = '\x1b[1m';
  const GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m';
  const BLUE = '\x1b[38;2;150;185;235m';

  // Context window usage
  const ctxPct = Math.round(input.context_window?.used_percentage || 0);
  const ctxColor = ctxPct < 50 ? GREEN : ctxPct < 70 ? YELLOW : RED;
  parts.push(`${DIM}ctx:${RST}${ctxColor}${ctxPct}%${RST}`);

  // Cost (TODO: recalculate for Nekocode pricing when rates are known)
  const cost = input.cost?.total_cost_usd || 0;
  if (cost > 0) {
    parts.push(`${WHITE}$${cost.toFixed(2)}${RST}`);
  }

  // Current working directory (shortened to basename)
  if (input.workspace?.current_dir) {
    const cwd = input.workspace.current_dir;
    const basename = cwd.split('/').pop() || cwd;
    parts.push(`${BLUE}${basename}${RST}`);
  }

  // Model
  if (input.model?.display_name) {
    parts.push(`${DIM}${input.model.display_name}${RST}`);
  }

  return parts.join(`${DIM} | ${RST}`);
}

// --- Main ---
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const input = raw ? JSON.parse(raw) : {};

  const state = detectState(input);
  const sprite = SPRITES[state] || SPRITES.idle;
  const catLines = renderHalfBlock(sprite, PALETTE);
  const stats = buildStats(input);

  // Two-line output: cat on first line(s), stats on last
  process.stdout.write(catLines.join('\n') + '\n' + stats);
}

main().catch(() => {
  process.stdout.write('[-_-] neko unavailable');
});
