# Githsoft Port Manager Roadmap & Todo 🗺️

This document outlines the strategic roadmap, planned features, and backlog items for `portctl` and the Githsoft Port Management architecture.

---

## 🚀 Released: v2.0.0 (Local-First & Multi-Machine Core)

- [x] **Partitioned Local-First Registry**:
  - `registry/fixed-services.json` (Infra DBs & 3rd-party services)
  - `registry/canonical-apps.json` (SSOT for Githsoft core apps across all machines)
  - `registry/machines/node-<machine>.json` (Per-machine isolated scratchpad & overrides)
- [x] **Zero-Daemon CLI (`portctl`)**:
  - `portctl list`: Table view with real-time TCP socket and PID liveness probing.
  - `portctl get <app>`: Instant port lookup.
  - `portctl assign <app>`: Conflict-free allocation with auto-detection.
  - `portctl check <port>`: Socket inspection and occupying PID reporting.
  - `portctl expose <app>`: Atomic Cloudflare Tunnel ingress configuration, DNS CNAME auto-registration, and zero-downtime daemon reload.
  - `portctl env`: Dynamic `.env` generator and auto-sync (`--write`).
  - `portctl run -- <command>`: Zero-boilerplate runtime `$PORT` injection.
- [x] **Standard Flags & Internationalization**:
  - English developer CLI (`-v`, `--version`, `--help`, subcommands, tables).
- [x] **Security Guardrail**:
  - Hardened Blacklist blocking public exposure of database and sensitive ports (5432, 6379, 8384, 11434, 2375).

---

## 📋 Phase 1: High-Impact Developer Experience (DX) & Clean Client SDK

### 1. Zero-Boilerplate 1-Line Client SDK
- **Problem**: Consumer applications shouldn't need a 30-line candidate search boilerplate in `server.js`.
- **Target DX**:
  ```javascript
  // Option A (Zero code in app - 12-Factor App):
  const PORT = process.env.PORT || 4001; // injected via `portctl run` or `.env`
  
  // Option B (One-liner SDK import):
  const { getPort } = require('portctl');
  const PORT = await getPort() || 4001; // auto-detects app name from process.cwd()
  ```
- **Tasks**:
  - [ ] Package a lightweight `@githsoft/portctl` or link `portctl` client module globally.
  - [ ] Support synchronous and asynchronous port resolution.
  - [ ] Auto-detect project name from `package.json` or Git root if not explicitly provided.

### 2. Zombie Process Hunter (`portctl kill` & `portctl doctor`)
- **Inspiration**: `port-killer`, `unport`.
- **Target DX**:
  - `portctl kill <app | port> [-f]`: Resolves the PID occupying the port via `lsof -ti tcp:<port>` and sends `SIGTERM` (or `SIGKILL` with `-f`).
  - `portctl doctor`: Scans registry entries against live OS socket bindings. Identifies:
    - Stale assignments (registered but offline).
    - Port hijacking (a rogue PID running on a canonical app's port).
    - Missing Cloudflare Tunnel ingress entries or broken CNAMEs.
- **Tasks**:
  - [ ] Add `bin/portctl.js` subcommand `kill`.
  - [ ] Add `bin/portctl.js` subcommand `doctor` with repair recommendations.

---

## 🤖 Phase 2: AI Agent Ecosystem (Model Context Protocol - MCP)

### 3. Native MCP Server (`portctl mcp`)
- **Inspiration**: `PortPilot`.
- **Goal**: Enable AI Coding Agents (Antigravity, Claude Code, Cursor) to manage ports autonomously through standard JSON-RPC stdio.
- **Available Agent Tools**:
  - `portctl_get_port({ appName })`: Retrieve assigned port.
  - `portctl_allocate_port({ appName, scope })`: Request a new conflict-free port.
  - `portctl_check_status({ port })`: Check if a port is in use and by what process.
  - `portctl_expose_tunnel({ appName, subdomain })`: Wire a new service to Cloudflare Tunnel.
- **Tasks**:
  - [ ] Implement `@modelcontextprotocol/sdk` wrapper in `src/mcp.js`.
  - [ ] Add `portctl mcp` command to launch the stdio server.
  - [ ] Document configuration for Antigravity, Claude Code, and Cursor.

---

## 🌐 Phase 3: Local DNS & Monorepo Scaling

### 4. Zero-Daemon Subdomain Forwarder (`*.localhost`)
- **Inspiration**: `hotel`, `puma-dev`.
- **Concept**: RFC 6761 dictates that all modern browsers resolve `*.localhost` to `127.0.0.1` without modifying `/etc/hosts` or setting up custom DNS daemons.
- **Target DX**:
  - Access `http://words.localhost:4000` or `http://tv.localhost:4000` directly in Chrome/Safari.
  - A lightweight, on-demand forwarder proxy forwards HTTP requests matching `Host: <app>.localhost` to the target port recorded in `ports.json`.
- **Tasks**:
  - [ ] Implement optional lightweight HTTP reverse proxy (`src/proxy.js`).
  - [ ] Add command `portctl proxy [--port 80|4000]`.

### 5. Git Worktree-Aware Port Offsetting
- **Inspiration**: `devports`.
- **Concept**: When developing on multiple Git worktree branches simultaneously (e.g. `main` and `feature-auth`), the same app name would collide on the canonical port.
- **Target DX**:
  - `portctl run` detects if current branch is in a secondary Git worktree.
  - Automatically offsets port (e.g. `4004` -> `3000 + hash(worktree_path)`) from the Scratchpad range.
- **Tasks**:
  - [ ] Add `isGitWorktree()` helper to `src/detector.js`.
  - [ ] Dynamically assign scratchpad port when inside a worktree.

### 6. Interactive Terminal TUI (`portctl top`)
- **Inspiration**: `lsport`, `portboard`.
- **Concept**: A terminal dashboard providing real-time process monitoring, memory consumption, and one-key shortcuts:
  - `k`: Kill process occupying selected port.
  - `e`: Expose selected port to Cloudflare Tunnel.
  - `o`: Open target port or Cloudflare URL in default browser.
- **Tasks**:
  - [ ] Build terminal UI using `ink` or `blessed`.
