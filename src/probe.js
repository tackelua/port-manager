const { execSync } = require('child_process');

/**
 * Checks if a TCP port is currently being listened on locally using lsof.
 * Returns { isListening, pid, command, user }
 */
function probePort(port) {
  try {
    const raw = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -n -P`, {
      stdio: ['pipe', 'pipe', 'ignore']
    }).toString().trim();

    if (!raw) return { isListening: false };

    const lines = raw.split('\n');
    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      return {
        isListening: true,
        command: parts[0] || 'unknown',
        pid: parts[1] || 'unknown',
        user: parts[2] || 'unknown',
        details: lines[1]
      };
    }

    return { isListening: true };
  } catch {
    return { isListening: false };
  }
}

module.exports = { probePort };
