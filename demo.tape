# NekoFree Demo — GIF for GitHub README
# Usage: vhs demo.tape

Output demo.gif

# --- Terminal settings ---
Set Shell "zsh"
Set FontFamily "Hack Nerd Font Mono"
Set FontSize 20
Set Width 1400
Set Height 800
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set CursorBlink false

# --- Launch NekoFree ---
Type "./nekofree"
Sleep 500ms
Enter
Sleep 4s

# --- Ask about the project ---
Type "Опиши кратко что такое NekoFree, в 2-3 предложения"
Sleep 500ms
Enter

# Mascot: idle → thinking (blue pixel) → generating text
Sleep 12s

# --- Trigger tool_running: read a file ---
Type "Покажи первые 10 строк package.json"
Sleep 500ms
Enter

# Mascot: thinking → tool_running (ー ー eyes, blue glow) → done (green sparkles)
Sleep 8s

# --- Trigger tool_running: search in codebase ---
Type "Найди где определён маскот"
Sleep 500ms
Enter

# Mascot cycles through states again — grep/glob tools fire
Sleep 10s

# --- Let the viewer see the final state ---
Sleep 3s
