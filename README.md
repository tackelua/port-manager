# Githsoft Port Manager (`portctl`) 🚀

A lightweight, local-first port management and automated Cloudflare Tunnel ingress system designed for multi-machine developer workflows.

---

## 🌟 Key Highlights

- **Dual-Scope Taxonomy**:
  - `canonical-global` (4000-4099): Dedicated SSOT ports for core apps, consistent across Mac Mini, MacBook, and remote environments.
  - `machine-local` (5000+, 3rd-party infra): PostgreSQL (5432), Redis (6379), Syncthing (8384), Ollama (11434).
- **Partitioned Storage (Zero Sync Conflict)**:
  - Partitioned per-node files (`registry/machines/node-<machine>.json`) eliminate Git/Syncthing merge conflicts when developing offline across devices.
- **Zero-Daemon Overhead**:
  - Direct kernel socket binding with sub-millisecond local SSD queries. No background proxy hogging memory or port 80/443.
- **Automated Cloudflare Ingress**:
  - One-command public exposure via Cloudflare Tunnel (`portctl expose <app>`) with automatic DNS CNAME registration and zero-downtime daemon reload.
- **Hardened Security Guardrail**:
  - Automatically blocks dangerous database and service ports from accidental public exposure.

---

## 💻 CLI Usage (`portctl`)

```bash
# List all registered ports and live PID status
portctl list

# Inspect TCP socket occupancy
portctl check 4001

# Retrieve assigned port for an application
portctl get word-frequency-analyzer

# Assign or allocate a port
portctl assign my-new-app

# Expose local port via Cloudflare Tunnel
portctl expose word-frequency-analyzer --domain words.githsoft.com

# Sync or write .env file with assigned PORT
portctl env --write

# Run any dev server with injected $PORT
portctl run -- npm run dev
```

---

## 🔌 Integration Patterns for Applications

### Pattern 1: 12-Factor Standard (Zero Boilerplate - Recommended)
Keep application code 100% clean and free of proprietary tooling:
```javascript
// server.js
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
```
- During local development: Run with `portctl run -- npm run dev` or run `portctl env --write` once to populate `.env.local`.
- In PM2 or production: Managed via environment configuration.

### Pattern 2: Programmatic SDK
```javascript
const { getPort } = require('./lib/port-manager');

async function start() {
  const port = process.env.PORT || getPort() || 4001;
  app.listen(port);
}
```

---

## 🗺️ Roadmap & Backlog

See [ROADMAP.md](./ROADMAP.md) for planned features:
- `portctl kill` & `portctl doctor` (Zombie process cleaner)
- Model Context Protocol (MCP) Server for AI Coding Agents
- Zero-daemon `*.localhost` forwarder proxy
- Git worktree-aware port offsetting
- Interactive terminal TUI (`portctl top`)
