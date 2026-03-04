// ─── Glossary Module ──────────────────────────────────────────────────────────

(function () {
    const grid = document.getElementById('glossary-grid');
    const search = document.getElementById('glossary-search');
    const counter = document.getElementById('term-count');
    const letters = document.getElementById('letter-index');

    let activeCategory = 'All';
    let activeLetter = 'All';
    let searchQuery = '';

    const categories = ['All', 'DeFi', 'NFT', 'Infrastructure', 'Layer 2', 'DAO', 'Wallet'];

    // ─── Category chips ────────────────────────────────────────────────────────
    const chipGroup = document.getElementById('cat-chips');
    if (chipGroup) {
        categories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = 'chip' + (cat === 'All' ? ' active' : '');
            chip.textContent = cat;
            chip.addEventListener('click', () => {
                activeCategory = cat;
                chipGroup.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeLetter = 'All';
                document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'));
                renderGlossary();
            });
            chipGroup.appendChild(chip);
        });
    }

    // ─── Letter index ──────────────────────────────────────────────────────────
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    if (letters) {
        const allBtn = document.createElement('button');
        allBtn.className = 'letter-btn active';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
            activeLetter = 'All';
            document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            renderGlossary();
        });
        letters.appendChild(allBtn);

        alpha.forEach(letter => {
            const btn = document.createElement('button');
            btn.className = 'letter-btn';
            btn.textContent = letter;
            btn.addEventListener('click', () => {
                activeLetter = letter;
                document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeCategory = 'All';
                chipGroup.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chipGroup.querySelector('.chip').classList.add('active');
                renderGlossary();
            });
            letters.appendChild(btn);
        });
    }

    // ─── Search ────────────────────────────────────────────────────────────────
    if (search) {
        search.addEventListener('input', () => {
            searchQuery = search.value.toLowerCase();
            renderGlossary();
        });
    }

    // ─── Filter & Render ───────────────────────────────────────────────────────
    function catColor(cat) {
        const m = { DeFi: 'purple', NFT: 'pink', Infrastructure: 'cyan', 'Layer 2': 'green', DAO: 'yellow', Wallet: 'cyan' };
        return m[cat] || 'purple';
    }

    function renderGlossary() {
        let terms = [...window.STORE.glossary];

        if (activeCategory !== 'All') terms = terms.filter(t => t.cat === activeCategory);
        if (activeLetter !== 'All') terms = terms.filter(t => t.term[0].toUpperCase() === activeLetter);
        if (searchQuery) terms = terms.filter(t =>
            t.term.toLowerCase().includes(searchQuery) ||
            t.def.toLowerCase().includes(searchQuery) ||
            t.cat.toLowerCase().includes(searchQuery)
        );

        terms.sort((a, b) => a.term.localeCompare(b.term));

        if (counter) counter.textContent = `${terms.length} term${terms.length !== 1 ? 's' : ''}`;

        if (!grid) return;
        grid.innerHTML = '';

        if (!terms.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:1rem">🔍</div>
        <p>No terms found. Try a different search.</p></div>`;
            return;
        }

        terms.forEach(term => {
            const card = document.createElement('div');
            card.className = 'card term-card';
            card.innerHTML = `
        <div class="term-card-head">
          <h3>${term.term}</h3>
          <span class="badge badge-${catColor(term.cat)}">${term.cat}</span>
        </div>
        <p class="term-def">${term.def}</p>
        <div class="term-example">💡 ${term.example}</div>
        <div class="related-tags">${term.related.map(r => `<span class="badge badge-purple">${r}</span>`).join('')}</div>
        <button class="term-toggle">Show more ↓</button>`;

            const toggle = card.querySelector('.term-toggle');
            toggle.addEventListener('click', () => {
                card.classList.toggle('expanded');
                toggle.textContent = card.classList.contains('expanded') ? 'Show less ↑' : 'Show more ↓';
            });

            grid.appendChild(card);
        });
    }

    renderGlossary();
})();
