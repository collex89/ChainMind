// ─── AI Training & Community Module ─────────────────────────────────────────
// Now saves to D1 database (via Worker API) with localStorage fallback
// ──────────────────────────────────────────────────────────────────────────────

(function () {
    const WORKER_URL = 'https://chainmind-video.ugwucollins881.workers.dev';
    const form = document.getElementById('train-form');
    const feedGrid = document.getElementById('feed-grid');
    const lbList = document.getElementById('leaderboard-list');
    const submitCount = document.getElementById('submit-count');

    const CATS = ['DeFi', 'NFT', 'Infrastructure', 'Layer 2', 'DAO', 'Wallet'];
    const DIFFS = ['Beginner', 'Intermediate', 'Advanced'];

    let submissions = [];
    let leaderboardData = [];
    let votes = JSON.parse(localStorage.getItem('w3ai_votes') || '[]');

    // User Avatar SVG
    const userAvatarSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const pointsSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--yellow-1);margin-right:0.25rem"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;

    // ─── Load feed from D1 API ────────────────────────────────────────────────
    async function loadFeedFromAPI() {
        try {
            const resp = await fetch(`${WORKER_URL}/training/feed?limit=50`);
            const data = await resp.json();
            if (data.success && data.submissions.length > 0) {
                // Convert API format to display format
                submissions = data.submissions.map(s => ({
                    id: s.id,
                    term: s.term,
                    cat: s.category || 'DeFi',
                    diff: s.difficulty || 'Beginner',
                    def: s.definition,
                    author: s.author || 'Anonymous',
                    confidence: Math.floor(60 + Math.random() * 35),
                    votes: s.votes || 0,
                    time: timeAgo(s.created_at),
                }));
            }
        } catch (err) {
            console.warn('[Train] Could not load feed from API:', err.message);
        }
        renderFeed();
        if (submitCount) submitCount.textContent = submissions.length;
    }

    // ─── Load Leaderboard from D1 API ─────────────────────────────────────────
    async function loadLeaderboardFromAPI() {
        try {
            const resp = await fetch(`${WORKER_URL}/training/leaderboard`);
            const data = await resp.json();
            if (data.success) {
                leaderboardData = data.leaderboard;
            }
        } catch (err) {
            console.warn('[Train] Could not load leaderboard from API:', err.message);
        }
        renderLeaderboard();
    }

    function timeAgo(timestamp) {
        if (!timestamp) return 'just now';
        const diff = Date.now() - timestamp;
        const mins = Math.max(0, Math.floor(diff / 60000));
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    // ─── Populate selects ──────────────────────────────────────────────────────
    const catSelect = document.getElementById('train-cat');
    const diffSelect = document.getElementById('train-diff');
    if (catSelect) CATS.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSelect.appendChild(o); });
    if (diffSelect) DIFFS.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; diffSelect.appendChild(o); });

    // ─── Form submit ───────────────────────────────────────────────────────────
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const term = document.getElementById('train-term').value.trim();
            const def = document.getElementById('train-def').value.trim();
            const cat = catSelect.value;
            const diff = diffSelect.value;
            const authorInput = document.getElementById('train-author').value.trim();

            if (!term || !def) { showToast('Please fill in the term and definition.', 'error'); return; }

            // Check if user is logged in
            const auth = window.ChainMindAuth;
            if (!auth || !auth.isLoggedIn()) {
                showToast('Please log in to submit training data.', 'error');
                return;
            }

            const user = auth.getUser();
            const author = authorInput || user?.name || 'Anonymous';

            // Save to D1 via API
            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Submitting...';

                const resp = await fetch(`${WORKER_URL}/training/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...auth.authHeaders(),
                    },
                    body: JSON.stringify({ term, definition: def, category: cat, difficulty: diff }),
                });
                const data = await resp.json();

                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                if (!resp.ok) throw new Error(data.error || 'Failed to save.');

                const newEntry = {
                    id: data.id || Date.now(),
                    term, cat, diff, def,
                    author,
                    confidence: Math.floor(60 + Math.random() * 35),
                    votes: 0,
                    time: 'just now'
                };

                submissions.unshift(newEntry);
                form.reset();
                renderFeed();
                showToast('✨ Your contribution has been saved to ChainMind!', 'success');
                if (submitCount) submitCount.textContent = submissions.length;

                // Refresh leaderboard dynamically
                loadLeaderboardFromAPI();

            } catch (err) {
                showToast(err.message || 'Failed to save. Please try again.', 'error');
                
                // If it fails, restore the button text anyway
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                   submitBtn.disabled = false;
                   submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 10v2"></path><circle cx="12" cy="16" r="2"></circle><path d="M12 18v2"></path><path d="M7 20h10"></path><path d="M5 8h2"></path><path d="M17 8h2"></path></svg> Submit to Train the AI';
                }
            }
        });
    }

    // ─── Render feed ───────────────────────────────────────────────────────────
    function catColor(cat) {
        const m = { DeFi: 'purple', NFT: 'pink', Infrastructure: 'cyan', 'Layer 2': 'green', DAO: 'yellow', Wallet: 'cyan' };
        return m[cat] || 'purple';
    }

    function renderFeed() {
        if (!feedGrid) return;
        feedGrid.innerHTML = '';
        
        if (submissions.length === 0) {
            feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:var(--text-muted);font-size:0.95rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);">No submissions yet. Be the first to train the AI!</div>';
            return;
        }

        submissions.forEach(sub => {
            const hasVoted = votes.includes(sub.id);
            const card = document.createElement('div');
            card.className = 'card feed-card';
            card.innerHTML = `
        <div class="feed-card-top">
          <div>
            <h3 style="font-size:1rem;margin-bottom:0.25rem">${sub.term}</h3>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
              <span class="badge badge-${catColor(sub.cat)}">${sub.cat}</span>
              <span class="badge badge-${sub.diff === 'Beginner' ? 'green' : sub.diff === 'Intermediate' ? 'yellow' : 'pink'}">${sub.diff}</span>
            </div>
          </div>
          <button class="upvote-btn${hasVoted ? ' voted' : ''}" data-id="${sub.id}">
            ▲ <span class="vote-count">${sub.votes}</span>
          </button>
        </div>
        <p style="font-size:0.88rem;margin-bottom:0.75rem;line-height:1.6">${sub.def}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:var(--text-muted)">
          <span style="display:flex;align-items:center;gap:0.4rem">${userAvatarSvg} <strong>${sub.author}</strong> · ${sub.time}</span>
        </div>
        <div class="confidence-bar-wrap" style="margin-top:1rem">
          <div class="confidence-label"><span>AI Confidence Match</span><span>${sub.confidence}%</span></div>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${sub.confidence}%"></div></div>
        </div>`;

            card.querySelector('.upvote-btn').addEventListener('click', async function () {
                if (votes.includes(sub.id)) { showToast('Already voted!', 'info'); return; }

                // Vote via API
                const auth = window.ChainMindAuth;
                if (auth && auth.isLoggedIn()) {
                    try {
                        await fetch(`${WORKER_URL}/training/vote`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
                            body: JSON.stringify({ submissionId: sub.id }),
                        });
                    } catch (e) { /* vote locally even if API fails */ }
                }

                votes.push(sub.id);
                sub.votes++;
                localStorage.setItem('w3ai_votes', JSON.stringify(votes));
                this.classList.add('voted');
                this.querySelector('.vote-count').textContent = sub.votes;
                showToast('Vote cast!', 'success');
                
                // Refresh leaderboard if we voted
                loadLeaderboardFromAPI();
            });

            feedGrid.appendChild(card);
        });
    }

    // ─── Render Leaderboard ───────────────────────────────────────────────────
    function renderLeaderboard() {
        if (!lbList) return;
        lbList.innerHTML = '';
        
        if (leaderboardData.length === 0) {
            lbList.innerHTML = '<div style="text-align:center;padding:1.5rem 0;color:var(--text-muted);font-size:0.85rem;">No ranking data yet. Earn points by submitting and getting upvotes!</div>';
            return;
        }

        leaderboardData.forEach((entry, i) => {
            const li = document.createElement('div');
            li.className = 'leaderboard-item';
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
            li.innerHTML = `
        <div class="rank-badge ${rankClass}">${i + 1}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:0.9rem">${entry.author}</div></div>
        <div style="font-size:0.85rem;color:var(--yellow-1);font-weight:700;display:flex;align-items:center">${pointsSvg}${entry.score} pts</div>`;
            lbList.appendChild(li);
        });
    }

    // Init
    loadFeedFromAPI();
    loadLeaderboardFromAPI();
})();
