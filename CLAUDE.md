# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

This project is **NekoFree** — a fork of Claude Code with pre-configured API gateway defaults (nekocode.app). Users can override the API key, base URL, and model via `~/.nekofree.json` or environment variables.

## Common commands

```bash
# Install dependencies
bun install

# Standard build (./nekofree)
bun run build

# Dev build (./nekofree-dev)
bun run build:dev

# Dev build with all experimental features (./nekofree-dev)
bun run build:dev:full

# Compiled build (./dist/nekofree)
bun run compile

# Run from source without compiling
bun run dev
```

Run the built binary with `./nekofree` or `./nekofree-dev`. Set `ANTHROPIC_API_KEY` in the environment or use OAuth via `./nekofree /login`.

## High-level architecture

- **Entry point/UI loop**: src/entrypoints/cli.tsx bootstraps the CLI, with the main interactive UI in src/screens/REPL.tsx (Ink/React).
- **Command/tool registries**: src/commands.ts registers slash commands; src/tools.ts registers tool implementations. Implementations live in src/commands/ and src/tools/.
- **LLM query pipeline**: src/QueryEngine.ts coordinates message flow, tool use, and model invocation.
- **Core subsystems**:
  - src/services/: API clients, OAuth/MCP integration, analytics stubs
  - src/state/: app state store
  - src/hooks/: React hooks used by UI/flows
  - src/components/: terminal UI components (Ink)
  - src/skills/: skill system
  - src/plugins/: plugin system
  - src/bridge/: IDE bridge
  - src/voice/: voice input
  - src/tasks/: background task management

## Build system

- scripts/build.ts is the build script and feature-flag bundler. Feature flags are set via build arguments (e.g., `--feature=ULTRAPLAN`) or presets like `--feature-set=dev-full` (see README for details).