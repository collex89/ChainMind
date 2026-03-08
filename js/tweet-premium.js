// ─── Thread Writer PRO — Premium Module ──────────────────────────────────────
// Handles: Card subscription payments (Paystack), document analysis,
//          intelligent key-point extraction, and premium tweet generation.
// ──────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    //  CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    const WORKER_URL = 'https://chainmind-video.ugwucollins881.workers.dev';
    // ██  PASTE YOUR PAYSTACK PUBLIC KEY HERE  ██
    const PAYSTACK_PUBLIC_KEY = 'pk_live_45f82954fac3979d0bf8ee58bbe75a16645c2777';
    const SUBSCRIPTION_PRICE = 10;            // $10 USD
    const SUBSCRIPTION_AMOUNT = 1000000;      // Amount in kobo (₦10,000) or cents ($10.00 = 1000 cents)
    const SUBSCRIPTION_DAYS = 30;
    const STORAGE_KEY = 'chainmind_pro_token';  // JWT token storage

    // ═══════════════════════════════════════════════════════════════════════════
    //  1. SUBSCRIPTION MANAGER
    // ═══════════════════════════════════════════════════════════════════════════
    const Subscription = {
        // Check if subscription is active (quick local check + periodic server validation)
        isActive() {
            // Check 1: User has pro plan in auth session (direct localStorage read)
            try {
                const authData = JSON.parse(localStorage.getItem('chainmind_auth'));
                if (authData && authData.user && authData.user.plan === 'pro') return true;
            } catch { }

            // Check 2: User has active Paystack subscription token
            try {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (!data || !data.token || !data.expiresAt) return false;
                if (Date.now() >= data.expiresAt) {
                    localStorage.removeItem(STORAGE_KEY);
                    return false;
                }
                return true;
            } catch { return false; }
        },

        // Store server-verified token
        activate(token, expiresAt, email, txReference) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                token,         // JWT signed by server — can't be forged
                expiresAt,     // Server-set expiry (ms)
                email,
                txReference,
                activatedAt: Date.now(),
            }));
        },

        getToken() {
            try {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                return data?.token || null;
            } catch { return null; }
        },

        getInfo() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
            catch { return null; }
        },

        getDaysRemaining() {
            const info = this.getInfo();
            if (!info || !info.expiresAt) return 0;
            return Math.max(0, Math.ceil((info.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
        },

        deactivate() {
            localStorage.removeItem(STORAGE_KEY);
        },

        // Validate token with server (call on page load for tamper detection)
        async validateWithServer() {
            const token = this.getToken();
            if (!token) return false;
            try {
                const resp = await fetch(`${WORKER_URL}/validate-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const data = await resp.json();
                if (!data.valid) {
                    console.warn('[ChainMind] Token invalid:', data.error);
                    this.deactivate();
                    return false;
                }
                return true;
            } catch (err) {
                console.warn('[ChainMind] Token validation failed (network):', err.message);
                // On network error, trust local expiry check
                return this.isActive();
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    //  2. PAYSTACK CARD PAYMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function payWithCard() {
        return new Promise((resolve, reject) => {
            if (typeof PaystackPop === 'undefined') {
                reject(new Error('Payment system not loaded. Please refresh the page and try again.'));
                return;
            }

            // Get email from auth or prompt
            let email = null;
            const auth = window.ChainMindAuth;
            if (auth && auth.isLoggedIn()) {
                const user = auth.getUser();
                email = user?.email;
            }
            if (!email) {
                email = prompt('Enter your email address for the receipt:');
            }
            if (!email || !email.includes('@')) {
                reject(new Error('A valid email address is required for payment.'));
                return;
            }

            const handler = PaystackPop.setup({
                key: PAYSTACK_PUBLIC_KEY,
                email: email,
                amount: SUBSCRIPTION_AMOUNT,   // Amount in kobo/cents
                currency: 'NGN',               // Change to 'USD' if using a USD Paystack account
                metadata: {
                    plan: 'chainmind_pro',
                    duration_days: SUBSCRIPTION_DAYS,
                },
                callback: function (response) {
                    // Payment successful on Paystack's end — verify with our server
                    const authHeaders = (auth && auth.isLoggedIn()) ? auth.authHeaders() : {};
                    fetch(`${WORKER_URL}/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({
                            reference: response.reference,
                        }),
                    })
                        .then(r => r.json())
                        .then(verifyData => {
                            if (!verifyData.success) {
                                throw new Error(verifyData.error || 'Payment verification failed. Please contact support.');
                            }
                            // Store server-signed JWT token (tamper-proof)
                            Subscription.activate(
                                verifyData.token,
                                verifyData.expiresAt,
                                verifyData.email,
                                verifyData.txReference
                            );
                            resolve(response.reference);
                        })
                        .catch(err => reject(err));
                },
                onClose: function () {
                    reject(new Error('Payment cancelled. You can try again anytime.'));
                },
            });

            handler.openIframe();
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  2b. RESTORE SUBSCRIPTION (returning users)
    // ═══════════════════════════════════════════════════════════════════════════

    async function restoreSubscription() {
        const email = prompt('Enter the email you used during payment:');
        if (!email || !email.trim()) throw new Error('No email provided.');

        const resp = await fetch(`${WORKER_URL}/restore-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            throw new Error(data.error || 'Could not restore subscription.');
        }

        Subscription.activate(data.token, data.expiresAt, data.email, data.txReference);
        return data;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  3. DOCUMENT PARSER
    // ═══════════════════════════════════════════════════════════════════════════
    const DocumentParser = {
        async parse(file) {
            if (!file) throw new Error('No file provided.');
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'pdf') return this.parsePDF(file);
            if (['txt', 'md', 'text', 'markdown'].includes(ext)) return this.parseText(file);
            throw new Error(`Unsupported file type: .${ext}. Please upload .txt, .md, or .pdf`);
        },

        parseText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read file.'));
                reader.readAsText(file);
            });
        },

        async parsePDF(file) {
            if (!window.pdfjsLib) {
                throw new Error('PDF parser not loaded. Please try a .txt or .md file.');
            }
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
            }
            return text.trim();
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    //  4. INTELLIGENT KEY-POINT EXTRACTION ENGINE
    // ═══════════════════════════════════════════════════════════════════════════
    const Extractor = {

        splitSentences(text) {
            // Normalize whitespace and split on sentence boundaries
            return text
                .replace(/\r\n/g, '\n')
                .replace(/\n{2,}/g, '. ')
                .replace(/\n/g, ' ')
                .split(/(?<=[.!?])\s+/)
                .map(s => s.trim().replace(/^[•\-–—*]\s*/, ''))  // strip bullets
                .filter(s => s.length > 15 && s.length < 600);
        },

        scoreSentence(sentence, index, totalSentences) {
            let score = 0;
            const lower = sentence.toLowerCase();

            // ── Position scoring ─────────────────────────────────
            // Opening and closing sentences are typically more important
            if (index < 3) score += 4;
            else if (index < 6) score += 2;
            if (index > totalSentences - 4) score += 3;

            // ── Data & numbers (concrete information) ────────────
            if (/\d+%/.test(sentence)) score += 4;
            if (/\$[\d,.]+[kKmMbB]?/.test(sentence)) score += 4;
            if (/\d{4}/.test(sentence)) score += 1;  // years
            if (/\d+[xX]/.test(sentence)) score += 3; // multipliers
            const numberCount = (sentence.match(/\d+/g) || []).length;
            if (numberCount >= 2) score += 2;

            // ── Significance markers ──────────────────────────────
            const importanceWords = [
                'important', 'crucial', 'critical', 'essential', 'key',
                'significant', 'major', 'fundamental', 'vital', 'primary',
                'revolutionary', 'breakthrough', 'unprecedented', 'notable',
                'first', 'largest', 'fastest', 'biggest', 'leading'
            ];
            importanceWords.forEach(w => {
                if (lower.includes(w)) score += 2;
            });

            // ── Contrast / insight markers ────────────────────────
            const insightWords = [
                'however', 'but', 'unlike', 'whereas', 'despite',
                'surprisingly', 'interestingly', 'notably', 'crucially',
                'in contrast', 'on the other hand', 'the key insight'
            ];
            insightWords.forEach(w => {
                if (lower.includes(w)) score += 3;
            });

            // ── Causal / conclusion markers ──────────────────────
            const causalWords = [
                'because', 'therefore', 'consequently', 'as a result',
                'this means', 'which means', 'in conclusion', 'ultimately',
                'the takeaway', 'bottom line', 'the solution'
            ];
            causalWords.forEach(w => {
                if (lower.includes(w)) score += 2;
            });

            // ── Web3 domain terms (boost domain relevance) ───────
            const web3Terms = [
                'blockchain', 'defi', 'nft', 'dao', 'smart contract',
                'token', 'wallet', 'ethereum', 'solana', 'layer 2',
                'protocol', 'consensus', 'decentralized', 'web3',
                'staking', 'yield', 'liquidity', 'governance', 'bridge',
                'rollup', 'zk', 'zero knowledge', 'proof of stake',
                'proof of work', 'oracle', 'amm', 'tvl', 'gas',
                'validator', 'mev', 'airdrop', 'lending', 'dex',
                'cross-chain', 'interoperability', 'tokenomics'
            ];
            web3Terms.forEach(t => {
                if (lower.includes(t)) score += 2;
            });

            // ── Sentence quality heuristics ──────────────────────
            // Prefer medium-length sentences (great for tweets)
            if (sentence.length >= 40 && sentence.length <= 220) score += 3;
            else if (sentence.length >= 25 && sentence.length <= 280) score += 1;

            // Penalize very short / very long
            if (sentence.length < 20) score -= 4;
            if (sentence.length > 400) score -= 3;

            // Penalize filler / boilerplate phrases
            const fillerPhrases = [
                'in this article', 'as mentioned', 'it is worth noting',
                'let us', 'we will', 'in this section', 'as we can see',
                'click here', 'read more', 'subscribe', 'sign up',
                'table of contents', 'copyright', 'all rights reserved'
            ];
            fillerPhrases.forEach(f => {
                if (lower.includes(f)) score -= 5;
            });

            // Lists with colons (usually summaries of key info)
            if (sentence.includes(':') && sentence.length > 30) score += 2;

            return score;
        },

        /**
         * Extract the top N key points from raw text.
         * Uses multi-signal scoring: position, data density, importance markers,
         * domain relevance, sentence quality, and diversity.
         */
        extract(text, numPoints) {
            const sentences = this.splitSentences(text);
            if (sentences.length === 0) return [];

            // Score every sentence
            const scored = sentences.map((s, i) => ({
                text: s,
                score: this.scoreSentence(s, i, sentences.length),
                originalIndex: i,
            }));

            // Sort by score descending
            scored.sort((a, b) => b.score - a.score);

            // Deduplicate: skip sentences that are too similar to already-picked ones
            const selected = [];
            for (const item of scored) {
                if (selected.length >= numPoints) break;
                const isDuplicate = selected.some(s =>
                    this._similarity(s.text, item.text) > 0.6
                );
                if (!isDuplicate) selected.push(item);
            }

            // Re-sort by original document order for coherent flow
            selected.sort((a, b) => a.originalIndex - b.originalIndex);

            return selected.map(s => s.text);
        },

        /**
         * Enrich extracted points with knowledge from STORE
         */
        enrichWithKnowledge(points) {
            if (!window.STORE) return points;
            const glossary = window.STORE.glossary || [];
            const knowledge = window.STORE.knowledge || {};

            return points.map(point => {
                const lower = point.toLowerCase();

                // Find matching knowledge topic
                for (const [key, topic] of Object.entries(knowledge)) {
                    if (lower.includes(key) ||
                        (topic.title && lower.includes(topic.title.toLowerCase().split(' ')[0].toLowerCase()))) {
                        if (topic.keyPoints && topic.keyPoints.length) {
                            const kp = topic.keyPoints[Math.floor(Math.random() * topic.keyPoints.length)];
                            return point + '\n\n💡 ' + kp;
                        }
                    }
                }

                // Check glossary for term enrichment
                for (const g of glossary) {
                    if (lower.includes(g.term.toLowerCase()) && g.def) {
                        return point + '\n\n📖 ' + g.term + ': ' + g.def.split('.')[0] + '.';
                    }
                }

                return point;
            });
        },

        /** Simple Jaccard-like word overlap similarity (0–1) */
        _similarity(a, b) {
            const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2));
            const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));
            let overlap = 0;
            for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
            return overlap / Math.max(wordsA.size, wordsB.size, 1);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    //  5. PREMIUM TWEET FORMATTER
    // ═══════════════════════════════════════════════════════════════════════════

    const DOC_TEMPLATES = {
        educational: {
            opener: () => '🧵 THREAD: I just analyzed this document. Here are the key insights you need to know.\n\n👇',
            ender: '🔁 RT if this was useful!\n\nFollow for more deep-dive Web3 analysis. I read so you don\'t have to.',
        },
        alpha: {
            opener: () => '🚨 ALPHA THREAD: Document breakdown incoming.\n\nMost people won\'t read the source material. Here\'s what actually matters 🧵',
            ender: '💎 That\'s the alpha from the source.\n\nLike + RT if this saved you time. Follow for more edge.',
        },
        opinion: {
            opener: () => 'I just finished reading through this and here\'s what stands out:\n\nA thread on the key takeaways 🧵',
            ender: 'Those are the points that matter most, imo.\n\nAgree or disagree? Reply below 👇',
        },
        howto: {
            opener: () => 'Document breakdown — the key points in under 5 minutes:\n\n(Save this thread for later) 🧵',
            ender: '✅ That\'s the essential summary. Bookmark this.\n\nFollow me for more efficient breakdowns like this.',
        },
        news: {
            opener: () => '📰 Breaking down the key points from this document:\n\nWhat it says, why it matters, what to watch 🧵',
            ender: '📌 Stay informed. These are the points that will shape what happens next.\n\nRT to share. Follow for more.',
        },
        document: {
            opener: () => '📄 Document Analysis Thread\n\nI extracted the most important points so you don\'t have to read the whole thing.\n\nHere\'s what you need to know 🧵',
            ender: '📌 Those are the vital points from the document.\n\nSave this thread. Like + RT.\n\nFollow for more document breakdowns 🔥',
        },
    };

    const TONE_HOOKS = {
        degen: ['ngl this is fire', 'ser,', 'lfg —', 'based take:', 'probably nothing 👀', 'anon, listen:'],
        professional: ['Research indicates:', 'Notably,', 'The data suggests', 'Key finding:', 'Analysis shows:'],
        beginner: ['Simply put:', 'In plain English:', 'Think of it like this:', 'Breaking this down:'],
        witty: ['Plot twist:', 'Hot take:', 'Here\'s the thing:', 'The part nobody tells you:'],
    };

    /**
     * Convert extracted key points into tweet-formatted thread.
     * @param {string[]} points — extracted key points
     * @param {number} numTweets — total tweets desired (including opener & closer)
     * @param {string} tone — neutral | degen | professional | beginner | witty
     * @param {string} templateKey — educational | alpha | opinion | howto | news | document
     * @param {boolean} enrichWithKB — whether to cross-reference STORE knowledge
     * @returns {string[]} array of tweet strings
     */
    function formatAsTweets(points, numTweets, tone, templateKey, enrichWithKB) {
        const tmpl = DOC_TEMPLATES[templateKey] || DOC_TEMPLATES.document;
        numTweets = Math.max(3, numTweets); // minimum: opener + 1 content + closer

        // Optionally enrich with knowledge base
        let enrichedPoints = enrichWithKB ? Extractor.enrichWithKnowledge(points) : points;

        const contentSlots = numTweets - 2; // opener + closer take 2 slots
        const selectedPoints = enrichedPoints.slice(0, Math.max(1, contentSlots));

        const tweets = [];

        // Opener tweet
        tweets.push(tmpl.opener());

        // Content tweets
        const totalNum = selectedPoints.length + 2;
        selectedPoints.forEach((point, i) => {
            let prefix = `${i + 2}/${totalNum}\n\n`;

            // Apply tone hook (40% chance)
            if (tone !== 'neutral' && TONE_HOOKS[tone] && Math.random() < 0.4) {
                const hook = TONE_HOOKS[tone][Math.floor(Math.random() * TONE_HOOKS[tone].length)];
                prefix += hook + ' ';
            }

            // Fit content within 280 chars
            let content = point;
            const maxLen = 280 - prefix.length;
            if (content.length > maxLen) {
                // Try to cut at a word boundary
                const cutPoint = content.lastIndexOf(' ', maxLen - 4);
                content = content.substring(0, cutPoint > maxLen / 2 ? cutPoint : maxLen - 4) + '...';
            }

            tweets.push(prefix + content);
        });

        // Closer tweet
        tweets.push(tmpl.ender);

        return tweets;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  6. PAYWALL UI CONTROLLER
    // ═══════════════════════════════════════════════════════════════════════════

    function initPaywall() {
        const overlay = document.getElementById('premium-overlay');
        const subscribeBtn = document.getElementById('subscribe-btn');
        const proStatus = document.getElementById('pro-status');

        if (!overlay) return;

        function hidePaywall() {
            overlay.style.display = 'none';
            if (proStatus) {
                const auth = window.ChainMindAuth;
                if (auth && auth.isLoggedIn()) {
                    const user = auth.getUser();
                    if (user && user.plan === 'pro') {
                        proStatus.textContent = 'PRO · Owner';
                        proStatus.style.display = 'inline-flex';
                        return;
                    }
                }
                const days = Subscription.getDaysRemaining();
                proStatus.textContent = `PRO · ${days}d remaining`;
                proStatus.style.display = 'inline-flex';
            }
        }

        // Quick local check first
        if (Subscription.isActive()) {
            hidePaywall();

            // Async server-side validation (catches tampered tokens)
            Subscription.validateWithServer().then(valid => {
                if (!valid) {
                    console.warn('[ChainMind] Server rejected token — showing paywall');
                    overlay.style.display = 'flex';
                    if (proStatus) proStatus.style.display = 'none';
                }
            });
            return;
        }

        // Show paywall initially
        overlay.style.display = 'flex';

        // Re-check after auth profile refreshes (plan may update from server)
        window.addEventListener('chainmind-auth-ready', () => {
            if (Subscription.isActive()) {
                hidePaywall();
            }
        });

        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', async () => {
                const originalText = subscribeBtn.innerHTML;
                try {
                    subscribeBtn.innerHTML = '⏳ Opening payment...';
                    subscribeBtn.disabled = true;

                    const reference = await payWithCard();

                    subscribeBtn.innerHTML = '✅ Subscription active!';
                    if (window.showToast) showToast('Welcome to ChainMind PRO! Payment confirmed 🎉', 'success');

                    // Hide overlay with animation
                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        overlay.style.transform = 'scale(1.05)';
                        setTimeout(() => {
                            overlay.style.display = 'none';
                            if (proStatus) {
                                proStatus.textContent = 'PRO · 30d remaining';
                                proStatus.style.display = 'inline-flex';
                            }
                        }, 400);
                    }, 1200);

                } catch (err) {
                    console.error('Payment error:', err);
                    subscribeBtn.innerHTML = originalText;
                    subscribeBtn.disabled = false;
                    if (window.showToast) {
                        showToast(err.message || 'Payment failed. Please try again.', 'error');
                    }
                }
            });
        }

        // Wire up restore access button
        const restoreBtn = document.getElementById('restore-access-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    restoreBtn.textContent = '⏳ Checking...';
                    const data = await restoreSubscription();
                    const days = Subscription.getDaysRemaining();
                    if (window.showToast) showToast(`Welcome back! PRO restored — ${days} days remaining 🎉`, 'success');
                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        setTimeout(() => {
                            overlay.style.display = 'none';
                            if (proStatus) {
                                proStatus.textContent = `PRO · ${days}d remaining`;
                                proStatus.style.display = 'inline-flex';
                            }
                        }, 400);
                    }, 800);
                } catch (err) {
                    restoreBtn.textContent = 'Already subscribed? Restore access →';
                    if (window.showToast) showToast(err.message || 'Could not restore subscription.', 'error');
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  7. DOCUMENT UPLOAD UI CONTROLLER
    // ═══════════════════════════════════════════════════════════════════════════

    let uploadedDocText = '';
    let uploadedFileName = '';

    function initUploadZone() {
        const dropZone = document.getElementById('doc-drop-zone');
        const fileInput = document.getElementById('doc-file-input');
        const fileInfo = document.getElementById('doc-file-info');
        const clearBtn = document.getElementById('doc-clear-btn');

        if (!dropZone || !fileInput) return;

        // Click to browse
        dropZone.addEventListener('click', (e) => {
            if (e.target === clearBtn || e.target.closest('#doc-clear-btn')) return;
            fileInput.click();
        });

        // Drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });

        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleFile(fileInput.files[0]);
        });

        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                uploadedDocText = '';
                uploadedFileName = '';
                fileInput.value = '';
                dropZone.classList.remove('has-file');
                if (fileInfo) fileInfo.innerHTML = '';
                if (clearBtn) clearBtn.style.display = 'none';
            });
        }

        async function handleFile(file) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                showToast('File too large. Max 10MB.', 'error');
                return;
            }

            dropZone.classList.add('processing');
            if (fileInfo) fileInfo.innerHTML = '<span class="doc-loading">⏳ Extracting text...</span>';

            try {
                uploadedDocText = await DocumentParser.parse(file);
                uploadedFileName = file.name;

                if (!uploadedDocText || uploadedDocText.trim().length < 20) {
                    throw new Error('Document appears to be empty or too short.');
                }

                const wordCount = uploadedDocText.split(/\s+/).length;
                const sentenceCount = Extractor.splitSentences(uploadedDocText).length;

                dropZone.classList.add('has-file');
                dropZone.classList.remove('processing');
                if (fileInfo) {
                    fileInfo.innerHTML = `
                        <div class="doc-file-name">📄 ${file.name}</div>
                        <div class="doc-file-stats">${wordCount.toLocaleString()} words · ${sentenceCount} extractable points</div>
                    `;
                }
                if (clearBtn) clearBtn.style.display = 'flex';
                showToast(`Document loaded: ${wordCount} words extracted! ✨`, 'success');

            } catch (err) {
                dropZone.classList.remove('processing', 'has-file');
                if (fileInfo) fileInfo.innerHTML = '';
                uploadedDocText = '';
                uploadedFileName = '';
                showToast(err.message || 'Failed to parse document.', 'error');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INIT & PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════

    function init() {
        initPaywall();
        initUploadZone();
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API for tweet.js integration
    window.TweetPremium = {
        Subscription,
        payWithCard,
        restoreSubscription,
        DocumentParser,
        Extractor,
        formatAsTweets,
        getUploadedText: () => uploadedDocText,
        getUploadedFileName: () => uploadedFileName,
        SUBSCRIPTION_PRICE,
        DOC_TEMPLATES,
    };

})();
