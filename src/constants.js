const fs = require('fs');
const path = require('path');
const os = require('os');

const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const PORTCTL_CONFIG_DIR = process.env.PORTCTL_CONFIG_DIR || path.join(XDG_CONFIG_HOME, 'portctl');
const PORT_MANAGER_ROOT = path.join(__dirname, '..');

function getResolvedPaths() {
  const userRegistry = path.join(PORTCTL_CONFIG_DIR, 'registry');
  const userPortsJson = path.join(PORTCTL_CONFIG_DIR, 'ports.json');
  const repoRegistry = path.join(PORT_MANAGER_ROOT, 'registry');
  const repoPortsJson = path.join(PORT_MANAGER_ROOT, 'ports.json');

  // Auto-migrate to ~/.config/portctl if not yet initialized
  if (!fs.existsSync(PORTCTL_CONFIG_DIR)) {
    try {
      fs.mkdirSync(path.join(PORTCTL_CONFIG_DIR, 'machines'), { recursive: true });
      if (fs.existsSync(repoRegistry)) {
        fs.cpSync(repoRegistry, userRegistry, { recursive: true });
      }
      if (fs.existsSync(repoPortsJson)) {
        fs.copyFileSync(repoPortsJson, userPortsJson);
      }
    } catch {}
  }

  if (fs.existsSync(userRegistry)) {
    return {
      registryDir: userRegistry,
      portsJsonPath: userPortsJson
    };
  }

  return {
    registryDir: repoRegistry,
    portsJsonPath: repoPortsJson
  };
}

const { registryDir: REGISTRY_DIR, portsJsonPath: PORTS_JSON_PATH } = getResolvedPaths();
const TUNNEL_CONFIG_PATH = process.env.PORTCTL_TUNNEL_CONFIG || path.join(os.homedir(), 'cloudflare-githsoft', 'tunnel', 'config.yml');
const SYSTEM_TUNNEL_CONFIG_PATH = '/etc/cloudflared/config.yml';

// Forbidden ports for auto-expose to public internet (Security Guardrail)
const SENSITIVE_BLACKLIST_PORTS = new Set([
  5432,  // PostgreSQL
  3306,  // MySQL
  6379,  // Redis
  27017, // MongoDB
  2375,  // Docker daemon
  9222,  // Chrome DevTools Remote Debug
  11434, // Ollama API
  8384   // Syncthing Admin Web UI
]);

function loadUserConfig() {
  const configPath = path.join(PORTCTL_CONFIG_DIR, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }
  return {};
}

function saveUserConfig(config) {
  if (!fs.existsSync(PORTCTL_CONFIG_DIR)) {
    fs.mkdirSync(PORTCTL_CONFIG_DIR, { recursive: true });
  }
  const configPath = path.join(PORTCTL_CONFIG_DIR, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function getGistId() {
  if (process.env.PORTCTL_GIST_ID) return process.env.PORTCTL_GIST_ID;
  const config = loadUserConfig();
  return config.gist_id || null;
}

const DEFAULT_PORT_RANGE = [4000, 4999];

module.exports = {
  PORT_MANAGER_ROOT,
  PORTCTL_CONFIG_DIR,
  REGISTRY_DIR,
  PORTS_JSON_PATH,
  TUNNEL_CONFIG_PATH,
  SYSTEM_TUNNEL_CONFIG_PATH,
  SENSITIVE_BLACKLIST_PORTS,
  DEFAULT_PORT_RANGE,
  loadUserConfig,
  saveUserConfig,
  getGistId
};
