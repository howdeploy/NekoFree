#!/usr/bin/env bash
set -euo pipefail

# NekoFree installer
# Usage: curl -fsSL https://raw.githubusercontent.com/howdeploy/nekofree/main/install.sh | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

REPO="https://github.com/howdeploy/nekofree.git"
INSTALL_DIR="$HOME/nekofree"
BUN_MIN_VERSION="1.3.11"

info()  { printf "${CYAN}[*]${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}[+]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[!]${RESET} %s\n" "$*"; }
fail()  { printf "${RED}[x]${RESET} %s\n" "$*"; exit 1; }

header() {
  echo ""
  printf "${BOLD}${CYAN}"
  cat << 'ART'
  _   _      _          _____
 | \ | | ___| | _____  |  ___| __ ___  ___
 |  \| |/ _ \ |/ / _ \ | |_ | '__/ _ \/ _ \
 | |\  |  __/   < (_) ||  _|| | |  __/  __/
 |_| \_|\___|_|\_\___/ |_|  |_|  \___|\___|

ART
  printf "${RESET}"
  printf "${DIM}  NekoFree — your Claude Code${RESET}\n"
  echo ""
}

# -------------------------------------------------------------------
# System checks
# -------------------------------------------------------------------

check_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      fail "Unsupported OS: $(uname -s). macOS or Linux required." ;;
  esac
  ok "OS: $(uname -s) $(uname -m)"
}

check_git() {
  if ! command -v git &>/dev/null; then
    fail "git is not installed. Install it first:
    macOS:  xcode-select --install
    Linux:  sudo apt install git  (or your distro's equivalent)"
  fi
  ok "git: $(git --version | head -1)"
}

# Compare semver: returns 0 if $1 >= $2
version_gte() {
  [ "$(printf '%s\n' "$1" "$2" | sort -V | head -1)" = "$2" ]
}

check_bun() {
  if command -v bun &>/dev/null; then
    local ver
    ver="$(bun --version 2>/dev/null || echo "0.0.0")"
    if version_gte "$ver" "$BUN_MIN_VERSION"; then
      ok "bun: v${ver}"
      return
    fi
    warn "bun v${ver} found but v${BUN_MIN_VERSION}+ required. Upgrading..."
  else
    info "bun not found. Installing..."
  fi
  install_bun
}

install_bun() {
  curl -fsSL https://bun.sh/install | bash
  # Source the updated profile so bun is on PATH for this session
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun &>/dev/null; then
    fail "bun installation succeeded but binary not found on PATH.
    Add this to your shell profile and restart:
      export PATH=\"\$HOME/.bun/bin:\$PATH\""
  fi
  ok "bun: v$(bun --version) (just installed)"
}

# -------------------------------------------------------------------
# Clone & build
# -------------------------------------------------------------------

clone_repo() {
  if [ -d "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR already exists"
    if [ -d "$INSTALL_DIR/.git" ]; then
      info "Pulling latest changes..."
      git -C "$INSTALL_DIR" pull --ff-only origin main 2>/dev/null || {
        warn "Pull failed, continuing with existing copy"
      }
    fi
  else
    info "Cloning repository..."
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
  fi
  ok "Source: $INSTALL_DIR"
}

install_deps() {
  info "Installing dependencies..."
  cd "$INSTALL_DIR"
  bun install --frozen-lockfile 2>/dev/null || bun install
  ok "Dependencies installed"
}

build_binary() {
  info "Building NekoFree (all experimental features enabled)..."
  cd "$INSTALL_DIR"
  bun run build:dev:full
  ok "Binary built: $INSTALL_DIR/nekofree-dev"
}

setup_codex_config() {
  local codex_dir="$HOME/.codex"
  mkdir -p "$codex_dir"

  local config_file="$codex_dir/config.toml"
  local auth_file="$codex_dir/auth.json"

  # Patch or create config.toml with nekocode provider
  if [ -f "$config_file" ]; then
    # Inject model_provider if missing
    if ! grep -q 'model_provider' "$config_file"; then
      sed -i 's/^model = /model_provider = "nekocode"\nmodel = /' "$config_file"
      info "Patched existing $config_file (added model_provider)"
    fi
    # Inject [model_providers.nekocode] block if missing
    if ! grep -q '\[model_providers.nekocode\]' "$config_file"; then
      cat >> "$config_file" << 'TOML'

[model_providers.nekocode]
name = "nekocode"
base_url = "https://gateway.nekocode.app/andromeda/v1"
wire_api = "responses"
requires_openai_auth = true
TOML
      info "Added [model_providers.nekocode] to $config_file"
    fi
  else
    cat > "$config_file" << 'TOML'
model_provider = "nekocode"
model = "gpt-5.4"

[model_providers.nekocode]
name = "nekocode"
base_url = "https://gateway.nekocode.app/andromeda/v1"
wire_api = "responses"
requires_openai_auth = true
TOML
    ok "Created $config_file"
  fi

  # Create auth.json if missing or OPENAI_API_KEY is not set
  if [ ! -f "$auth_file" ] || ! grep -q '"OPENAI_API_KEY"' "$auth_file"; then
    cat > "$auth_file" << 'JSON'
{
  "OPENAI_API_KEY": "sk_neko_your_api_key"
}
JSON
    ok "Created $auth_file"
    warn "Replace sk_neko_your_api_key in $auth_file with your real nekocode key"
  else
    info "Skipped $auth_file (already has OPENAI_API_KEY)"
  fi
}

link_binary() {
  local link_dir="$HOME/.local/bin"
  mkdir -p "$link_dir"

  ln -sf "$INSTALL_DIR/nekofree-dev" "$link_dir/nekofree"
  ok "Symlinked: $link_dir/nekofree"

  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$link_dir"; then
    warn "$link_dir is not on your PATH"
    echo ""
    printf "${YELLOW}  Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):${RESET}\n"
    printf "${BOLD}    export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}\n"
    echo ""
  fi
}

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

header
info "Starting installation..."
echo ""

check_os
check_git
check_bun
echo ""

clone_repo
install_deps
build_binary
link_binary
setup_codex_config

echo ""
printf "${GREEN}${BOLD}  Installation complete!${RESET}\n"
echo ""
printf "  ${BOLD}Run it:${RESET}\n"
printf "    ${CYAN}nekofree${RESET}                           # interactive REPL\n"
printf "    ${CYAN}nekofree -p \"your prompt\"${RESET}           # one-shot mode\n"
echo ""
printf "  ${BOLD}Set your API key (edit config or env):${RESET}\n"
printf "    ${CYAN}export ANTHROPIC_API_KEY=\"your-key\"${RESET}\n"
printf "    ${DIM}or edit ~/.nekofree/config.json → apiKey${RESET}\n"
echo ""
printf "  ${BOLD}Codex routed via nekocode gateway:${RESET}\n"
printf "    ${DIM}Edit ~/.codex/auth.json → replace sk_neko_your_api_key${RESET}\n"
echo ""
printf "  ${DIM}Source: $INSTALL_DIR${RESET}\n"
printf "  ${DIM}Binary: $INSTALL_DIR/nekofree-dev${RESET}\n"
printf "  ${DIM}Link:   ~/.local/bin/nekofree${RESET}\n"
echo ""
