// ─── Job Board Module ─────────────────────────────────────────────────────────

(function () {
    const grid = document.getElementById('jobs-grid');
    const search = document.getElementById('jobs-search');
    const counter = document.getElementById('jobs-count');

    let filters = { type: 'All', location: 'All', stack: 'All', query: '' };
    let saved = new Set(JSON.parse(localStorage.getItem('w3ai_saved_jobs') || '[]'));

    // ── Dynamic chip builder ─────────────────────────────────────────────────
    function buildChips(containerId, values, filterKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        values.forEach(v => {
            const chip = document.createElement('button');
            chip.className = 'chip' + (v === 'All' ? ' active' : '');
            chip.textContent = v;
            chip.addEventListener('click', () => {
                filters[filterKey] = v;
                container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderJobs();
            });
            container.appendChild(chip);
        });
    }

    // ── Extract unique values from the current job data ──────────────────────
    function deriveFilters() {
        const jobs = window.STORE.jobs || [];

        // Types
        const types = ['All', ...new Set(jobs.map(j => j.type).filter(Boolean))];
        buildChips('type-chips', types, 'type');

        // Locations - show top values plus "All"
        const allLocs = jobs.map(j => j.location).filter(Boolean);
        const locCounts = {};
        allLocs.forEach(l => { locCounts[l] = (locCounts[l] || 0) + 1; });
        const topLocs = Object.entries(locCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
        buildChips('loc-chips', ['All', ...topLocs], 'location');

        // Stacks - show most common
        const allStacks = jobs.flatMap(j => j.stack || []);
        const stackCounts = {};
        allStacks.forEach(s => { stackCounts[s] = (stackCounts[s] || 0) + 1; });
        const topStacks = Object.entries(stackCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
        buildChips('stack-chips', ['All', ...topStacks], 'stack');
    }

    if (search) {
        search.addEventListener('input', () => {
            filters.query = search.value.toLowerCase();
            renderJobs();
        });
    }

    // ─── Tag colors ────────────────────────────────────────────────────────────
    function tagColor(tag) {
        const defi = ['DeFi', 'Protocol', 'AMM', 'Lending'];
        const nft = ['NFT', 'Art', 'Gaming'];
        const sec = ['Security', 'Audit', 'Bug Bounty'];
        const zk = ['ZK', 'Privacy', 'ZK Rollup'];
        const dao = ['DAO', 'Governance', 'Ops'];
        if (defi.some(d => tag.includes(d))) return 'purple';
        if (nft.some(n => tag.includes(n))) return 'pink';
        if (sec.some(s => tag.includes(s))) return 'yellow';
        if (zk.some(z => tag.includes(z))) return 'cyan';
        if (dao.some(d => tag.includes(d))) return 'green';
        return 'cyan';
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    function renderJobs() {
        let jobs = [...(window.STORE.jobs || [])];

        if (filters.type !== 'All') jobs = jobs.filter(j => j.type === filters.type);
        if (filters.location !== 'All') jobs = jobs.filter(j => j.location === filters.location);
        if (filters.stack !== 'All') jobs = jobs.filter(j => j.stack.some(s => s.toLowerCase().includes(filters.stack.toLowerCase())));
        if (filters.query) jobs = jobs.filter(j =>
            j.title.toLowerCase().includes(filters.query) ||
            j.company.toLowerCase().includes(filters.query) ||
            j.stack.join(' ').toLowerCase().includes(filters.query) ||
            j.tags.join(' ').toLowerCase().includes(filters.query)
        );

        if (counter) counter.textContent = `${jobs.length} position${jobs.length !== 1 ? 's' : ''}`;
        if (!grid) return;
        grid.innerHTML = '';

        if (!jobs.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:1rem">💼</div>
        <p>No jobs match your filters. Try broadening your search.</p></div>`;
            return;
        }

        jobs.forEach(job => {
            const isSaved = saved.has(job.id);
            const card = document.createElement('div');
            card.className = 'card job-card';
            card.innerHTML = `
        <div class="job-card-top">
          <div class="job-logo">${job.logo}</div>
          <div>
            <h3>${job.title}</h3>
            <div class="job-company">${job.company}</div>
          </div>
        </div>
        <div class="job-meta">
          <span class="badge badge-${job.type === 'Full-time' ? 'green' : job.type === 'Contract' ? 'yellow' : 'cyan'}">${job.type}</span>
          <span class="badge badge-purple">📍 ${job.location}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">🕐 ${job.posted}</span>
        </div>
        <div class="job-stack">${job.stack.map(s => `<span class="stack-tag">${s}</span>`).join('')}</div>
        <div style="margin-bottom:0.75rem;display:flex;flex-wrap:wrap;gap:0.35rem">
          ${job.tags.map(t => `<span class="badge badge-${tagColor(t)}">${t}</span>`).join('')}
        </div>
        <div class="job-footer">
          <span class="salary">${job.salary}</span>
          <div style="display:flex;gap:0.5rem">
            <button class="save-btn${isSaved ? ' saved' : ''}" data-id="${job.id}" title="Save job">${isSaved ? '★' : '☆'}</button>
            <a href="${job.link || '#'}" target="_blank" class="btn btn-primary" style="padding:0.4rem 1rem;font-size:0.82rem;text-decoration:none">Apply →</a>
          </div>
        </div>`;

            const saveBtn = card.querySelector('.save-btn');
            saveBtn.addEventListener('click', () => {
                const id = parseInt(saveBtn.dataset.id);
                if (saved.has(id)) { saved.delete(id); saveBtn.textContent = '☆'; saveBtn.classList.remove('saved'); }
                else { saved.add(id); saveBtn.textContent = '★'; saveBtn.classList.add('saved'); showToast('Job saved!', 'success'); }
                localStorage.setItem('w3ai_saved_jobs', JSON.stringify([...saved]));
            });

            grid.appendChild(card);
        });
    }

    // ─── Init: try sheet loader first, then render ─────────────────────────────
    async function init() {
        if (counter) counter.textContent = 'Loading jobs...';

        // Try to load from Google Sheet (falls back gracefully)
        if (typeof window._loadSheetJobs === 'function') {
            try { await window._loadSheetJobs(); } catch (e) { console.warn(e); }
        }

        // Build dynamic filter chips from (possibly updated) job data
        deriveFilters();
        renderJobs();
    }

    init();
})();
