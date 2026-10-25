# `portctl` Open Source Transition Plan & Architecture Blueprint 🚀

This document defines the comprehensive strategy, technical milestones, and security hardening required to release `portctl` to the international open-source community as a Tier-1 developer tool.

---

## 🎯 Vision & Positioning

- **Name**: `portctl` (Unified 1:1: Repo `portctl` = CLI `portctl` = Package `portctl`).
- **Description**: Lightweight, local-first port manager and automated edge ingress for modern multi-machine development workflows.
- **Key Differentiator**: Zero-daemon overhead, multi-machine conflict-free partitioned storage, universal language support, and native edge tunnel automation.

---

## 📐 Milestone 1: Decoupling & XDG Base Directory Standard

### 1. Separation of Code vs User Data
The repository must contain **zero personal data, machine hostnames, or specific topology**:
- **Codebase Repository**: Source code, documentation, tests, and clean templates (`registry.example/`).
- **User Configuration**: `$XDG_CONFIG_HOME/portctl/config.json` (`~/.config/portctl/config.json`).
  ```json
  {
    "node_id": "node-laptop",
    "gist_id": "optional-personal-gist-id",
    "sync_provider": "local",
    "ingress_domain": "local.dev"
  }
  ```
- **User Data & Registries**: `$XDG_DATA_HOME/portctl/registry/` (`~/.local/share/portctl/` or `~/.config/portctl/registry/`).

### 2. Elimination of Hardcoded Secrets & Identities
- [x] Removed hardcoded `GIST_ID` from source code; moved to user config with auto-discovery.
- [x] Replaced hardcoded paths (`/Users/gith/...`) with `os.homedir()` and environment overrides (`PORTCTL_CONFIG_DIR`, `PORTCTL_REGISTRY_DIR`).
- [x] Dynamic machine identification: reads `node_id` from `config.json` or derives cleanly from sanitized system hostname.

---

## 🌐 Milestone 2: Polyglot Auto-Detection & Zero-Code Integration

### 1. Smart Manifest Project Detection
When `portctl.get()` is invoked without arguments, it ascends the directory tree to project root and auto-detects the project name across ecosystems:
1. **Node.js**: `package.json` (`name`, stripping scope)
2. **Python**: `pyproject.toml` (`name`), `setup.py`, `Pipfile`
3. **Rust**: `Cargo.toml` (`package.name`)
4. **Go**: `go.mod` (module tail name)
5. **PHP**: `composer.json` (`name`)
6. **Java/Kotlin**: `pom.xml` (`artifactId`), `settings.gradle` (`rootProject.name`)
7. **Elixir**: `mix.exs` (`app: :name`)
8. **Git**: Remote origin repository basename
9. **Directory**: Root folder basename

### 2. Standard 3-Tier Integration Pattern
```javascript
// Node.js (Express / Fastify)
let portctl; try { portctl = require('portctl'); } catch {}
const PORT = process.env.PORT || portctl?.get() || 4000;
```
```python
# Python (FastAPI / Flask)
import os, portctl
PORT = int(os.getenv("PORT") or portctl.get() or 8000)
```
```bash
# Universal (Any language / Zero code change)
portctl run -- uvicorn main:app
portctl run -- go run .
portctl run -- npm run dev
```

---

## ⚡ Milestone 3: Rust Core Engine (`portctl-rs`)

To eliminate runtime friction for non-Node.js developers (Python, Go, C++, Rust), the core CLI will evolve into a single static binary:

| Feature | Node.js Implementation | Rust Target (`portctl-rs`) |
| :--- | :--- | :--- |
| **Binary Size** | Requires Node.js + npm | **~3.5 MB static binary** |
| **Startup Time** | ~150 ms – 200 ms | **< 3 ms** |
| **Distribution** | npm only | **`brew install portctl`**, Cargo, GitHub Releases |
| **Socket Inspection** | Subprocess `lsof` (macOS/Linux) | Native Kernel APIs (`netstat2`, `libc`, `sysctl`) |
| **Concurrency** | Single-thread JS | Thread-safe POSIX advisory file locking (`fd-lock`) |

### Rust Crate Architecture:
- `clap`: CLI argument parsing with shell auto-completions (zsh, bash, fish).
- `serde` / `serde_json` / `serde_yaml`: High-speed zero-copy parsing.
- `ratatui`: Interactive Terminal UI for `portctl top`.
- `cargo-dist`: Automated release matrix for macOS (Intel & Apple Silicon), Linux (x86_64 & ARM), and Windows.

---

## 🛡️ Milestone 4: Threat Modeling & Security Hardening

### 1. Guardrail Against Accidental Public Ingress Exposure
- **Strict Protocol Filtering**: Block non-HTTP protocols (PostgreSQL 5432, Redis 6379, MongoDB 27017, Docker 2375, SSH 22) from being exposed through HTTP edge tunnels.
- **Interactive Double-Confirmation**: For unclassified or sensitive ports, mandate explicit uppercase terminal confirmation before registering tunnel routes.
- **Loopback Enforcement**: Enforce and verify that exposed services bind exclusively to `127.0.0.1` or `::1`, preventing open listener leakage onto public Wi-Fi networks (`0.0.0.0`).

### 2. Elimination of Command Injection Vulnerabilities
- [x] Disallow `shell: true` execution in `portctl run`. Use atomic array arguments: `spawnSync(binary, argsArray, { shell: false })`.
- [x] RFC 1123 domain name verification before passing arguments to tunneling daemons.

### 3. Concurrency Safety & Data Integrity
- **Atomic File Writes**: Write to a temporary file on the same filesystem partition and execute an atomic `rename(2)` to eliminate file corruption during abrupt termination or power failure.
- **POSIX Advisory File Locks**: Guard registry reads and writes with mutex locks to eliminate race conditions across concurrent terminal sessions.
- **Strict Permissions (`0600`)**: Ensure registry files are accessible strictly by the owning user.

---

## 🚀 Milestone 5: Community Launch Checklist

- [ ] **License**: Adopt Apache-2.0 or MIT license.
- [ ] **Clean History**:
  - Archive internal repository to private backup.
  - Create clean orphan branch: `git checkout --orphan oss-main`.
  - Initial public commit: `feat: initial release of portctl v2.0.0`.
- [ ] **Automated CI/CD**:
  - GitHub Actions matrix (Lint, Test, Cross-compile).
  - Automated secret scanning via `gitleaks`.
  - Homebrew tap repository (`tackelua/homebrew-tap/portctl`).
- [ ] **Documentation**:
  - `CONTRIBUTING.md` (Code of conduct, developer setup).
  - `SECURITY.md` (Vulnerability disclosure policy).
