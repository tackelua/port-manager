const registry = require('./registry');
const allocator = require('./allocator');
const tunnel = require('./tunnel');
const { probePort } = require('./probe');
const { detectProjectName, getGitRemoteUrl, getMachineNodeId } = require('./detector');

/**
 * Backward-compatible registerPort for all projects.
 * Runs instantly in <1ms from local SSD without blocking network calls.
 * @param {string} [projectName]
 * @returns {Promise<number>}
 */
async function registerPort(projectName) {
  if (!projectName) {
    projectName = detectProjectName(process.cwd());
  }

  const result = allocator.allocate(projectName, {
    repo: getGitRemoteUrl(process.cwd())
  });

  return result.port;
}

/**
 * Gets registered port for an app.
 */
function getPort(projectName) {
  if (!projectName) projectName = detectProjectName(process.cwd());
  const entry = registry.findByName(projectName);
  return entry ? entry.port : null;
}

/**
 * Lists all registered ports.
 */
function listPorts() {
  return registry.getAllMerged();
}

module.exports = {
  get: getPort,
  getPort,
  registerPort,
  listPorts,
  probePort,
  registry,
  allocator,
  tunnel,
  detectProjectName,
  getMachineNodeId
};
