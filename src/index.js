const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIST_ID = 'cf2bff0d9e33c2f9112c1e62fe18b5ee';
const PORT_RANGE = [4000, 4999];

/**
 * Gets or assigns a port for the current project.
 * @param {string} projectName - Defaults to the name in package.json
 */
async function getPort(projectName) {
    if (!projectName) {
        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            projectName = pkg.name;
        } catch (e) {
            projectName = path.basename(process.cwd());
        }
    }

    const githubUrl = getGithubUrl();
    const data = await fetchGistData();
    let projectEntry = data.ports.find(p => p.name === projectName);

    if (!projectEntry) {
        const assignedPort = findNextAvailablePort(data.ports);
        projectEntry = {
            name: projectName,
            port: assignedPort,
            github: githubUrl
        };
        data.ports.push(projectEntry);
        await updateGistData(data);
    } else if (projectEntry.github !== githubUrl) {
        projectEntry.github = githubUrl;
        await updateGistData(data);
    }

    return projectEntry.port;
}

function getGithubUrl() {
    try {
        return execSync('git remote get-url origin').toString().trim().replace(/\.git$/, '');
    } catch (e) {
        return 'Local Only';
    }
}

async function fetchGistData() {
    try {
        const rawData = execSync(`gh gist view ${GIST_ID} -f ports.json`).toString();
        return JSON.parse(rawData);
    } catch (e) {
        console.error('Failed to fetch Gist data. Ensure gh is authenticated.');
        return { ports: [] };
    }
}

async function updateGistData(data) {
    try {
        const tmpFile = path.join(process.env.HOME, 'port-manager', 'ports.tmp.json');
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
        execSync(`gh gist edit ${GIST_ID} -f ports.json ${tmpFile}`);
        fs.unlinkSync(tmpFile);
    } catch (e) {
        console.error('Failed to update Gist data.');
        throw e;
    }
}

function findNextAvailablePort(existingPorts) {
    const usedPorts = new Set(existingPorts.map(p => p.port));
    for (let p = PORT_RANGE[0]; p <= PORT_RANGE[1]; p++) {
        if (!usedPorts.has(p)) return p;
    }
    throw new Error('No more ports available in range 4000-4999');
}

module.exports = { getPort };
