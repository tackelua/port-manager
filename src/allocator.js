const registry = require('./registry');
const { probePort } = require('./probe');
const { DEFAULT_PORT_RANGE } = require('./constants');
const { getMachineNodeId, getGitRemoteUrl } = require('./detector');

class PortAllocator {
  /**
   * Gets existing port or allocates a new one for an app.
   */
  allocate(appName, options = {}) {
    const existing = registry.findByName(appName);
    if (existing) {
      return {
        port: existing.port,
        isNew: false,
        entry: existing
      };
    }

    // If explicit fixed port requested
    if (options.fixedPort) {
      const fixedPort = parseInt(options.fixedPort, 10);
      const conflict = registry.findByPort(fixedPort);
      if (conflict && conflict.name !== appName) {
        throw new Error(`Port ${fixedPort} đã được đăng ký bởi dịch vụ '${conflict.name}'!`);
      }

      if (options.scope === 'local') {
        const fixedData = registry.loadFixedServices();
        fixedData.services[appName] = {
          port: fixedPort,
          scope: 'machine-local',
          category: options.category || 'general',
          description: options.description || ''
        };
        registry.saveFixedServices(fixedData);
      } else {
        const canonicalData = registry.loadCanonicalApps();
        canonicalData.apps[appName] = {
          port: fixedPort,
          tunnel: options.domain || null,
          repo: options.repo || getGitRemoteUrl(),
          description: options.description || ''
        };
        registry.saveCanonicalApps(canonicalData);
      }

      return {
        port: fixedPort,
        isNew: true,
        entry: registry.findByName(appName)
      };
    }

    // Auto-allocate next available port
    const nextPort = this.findNextAvailable(DEFAULT_PORT_RANGE[0], DEFAULT_PORT_RANGE[1]);
    const nodeId = getMachineNodeId();
    const repo = options.repo || getGitRemoteUrl();

    // Default to Canonical Apps if global, else machine allocation
    const canonicalData = registry.loadCanonicalApps();
    canonicalData.apps[appName] = {
      port: nextPort,
      tunnel: options.domain || null,
      repo: repo,
      description: options.description || `Allocated on ${nodeId}`
    };
    registry.saveCanonicalApps(canonicalData);

    return {
      port: nextPort,
      isNew: true,
      entry: registry.findByName(appName)
    };
  }

  findNextAvailable(start = DEFAULT_PORT_RANGE[0], end = DEFAULT_PORT_RANGE[1]) {
    const all = registry.getAllMerged();
    const usedPorts = new Set(all.map(item => item.port));

    for (let p = start; p <= end; p++) {
      // 1. Must not be recorded in registry
      if (usedPorts.has(p)) continue;

      // 2. Must not be currently listening on the active machine stack (Active Socket Probe)
      const probe = probePort(p);
      if (probe.isListening) continue;

      return p;
    }

    throw new Error(`Không còn port trống trong dải ${start}-${end}!`);
  }
}

module.exports = new PortAllocator();
