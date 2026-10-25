const fs = require('fs');
const path = require('path');
const { REGISTRY_DIR, PORTS_JSON_PATH } = require('./constants');
const { getMachineNodeId } = require('./detector');

class PortRegistry {
  constructor() {
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(REGISTRY_DIR)) {
      fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    }
    const machinesDir = path.join(REGISTRY_DIR, 'machines');
    if (!fs.existsSync(machinesDir)) {
      fs.mkdirSync(machinesDir, { recursive: true });
    }
  }

  loadFixedServices() {
    const filePath = path.join(REGISTRY_DIR, 'fixed-services.json');
    if (!fs.existsSync(filePath)) return { services: {} };
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { services: {} };
    }
  }

  loadCanonicalApps() {
    const filePath = path.join(REGISTRY_DIR, 'canonical-apps.json');
    if (!fs.existsSync(filePath)) return { apps: {} };
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { apps: {} };
    }
  }

  loadMachineAllocations(nodeId) {
    const filePath = path.join(REGISTRY_DIR, 'machines', `${nodeId}.json`);
    if (!fs.existsSync(filePath)) return { allocated: {} };
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { allocated: {} };
    }
  }

  loadAllMachines() {
    const machinesDir = path.join(REGISTRY_DIR, 'machines');
    const files = fs.readdirSync(machinesDir).filter(f => f.endsWith('.json'));
    const result = {};
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(machinesDir, file), 'utf8'));
        const nodeId = file.replace(/\.json$/, '');
        result[nodeId] = content;
      } catch {}
    }
    return result;
  }

  saveFixedServices(data) {
    const filePath = path.join(REGISTRY_DIR, 'fixed-services.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    this.syncPortsJson();
  }

  saveCanonicalApps(data) {
    const filePath = path.join(REGISTRY_DIR, 'canonical-apps.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    this.syncPortsJson();
  }

  saveMachineAllocation(nodeId, appName, portData) {
    const filePath = path.join(REGISTRY_DIR, 'machines', `${nodeId}.json`);
    let machineData = { node_id: nodeId, allocated: {} };
    if (fs.existsSync(filePath)) {
      try {
        machineData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {}
    }
    if (!machineData.allocated) machineData.allocated = {};
    machineData.allocated[appName] = {
      ...portData,
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(machineData, null, 2), 'utf8');
    this.syncPortsJson();
  }

  getAllMerged(currentNodeId = getMachineNodeId()) {
    const fixed = this.loadFixedServices().services || {};
    const canonical = this.loadCanonicalApps().apps || {};
    const machines = this.loadAllMachines();

    const merged = [];

    // 1. Add canonical apps
    for (const [name, app] of Object.entries(canonical)) {
      merged.push({
        name,
        port: app.port,
        scope: 'canonical-global',
        type: 'custom',
        tunnel: app.tunnel || null,
        repo: app.repo || 'Local Only',
        description: app.description || ''
      });
    }

    // 2. Add fixed services
    for (const [name, svc] of Object.entries(fixed)) {
      // If canonical already defined, skip or keep
      if (!merged.find(m => m.name === name)) {
        merged.push({
          name,
          port: svc.port,
          scope: svc.scope || 'machine-local',
          type: 'fixed_third_party',
          tunnel: svc.tunnel || null,
          repo: 'Local Only',
          description: svc.description || ''
        });
      }
    }

    // 3. Add machine-specific allocations
    for (const [mId, mData] of Object.entries(machines)) {
      for (const [name, alloc] of Object.entries(mData.allocated || {})) {
        if (!merged.find(m => m.name === name)) {
          merged.push({
            name,
            port: alloc.port,
            scope: `machine:${mId}`,
            type: 'machine_allocated',
            tunnel: alloc.tunnel || null,
            repo: alloc.repo || 'Local Only',
            description: alloc.description || ''
          });
        }
      }
    }

    // Sort by port
    merged.sort((a, b) => a.port - b.port);
    return merged;
  }

  findByName(name) {
    const all = this.getAllMerged();
    return all.find(item => item.name === name);
  }

  findByPort(port) {
    const all = this.getAllMerged();
    return all.find(item => item.port === port);
  }

  syncPortsJson() {
    try {
      const merged = this.getAllMerged();
      const legacyData = {
        version: '2.0.0',
        last_updated: new Date().toISOString(),
        ports: merged.map(m => ({
          name: m.name,
          port: m.port,
          github: m.repo || 'Local Only',
          tunnel: m.tunnel || null
        }))
      };
      fs.writeFileSync(PORTS_JSON_PATH, JSON.stringify(legacyData, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to sync ports.json:', e.message);
    }
  }
}

module.exports = new PortRegistry();
