const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function getMachineNodeId() {
  const configPath = path.join(os.homedir(), '.config', 'portctl', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.node_id) return cfg.node_id;
    } catch {}
  }

  const customIdFile = path.join(os.homedir(), '.portctl-node-id');
  if (fs.existsSync(customIdFile)) {
    try {
      const id = fs.readFileSync(customIdFile, 'utf8').trim();
      if (id) return id;
    } catch {}
  }

  const hostname = os.hostname().toLowerCase();
  if (hostname.includes('mini')) return 'node-macmini';
  if (hostname.includes('book') || hostname.includes('laptop')) return 'node-macbook';
  return `node-${hostname.replace(/[^a-z0-9_-]/g, '')}`;
}

/**
 * Finds the project root by walking up from current directory.
 */
function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  const markers = [
    'package.json',
    'pyproject.toml',
    'setup.py',
    'Cargo.toml',
    'go.mod',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'mix.exs',
    '.git'
  ];

  while (current && current !== root) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(current, marker))) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return startDir;
}

/**
 * Auto-detects project/app name across multiple languages & frameworks:
 * 1. Node.js (package.json)
 * 2. Python (pyproject.toml, setup.py, Pipfile)
 * 3. Rust (Cargo.toml)
 * 4. Go (go.mod)
 * 5. PHP (composer.json)
 * 6. Java/Kotlin (pom.xml, build.gradle, settings.gradle)
 * 7. Elixir (mix.exs)
 * 8. Git Repository name (from remote origin)
 * 9. Folder basename
 */
function detectProjectName(startDir = process.cwd()) {
  const dir = findProjectRoot(startDir);

  // 1. Node.js (package.json)
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) {
        // Strip npm scope (e.g. @org/my-app -> my-app) if desired, or keep as is
        const cleanName = pkg.name.startsWith('@') ? pkg.name.split('/')[1] : pkg.name;
        if (cleanName) return cleanName;
      }
    } catch {}
  }

  // 2. Python (pyproject.toml)
  const pyprojectPath = path.join(dir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      const match = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  // 3. Python (setup.py)
  const setupPath = path.join(dir, 'setup.py');
  if (fs.existsSync(setupPath)) {
    try {
      const content = fs.readFileSync(setupPath, 'utf8');
      const match = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  // 4. Rust (Cargo.toml)
  const cargoPath = path.join(dir, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      const match = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  // 5. Go (go.mod)
  const goModPath = path.join(dir, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, 'utf8');
      const match = content.match(/^module\s+([^\s\r\n]+)/m);
      if (match && match[1]) {
        const parts = match[1].split('/');
        return parts[parts.length - 1];
      }
    } catch {}
  }

  // 6. PHP (composer.json)
  const composerPath = path.join(dir, 'composer.json');
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
      if (composer.name) {
        const parts = composer.name.split('/');
        return parts[parts.length - 1] || composer.name;
      }
    } catch {}
  }

  // 7. Java/Kotlin (pom.xml or settings.gradle)
  const pomPath = path.join(dir, 'pom.xml');
  if (fs.existsSync(pomPath)) {
    try {
      const content = fs.readFileSync(pomPath, 'utf8');
      const match = content.match(/<artifactId>([^<]+)<\/artifactId>/);
      if (match && match[1]) return match[1].trim();
    } catch {}
  }
  const gradleSettings = path.join(dir, 'settings.gradle');
  if (fs.existsSync(gradleSettings)) {
    try {
      const content = fs.readFileSync(gradleSettings, 'utf8');
      const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  // 8. Elixir (mix.exs)
  const mixPath = path.join(dir, 'mix.exs');
  if (fs.existsSync(mixPath)) {
    try {
      const content = fs.readFileSync(mixPath, 'utf8');
      const match = content.match(/app:\s*:([a-zA-Z0-9_]+)/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  // 9. Git Remote Origin URL
  try {
    const gitRemote = execSync('git remote get-url origin', { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitRemote) {
      const match = gitRemote.match(/\/([^/]+?)(?:\.git)?$/);
      if (match && match[1]) return match[1];
    }
  } catch {}

  // 10. Fallback to folder name
  return path.basename(dir);
}

function getGitRemoteUrl(dir = process.cwd()) {
  try {
    return execSync('git remote get-url origin', { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .replace(/\.git$/, '');
  } catch {
    return 'Local Only';
  }
}

module.exports = {
  getMachineNodeId,
  detectProjectName,
  findProjectRoot,
  getGitRemoteUrl
};
