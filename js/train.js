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

    // Seed data (shown while loading from API)
    const SEED_DATA = [
        { id: 1, term: "HODLing", cat: "DeFi", diff: "Beginner", def: "Holding crypto assets long-term regardless of market volatility, derived from a misspelled 'hold'.", author: "CryptoCarlos", avatar: "🐂", confidence: 92, votes: 147, time: "seed" },
        { id: 2, term: "Gas Wars", cat: "Infrastructure", diff: "Intermediate", def: "Competitive bidding of gas fees during high network demand, often causing fees to spike dramatically.", author: "EthExplorer", avatar: "⛽", confidence: 88, votes: 89, time: "seed" },
        { id: 3, term: "Degen", cat: "DeFi", diff: "Beginner", def: "Short for 'degenerate' — a trader who takes high-risk positions in volatile crypto assets.", author: "YieldFarmer", avatar: "🎰", confidence: 81, votes: 73, time: "seed" },
        { id: 4, term: "Rug", cat: "DeFi", diff: "Beginner", def: "Short for rugpull — when a project team drains liquidity and disappears, leaving investors with worthless tokens.", author: "SafetyFirst", avatar: "🚨", confidence: 96, votes: 201, time: "seed" },
        { id: 5, term: "Ser", cat: "Infrastructure", diff: "Beginner", def: "A crypto-native honorific (derived from 'Sir') used in community discourse, often ironically.", author: "CommunityVoice", avatar: "🎩", confidence: 70, votes: 55, time: "seed" },
        { id: 6, term: "Moon", cat: "DeFi", diff: "Beginner", def: "When the price of a crypto asset rises dramatically — 'When moon?' is a common community question.", author: "BullMarketBob", avatar: "🌙", confidence: 85, votes: 112, time: "seed" },
    ];

    let submissions = [...SEED_DATA];
    let votes = JSON.parse(localStorage.getItem('w3ai_votes') || '[]');

    // ─── Load feed from D1 API ────────────────────────────────────────────────
    async function loadFeedFromAPI() {
        try {
            const resp = await fetch(`${WORKER_URL}/training/feed?limit=50`);
            const data = await resp.json();
            if (data.success && data.submissions.length > 0) {
                // Convert API format to display format
                const apiSubmissions = data.submissions.map(s => ({
                    id: s.id,
                    term: s.term,
                    cat: s.category || 'DeFi',
                    diff: s.difficulty || 'Beginner',
                    def: s.definition,
                    author: s.author || 'Anonymous',
                    avatar: '👤',
                    confidence: Math.floor(60 + Math.random() * 35),
                    votes: s.votes || 0,
                    time: timeAgo(s.created_at),
                }));
                // Merge: API submissions first, then seed data
                submissions = [...apiSubmissions, ...SEED_DATA];
            }
        } catch (err) {
            console.warn('[Train] Could not load from API, using local data:', err.message);
        }
        renderFeed();
        renderLeaderboard();
        if (submitCount) submitCount.textContent = submissions.length;
    }

    function timeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
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
            const avatars = ['🔗', '⚡', '🌊', '🔮', '🎯', '🚀', '💡', '🛡️', '🦊', '🐉'];

            // Save to D1 via API
            try {
                const resp = await fetch(`${WORKER_URL}/training/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...auth.authHeaders(),
                    },
                    body: JSON.stringify({ term, definition: def, category: cat, difficulty: diff }),
                });
                const data = await resp.json();

                if (!resp.ok) throw new Error(data.error || 'Failed to save.');

                const newEntry = {
                    id: data.id || Date.now(),
                    term, cat, diff, def,
                    author,
                    avatar: avatars[Math.floor(Math.random() * avatars.length)],
                    confidence: Math.floor(60 + Math.random() * 35),
                    votes: 0,
                    time: 'just now'
                };

                submissions.unshift(newEntry);
                form.reset();
                renderFeed();
                renderLeaderboard();
                showToast('✨ Your contribution has been saved to ChainMind!', 'success');
                if (submitCount) submitCount.textContent = submissions.length;

            } catch (err) {
                showToast(err.message || 'Failed to save. Please try again.', 'error');
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
        <p style="font-size:0.88rem;margin-bottom:0.75rem">${sub.def}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:var(--text-muted)">
          <span>${sub.avatar} ${sub.author} · ${sub.time}</span>
        </div>
        <div class="confidence-bar-wrap">
          <div class="confidence-label"><span>AI Confidence</span><span>${sub.confidence}%</span></div>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${sub.confidence}%"></div></div>
        </div>`;

            card.querySelector('.upvote-btn').addEventListener('click', async function () {
                if (votes.includes(sub.id)) { showToast('Already voted!', 'info'); return; }

                // Vote via API if it's a D1 submission (not seed)
                const auth = window.ChainMindAuth;
                if (sub.time !== 'seed' && auth && auth.isLoggedIn()) {
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
                renderLeaderboard();
                showToast('Vote cast!', 'success');
            });

            feedGrid.appendChild(card);
        });
    }

    // ─── Leaderboard ──────────────────────────────────────────────────────────
    function renderLeaderboard() {
        if (!lbList) return;
        const authors = {};
        submissions.forEach(s => {
            authors[s.author] = (authors[s.author] || 0) + s.votes + 1;
        });
        const sorted = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 8);
        lbList.innerHTML = '';
        sorted.forEach(([author, score], i) => {
            const li = document.createElement('div');
            li.className = 'leaderboard-item';
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
            li.innerHTML = `
        <div class="rank-badge ${rankClass}">${i + 1}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:0.9rem">${author}</div></div>
        <div style="font-size:0.85rem;color:var(--yellow-1);font-weight:700">⚡ ${score} pts</div>`;
            lbList.appendChild(li);
        });
    }

    // Init — render seed immediately, then load from API
    renderFeed();
    renderLeaderboard();
    if (submitCount) submitCount.textContent = submissions.length;

    // Load real data from D1 in background
    loadFeedFromAPI();
})();
