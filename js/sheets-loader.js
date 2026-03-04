// ─── Google Sheets Job Loader ────────────────────────────────────────────────
//
// HOW TO USE:
// 1. Create a Google Sheet with these columns (Row 1 = headers, exact names):
//    title | company | logo | location | type | stack | tags | salary | posted
//
//    • stack and tags are comma-separated, e.g. "Solidity, Hardhat, TypeScript"
//    • logo should be an emoji, e.g. "🦄"
//
// 2. Go to  File → Share → Publish to the web
//    Choose "Comma-separated values (.csv)" and click Publish
//    Copy the URL (it looks like: https://docs.google.com/spreadsheets/d/e/2PACX-xxx/pub?output=csv)
//
// 3. Paste that URL into the SHEET_CSV_URL constant below
//
// 4. Jobs will now load live from your Google Sheet every time the page loads.
//    If the fetch fails (offline, wrong URL, etc), the page falls back to the
//    hardcoded jobs in store.js — so it always works.
// ─────────────────────────────────────────────────────────────────────────────

(function () {

    // ═══════════════════════════════════════════════════════════════════════════
    // ██  PASTE YOUR GOOGLE SHEET CSV URL HERE  ██
    // ═══════════════════════════════════════════════════════════════════════════
    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVBt0ep-PPyaKzCybl4iqIruXBFEUeP3bQsXKizsWP2XQBYIsCq2vyKYYT6YNCckg9efJFyVIuOoUp/pub?gid=0&single=true&output=csv';
    // Example:
    // const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vXXXXX/pub?output=csv';
    // ═══════════════════════════════════════════════════════════════════════════

    const CACHE_KEY = 'w3ai_sheet_jobs';
    const CACHE_TTL_MS = 10 * 60 * 1000; // Cache for 10 minutes to avoid hitting Google too much

    // ── CSV parser (handles quoted fields with commas inside) ────────────────
    function parseCSV(text) {
        const rows = [];
        let current = '';
        let inQuotes = false;
        const chars = text.replace(/\r/g, '');

        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            if (ch === '"') {
                if (inQuotes && chars[i + 1] === '"') {
                    current += '"'; i++; // escaped quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                if (!rows.length || rows[rows.length - 1] === undefined) rows.push([]);
                rows[rows.length - 1].push(current.trim());
                current = '';
            } else if (ch === '\n' && !inQuotes) {
                if (!rows.length) rows.push([]);
                rows[rows.length - 1].push(current.trim());
                current = '';
                rows.push(undefined); // signal new row
            } else {
                current += ch;
            }
        }
        // Flush last field
        if (current.length || (rows.length && rows[rows.length - 1] === undefined)) {
            if (!rows.length || rows[rows.length - 1] === undefined) rows.push([]);
            rows[rows.length - 1].push(current.trim());
        }

        return rows.filter(r => r !== undefined && r.some(cell => cell.length > 0));
    }

    // ── Convert parsed CSV rows to job objects ──────────────────────────────
    function csvToJobs(rows) {
        if (rows.length < 2) return [];
        const headers = rows[0].map(h => h.toLowerCase().trim());

        const idx = (name) => headers.indexOf(name);
        const iTitle = idx('title');
        const iCompany = idx('company');
        const iLogo = idx('logo');
        const iLocation = idx('location');
        const iType = idx('type');
        const iStack = idx('stack');
        const iTags = idx('tags');
        const iSalary = idx('salary');
        const iPosted = idx('posted');

        if (iTitle === -1 || iCompany === -1) {
            console.warn('[SheetsLoader] Missing required columns: title, company');
            return [];
        }

        const jobs = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row[iTitle]) continue;

            jobs.push({
                id: r,
                title: row[iTitle] || '',
                company: row[iCompany] || '',
                logo: (iLogo !== -1 ? row[iLogo] : '') || '💼',
                location: (iLocation !== -1 ? row[iLocation] : '') || 'Remote',
                type: (iType !== -1 ? row[iType] : '') || 'Full-time',
                stack: (iStack !== -1 && row[iStack]) ? row[iStack].split(',').map(s => s.trim()).filter(Boolean) : [],
                tags: (iTags !== -1 && row[iTags]) ? row[iTags].split(',').map(s => s.trim()).filter(Boolean) : [],
                salary: (iSalary !== -1 ? row[iSalary] : '') || 'Competitive',
                posted: (iPosted !== -1 ? row[iPosted] : '') || 'Recently',
            });
        }
        return jobs;
    }

    // ── Check local cache first ─────────────────────────────────────────────
    function getCachedJobs() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.ts > CACHE_TTL_MS) return null; // Expired
            return data.jobs;
        } catch { return null; }
    }

    function setCachedJobs(jobs) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), jobs }));
        } catch { /* quota exceeded, ignore */ }
    }

    // ── Main loader ─────────────────────────────────────────────────────────
    window._loadSheetJobs = async function () {
        if (!SHEET_CSV_URL) {
            console.log('[SheetsLoader] No SHEET_CSV_URL configured — using store.js fallback');
            return false;
        }

        // Try cache first
        const cached = getCachedJobs();
        if (cached && cached.length) {
            window.STORE.jobs = cached;
            console.log(`[SheetsLoader] Loaded ${cached.length} jobs from cache`);
            return true;
        }

        // Fetch from Google Sheets
        try {
            const resp = await fetch(SHEET_CSV_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            const rows = parseCSV(text);
            const jobs = csvToJobs(rows);

            if (jobs.length > 0) {
                window.STORE.jobs = jobs;
                setCachedJobs(jobs);
                console.log(`[SheetsLoader] ✅ Loaded ${jobs.length} jobs from Google Sheet`);
                return true;
            } else {
                console.warn('[SheetsLoader] Sheet returned 0 valid jobs — keeping store.js data');
                return false;
            }
        } catch (err) {
            console.warn('[SheetsLoader] Fetch failed, keeping store.js data:', err.message);
            return false;
        }
    };

})();
