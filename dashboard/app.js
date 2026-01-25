const GIST_ID = 'cf2bff0d9e33c2f9112c1e62fe18b5ee';
let projects = [];

const listEl = document.getElementById('port-list');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');

async function fetchPorts() {
  listEl.innerHTML = '<p class="loading">Fetching data from local server...</p>';

  try {
    const resp = await fetch('/api/ports');
    if (!resp.ok) throw new Error('Failed to fetch ports from local server.');

    const data = await resp.json();
    projects = data.ports;
    renderProjects(projects);
  } catch (err) {
    listEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

function renderProjects(data) {
  if (data.length === 0) {
    listEl.innerHTML = '<p class="empty">No projects managed yet.</p>';
    return;
  }

  listEl.innerHTML = data.map(p => `
    <div class="port-card">
      <div class="card-header">
        <span class="project-name">${p.name}</span>
        <span class="port-badge">${p.port}</span>
      </div>
      <div class="card-body">
        <div class="github-link">
          ${p.github && p.github !== 'Local Only' ? `<a href="${p.github}" target="_blank">View on GitHub</a>` : '<span>Local Only</span>'}
        </div>
        ${p.tunnel ? `
        <div class="tunnel-link">
          <a href="https://${p.tunnel}" target="_blank">🔗 ${p.tunnel}</a>
        </div>` : ''}
      </div>
      <div class="card-footer">
        <button class="ping-btn" onclick="pingProject('${p.port}')">Ping</button>
      </div>
    </div>
  `).join('');
}

async function pingProject(port) {
  // Simple ping via fetch (might fail due to CORS if server doesn't allow it)
  alert(`Attempting to ping localhost:${port}... (Check console for result)`);
  try {
    const start = Date.now();
    await fetch(`http://localhost:${port}`, { mode: 'no-cors' });
    console.log(`Ping to ${port} successful in ${Date.now() - start}ms`);
  } catch (e) {
    console.error(`Ping to ${port} failed`);
  }
}

searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = projects.filter(p => p.name.toLowerCase().includes(term));
  renderProjects(filtered);
});

refreshBtn.addEventListener('click', fetchPorts);

// Initial fetch
fetchPorts();
