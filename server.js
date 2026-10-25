const fastify = require('fastify')({ logger: false });
const path = require('path');

const { registerPort, registry, probePort, getMachineNodeId } = require('./src');

let PORT;

// Register static files
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'dashboard'),
  prefix: '/'
});

// API to fetch all ports with real-time liveness status
fastify.get('/api/ports', async (request, reply) => {
  try {
    const all = registry.getAllMerged();
    const ports = all.map(item => {
      const probe = probePort(item.port);
      return {
        name: item.name,
        port: item.port,
        github: item.repo || 'Local Only',
        tunnel: item.tunnel || null,
        scope: item.scope,
        type: item.type,
        status: probe.isListening ? 'online' : 'offline',
        pid: probe.pid || null,
        command: probe.command || null
      };
    });

    return {
      version: '2.0.0',
      node_id: getMachineNodeId(),
      ports
    };
  } catch (e) {
    reply.status(500).send({ error: e.message });
  }
});

const start = async () => {
  try {
    PORT = await registerPort('port-manager');
    const HOST = process.env.HOST || '127.0.0.1';
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Port Manager Dashboard running at http://${HOST}:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
