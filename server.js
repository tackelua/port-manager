const fastify = require('fastify')({ logger: true });
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const { registerPort } = require('./src');
const { GIST_ID } = require('./src/constants');

// Initialized via registerPort inside start()
let PORT;

// Register static files
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'dashboard'),
    prefix: '/',
});

// API to fetch ports from Gist
fastify.get('/api/ports', async (request, reply) => {
    try {
        const rawData = execSync(`gh gist view ${GIST_ID} -f ports.json`).toString();
        return JSON.parse(rawData);
    } catch (e) {
        fastify.log.error(e);
        reply.status(500).send({ error: 'Failed to fetch Gist data' });
    }
});

const start = async () => {
    try {
        PORT = await registerPort('port-manager');
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Port Manager Dashboard running at http://localhost:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
