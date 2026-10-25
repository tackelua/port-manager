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
    projects = data.ports || [];
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

  listEl.innerHTML = data.map(p => {
    const isOnline = p.status === 'online';
    const statusClass = isOnline ? 'status-online' : 'status-offline';
    const statusText = isOnline ? `● ONLINE (PID ${p.pid || ''})` : '○ OFFLINE';

    return `
      <div class="port-card ${statusClass}">
        <div class="card-header">
          <span class="project-name">${p.name}</span>
          <span class="port-badge">${p.port}</span>
        </div>
        <div class="card-body">
          <div class="status-indicator ${statusClass}">${statusText}</div>
          <div class="scope-tag" style="font-size: 0.8rem; color: #888; margin-bottom: 4px;">
            ${p.scope || 'canonical-global'}
          </div>
          <div class="github-link">
            ${p.github && p.github !== 'Local Only' ? `<a href="${p.github}" target="_blank">View on GitHub</a>` : '<span>Local Only</span>'}
          </div>
          ${p.tunnel ? `
          <div class="tunnel-link" style="margin-top: 6px;">
            <a href="https://${p.tunnel}" target="_blank" style="color: #64b5f6; text-decoration: none;">🔗 ${p.tunnel}</a>
          </div>` : ''}
        </div>
        <div class="card-footer">
          <a class="ping-btn" href="http://localhost:${p.port}" target="_blank" style="text-align: center; text-decoration: none; display: inline-block;">Open Local</a>
        </div>
      </div>
    `;
  }).join('');
}

searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(term) ||
    String(p.port).includes(term) ||
    (p.tunnel && p.tunnel.toLowerCase().includes(term))
  );
  renderProjects(filtered);
});

refreshBtn.addEventListener('click', fetchPorts);

// Initial fetch
fetchPorts();
