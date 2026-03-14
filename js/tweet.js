// ─── Tweet & Thread Writer Module ────────────────────────────────────────────
// Handles thread generation (topic-based + document-based), single tweets,
// drafts, and integrates with the TweetPremium module for PRO features.
// ──────────────────────────────────────────────────────────────────────────────

(function () {
    // ─── Randomization helpers ───────────────────────────────────────────────────
    function shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ─── Templates ──────────────────────────────────────────────────────────────

    const THREAD_TEMPLATES = {
        educational: {
            label: '🎓 Educational',
            opener: (topic) => randomFrom([
                `🧵 THREAD: Everything you need to know about ${topic} (and why it matters)\n\n👇`,
                `🧵 ${topic} explained from scratch — a thread you'll want to bookmark.\n\n👇`,
                `🧵 Let me teach you ${topic} in under 5 minutes.\n\nNo jargon. No fluff. Just clarity. 👇`,
            ]),
            ender: randomFrom([
                '🔁 RT this if it helped!\n\nFollow for more Web3 alpha daily. I break down the hardest concepts in plain English.',
                'Found this useful? 🔁 Retweet so others can learn too.\n\nFollow for daily Web3 breakdowns.',
                'That\'s the crash course. Bookmark this for later.\n\n🔁 RT + Follow for more threads like this.',
            ]),
        },
        alpha: {
            label: '⚡ Alpha Drop',
            opener: (topic) => randomFrom([
                `🚨 ALPHA THREAD: ${topic}\n\nMost people have no idea this exists. Let me explain... 🧵`,
                `🚨 This is alpha you won't find on CT: ${topic}\n\nThread 🧵👇`,
                `🚨 ${topic} — the alpha leak nobody's talking about.\n\nPay attention. 🧵`,
            ]),
            ender: randomFrom([
                '💎 That\'s the alpha. Now you know.\n\nLike + RT if this was valuable. Follow for more Web3 edge.',
                '💎 Alpha delivered. Don\'t sleep on this.\n\nRT to share. Follow for more early intel.',
                '💎 Now you\'re ahead of 99% of CT.\n\nLike + Retweet + Follow for more alpha.',
            ]),
        },
        opinion: {
            label: '💬 Hot Take',
            opener: (topic) => randomFrom([
                `Hot take about ${topic} that most people won't want to hear:\n\n🧵 A thread.`,
                `Unpopular opinion about ${topic}:\n\nMost of you will disagree. That's fine. 🧵`,
                `I have a controversial take on ${topic}.\n\nHear me out before you ratio me. 🧵`,
            ]),
            ender: randomFrom([
                'Controversial? Maybe. But this is my honest take after studying Web3 for years.\n\nAgree or disagree? Reply below 👇',
                'You can disagree, but the data backs this up.\n\nDrop your take below 👇',
                'That\'s my unfiltered take. Zero sugarcoating.\n\nReply with yours 👇',
            ]),
        },
        howto: {
            label: '🛠 How-To Guide',
            opener: (topic) => randomFrom([
                `How to understand ${topic} in under 5 minutes:\n\n(A practical thread for everyone — beginner to degen) 🧵`,
                `Step-by-step: mastering ${topic}\n\nEven if you're a complete beginner. 🧵👇`,
                `The simplest guide to ${topic} you'll ever read.\n\nBookmark this. 🧵`,
            ]),
            ender: randomFrom([
                '✅ You now understand the basics. Bookmark this for later.\n\nFollow me for more Web3 explainers like this.',
                '✅ Guide complete. You\'re already ahead of most.\n\nRT + Follow for more practical threads.',
                '✅ That\'s how it works. Simple when you break it down.\n\nBookmark + Follow for more guides.',
            ]),
        },
        news: {
            label: '📰 News Breakdown',
            opener: (topic) => randomFrom([
                `Breaking down the latest on ${topic}:\n\nWhat it means, why it matters, what to watch next 🧵`,
                `📰 ${topic} — here's what just happened and why you should care.\n\nThread 🧵`,
                `Big news about ${topic} just dropped.\n\nLet me break it down for you. 🧵👇`,
            ]),
            ender: randomFrom([
                '📌 Stay updated. This space moves fast.\n\nRT to share. Follow for real-time Web3 commentary.',
                '📌 This story is still developing. Follow me for updates as they drop.',
                '📌 Don\'t miss the next big move. RT + Follow for live Web3 coverage.',
            ]),
        },
    };

    // ─── AI Integration ────────────────────────────────────────────────────────
    
    // Helper to call the backend AI endpoint
    async function callAIEndpoint(systemPromptContent) {
        let authHeaders = {};
        if (window.ChainMindAuth && window.ChainMindAuth.isLoggedIn()) {
            authHeaders = window.ChainMindAuth.authHeaders();
        }

        try {
            const response = await fetch('https://chainmind-video.ugwucollins881.workers.dev/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({
                    message: systemPromptContent,
                    history: []
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate response');
            }
            return data.reply;

        } catch (err) {
            console.error('AI API Error:', err);
            throw err;
        }
    }

    // ─── DOM elements ────────────────────────────────────────────────────────────
    const topicInput = document.getElementById('tweet-topic');
    const toneSelect = document.getElementById('tweet-tone');
    const templateBtns = document.querySelectorAll('.tmpl-btn');
    const generateBtn = document.getElementById('generate-btn');
    const genSingleBtn = document.getElementById('gen-single-btn');
    const outputSection = document.getElementById('tweet-output');
    const threadOutput = document.getElementById('thread-container');
    const singleOutput = document.getElementById('single-tweet-container');
    const charCounter = document.getElementById('char-count');
    const singleInput = document.getElementById('single-tweet-input');
    const saveDraftBtn = document.getElementById('save-draft');
    const draftsContainer = document.getElementById('drafts-list');
    const tweetCountSlider = document.getElementById('tweet-count-slider');

    let selectedTemplate = 'educational';
    let currentThread = [];
    let savedDrafts = JSON.parse(localStorage.getItem('web3ai_tweet_drafts') || '[]');

    // ─── Template selector ───────────────────────────────────────────────────────
    templateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            templateBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTemplate = btn.dataset.tmpl;
        });
    });

    // ─── Single tweet char counter ───────────────────────────────────────────────
    if (singleInput && charCounter) {
        singleInput.addEventListener('input', () => {
            const len = singleInput.value.length;
            charCounter.textContent = `${len}/280`;
            charCounter.style.color = len > 260 ? 'var(--red-1, #ef4444)' : len > 200 ? 'var(--yellow-1)' : 'var(--text-muted)';
        });
    }

    // ─── Generate Thread ─────────────────────────────────────────────────────────
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const topic = topicInput ? topicInput.value.trim() : '';
            const hasDocument = window.TweetPremium && window.TweetPremium.getUploadedText();

            // Document mode requires PRO
            if (hasDocument && !window.TweetPremium.Subscription.isActive()) {
                showToast('PRO subscription required for document analysis.', 'error');
                return;
            }

            if (!topic && !hasDocument) {
                showToast('Please enter a clue/topic or upload a document!', 'error');
                return;
            }
            
            generateThreadViaAI(topic, hasDocument ? window.TweetPremium.getUploadedText() : null);
        });
    }

    // ─── Premium: Generate from Document ─────────────────────────────────────────
    function generateFromDocument(topic) {
        const P = window.TweetPremium;
        if (!P) { showToast('Premium module not loaded.', 'error'); return; }

        // Check subscription
        if (!P.Subscription.isActive()) {
            showToast('PRO subscription required for document analysis.', 'error');
            return;
        }

        const docText = P.getUploadedText();
        if (!docText || docText.trim().length < 20) {
            showToast('Document is empty or too short. Please upload a valid document.', 'error');
            return;
        }

        const numTweets = tweetCountSlider ? parseInt(tweetCountSlider.value) : 8;
        const tone = toneSelect ? toneSelect.value : 'neutral';
        const numContentPoints = Math.max(1, numTweets - 2); // opener + closer

        // Extract key points from document
        let keyPoints = P.Extractor.extract(docText, numContentPoints);

        if (keyPoints.length === 0) {
            showToast('Could not extract meaningful points from this document. Try a different file.', 'error');
            return;
        }

        // Generate formatted tweets
        currentThread = P.formatAsTweets(keyPoints, numTweets, tone, selectedTemplate, true);

        renderThread(currentThread);
        outputSection.style.display = 'block';
        outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const fileName = P.getUploadedFileName() || 'document';
        showToast(`📄 Thread generated from "${fileName}" — ${currentThread.length} tweets! ✨`, 'success');
    }

    // ─── Standard Topic-Based Generation ─────────────────────────────────────────
    async function generateThreadViaAI(topic, documentText) {
        const tone = toneSelect ? toneSelect.options[toneSelect.selectedIndex].text : 'Neutral';
        const styleSelectText = THREAD_TEMPLATES[selectedTemplate] ? THREAD_TEMPLATES[selectedTemplate].label : 'Educational';
        const numTweets = tweetCountSlider ? parseInt(tweetCountSlider.value) : 8;
        const btnTextSpan = document.getElementById('generate-btn-text');
        
        const originalText = btnTextSpan ? btnTextSpan.textContent : 'Generate Thread';
        
        try {
            if (btnTextSpan) btnTextSpan.textContent = 'Crafting Thread...';
            generateBtn.disabled = true;

            let prompt = `You are a viral Web3/Crypto ghostwriter on X (Twitter). Your task is to write a highly engaging, structured Twitter thread.
CRITICAL CONSTRAINTS:
- Write EXACTLY ${numTweets} tweets.
- Target Tone: ${tone}
- Target Style: ${styleSelectText}
- Each tweet must be under 280 characters.
- Separate each tweet with the exact string "||TWEET_DIVIDER||". Do not use any other numbering or formatting to separate them.
- Format the visual tweet thread organically. Use line breaks and emojis where appropriate.
`;

            if (documentText) {
                prompt += `\nBASE THIS THREAD ENTIRELY OFF THE FOLLOWING DOCUMENT TEXT. SUMMARIZE THE CORE INSIGHTS PERFECTLY:\n\n"""\n${documentText.substring(0, 4000)}\n"""\n`;
            }

            if (topic) {
                prompt += `\nTHE CLUE / TOPIC FOR THIS THREAD IS: "${topic}"\n`;
            }

            const aiResponse = await callAIEndpoint(prompt);
            
            // Parse response
            let tweets = aiResponse.split('||TWEET_DIVIDER||').map(t => t.trim()).filter(t => t.length > 0);
            
            if (tweets.length === 0) {
                 throw new Error("AI returned empty formatted response.");
            }

            // Clean up unwanted numbering if the AI ignored instructions
            tweets = tweets.map(t => t.replace(/^\d+\/\d+\s+/, '').trim());

            currentThread = tweets.map((tw, i) => {
                const total = tweets.length;
                let threadPrefix = `${i + 1}/${total}\n\n`;
                // If it already has a custom intro (like Thread emoji), ensure spacing
                return threadPrefix + tw;
            });

            renderThread(currentThread);
            outputSection.style.display = 'block';
            outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast('Thread generated magically! ✨', 'success');

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (btnTextSpan) btnTextSpan.textContent = originalText;
            generateBtn.disabled = false;
        }
    }

    function renderThread(tweets) {
        if (!threadOutput) return;
        threadOutput.innerHTML = '';
        tweets.forEach((tweet, i) => {
            const card = document.createElement('div');
            card.className = 'tweet-card';
            const charLen = tweet.length;
            const overLimit = charLen > 280;
            card.innerHTML = `
        <div class="tweet-card-inner">
          <div class="tweet-avatar">🤖</div>
          <div class="tweet-body">
            <div class="tweet-header">
              <span class="tweet-name">Web3AI</span>
              <span class="tweet-handle">@Web3AI</span>
              <span class="tweet-num">${i === 0 ? '🧵' : i === tweets.length - 1 ? '🔚' : `${i}/${tweets.length - 2}`}</span>
            </div>
            <textarea class="tweet-text" rows="${Math.max(3, Math.ceil(tweet.length / 60))}">${tweet}</textarea>
            <div class="tweet-footer">
              <span class="char-pill ${overLimit ? 'over' : ''}">${charLen}/280</span>
              <button class="copy-tweet btn btn-ghost" data-idx="${i}">📋 Copy</button>
            </div>
          </div>
        </div>`;

            // Live char count
            const ta = card.querySelector('.tweet-text');
            const pill = card.querySelector('.char-pill');
            ta.addEventListener('input', () => {
                const l = ta.value.length;
                pill.textContent = `${l}/280`;
                pill.classList.toggle('over', l > 280);
                currentThread[i] = ta.value;
            });

            // Copy single tweet
            card.querySelector('.copy-tweet').addEventListener('click', () => {
                navigator.clipboard.writeText(ta.value).then(() => showToast('Tweet copied!', 'success'));
            });

            // Thread connector
            if (i < tweets.length - 1) {
                const connector = document.createElement('div');
                connector.className = 'thread-connector';
                threadOutput.appendChild(card);
                threadOutput.appendChild(connector);
            } else {
                threadOutput.appendChild(card);
            }
        });
    }

    // ─── Generate Single Tweet ───────────────────────────────────────────────────
    if (genSingleBtn) {
        genSingleBtn.addEventListener('click', async () => {
            const topic = topicInput ? topicInput.value.trim() : '';
            const hasDocument = window.TweetPremium && window.TweetPremium.getUploadedText();

            // Document mode requires PRO
            if (hasDocument && !window.TweetPremium.Subscription.isActive()) {
                showToast('PRO subscription required for document analysis.', 'error');
                return;
            }

            if (!topic && !hasDocument) {
                showToast('Please enter a clue/topic or upload a document!', 'error');
                return;
            }

            const tone = toneSelect ? toneSelect.options[toneSelect.selectedIndex].text : 'Neutral';
            const btnTextSpan = document.getElementById('gen-single-btn-text');
            const originalText = btnTextSpan ? btnTextSpan.textContent : 'Craft Single Tweet';

            try {
                if (btnTextSpan) btnTextSpan.textContent = 'Crafting...';
                genSingleBtn.disabled = true;

                let prompt = `You are a viral Web3/Crypto ghostwriter on X (Twitter). Your task is to write a highly engaging, standalone single tweet.
CRITICAL CONSTRAINTS:
- Write EXACTLY 1 tweet.
- Target Tone: ${tone}
- The tweet MUST be under 280 characters.
- Do NOT output any conversational filler or pre/post text. JUST the tweet content itself.
`;

                if (hasDocument) {
                    prompt += `\nBASE THIS TWEET ENTIRELY OFF THE FOLLOWING DOCUMENT TEXT. SUMMARIZE ONE OF THE MOST ENGAGING INSIGHTS:\n\n"""\n${window.TweetPremium.getUploadedText().substring(0, 4000)}\n"""\n`;
                }

                if (topic) {
                    prompt += `\nTHE CLUE / TOPIC FOR THIS TWEET IS: "${topic}"\n`;
                }

                let tweet = await callAIEndpoint(prompt);
                tweet = tweet.trim().replace(/^"|"$/g, ''); // strip optional quotes

                if (singleInput) {
                    singleInput.value = tweet;
                    charCounter.textContent = `${tweet.length}/280`;
                    singleOutput.style.display = 'block';
                    singleOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    showToast('Tweet crafted magically! ✨', 'success');
                }
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                if (btnTextSpan) btnTextSpan.textContent = originalText;
                genSingleBtn.disabled = false;
            }
        });
    }

    // ─── Copy all thread ─────────────────────────────────────────────────────────
    const copyAllBtn = document.getElementById('copy-all-btn');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', () => {
            const text = currentThread.join('\n\n─────\n\n');
            navigator.clipboard.writeText(text).then(() => showToast('Full thread copied!', 'success'));
        });
    }

    // ─── Copy single tweet ───────────────────────────────────────────────────────
    const copySingleBtn = document.getElementById('copy-single-btn');
    if (copySingleBtn) {
        copySingleBtn.addEventListener('click', () => {
            if (singleInput) {
                navigator.clipboard.writeText(singleInput.value).then(() => showToast('Tweet copied!', 'success'));
            }
        });
    }

    // ─── Save Draft ──────────────────────────────────────────────────────────────
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            if (!currentThread.length) { showToast('Generate a thread first!', 'error'); return; }
            const draft = {
                id: Date.now(),
                topic: topicInput ? topicInput.value : 'Thread',
                tweets: [...currentThread],
                date: new Date().toLocaleDateString(),
                source: window.TweetPremium && window.TweetPremium.getUploadedFileName() ? '📄 ' + window.TweetPremium.getUploadedFileName() : '📝 Topic',
            };
            savedDrafts.unshift(draft);
            if (savedDrafts.length > 10) savedDrafts.pop();
            localStorage.setItem('web3ai_tweet_drafts', JSON.stringify(savedDrafts));
            renderDrafts();
            showToast('Draft saved! 💾', 'success');
        });
    }

    // ─── Drafts List ─────────────────────────────────────────────────────────────
    function renderDrafts() {
        if (!draftsContainer) return;
        if (!savedDrafts.length) {
            draftsContainer.innerHTML = `<p style="color:var(--text-muted);font-size:0.82rem">No saved drafts yet.</p>`;
            return;
        }
        draftsContainer.innerHTML = savedDrafts.map((d, i) => `
      <div class="draft-item">
        <div>
          <div style="font-size:0.85rem;font-weight:600">${d.topic}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${d.tweets.length} tweets · ${d.date}${d.source ? ' · ' + d.source : ''}</div>
        </div>
        <div style="display:flex;gap:0.4rem">
          <button class="btn btn-ghost draft-load" data-idx="${i}" style="font-size:0.75rem;padding:0.3rem 0.6rem">Load</button>
          <button class="btn btn-ghost draft-del" data-idx="${i}" style="font-size:0.75rem;padding:0.3rem 0.6rem;color:var(--red-1,#ef4444)">✕</button>
        </div>
      </div>`).join('');

        draftsContainer.querySelectorAll('.draft-load').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = savedDrafts[+btn.dataset.idx];
                currentThread = d.tweets;
                if (topicInput) topicInput.value = d.topic;
                renderThread(currentThread);
                outputSection.style.display = 'block';
                outputSection.scrollIntoView({ behavior: 'smooth' });
                showToast('Draft loaded!', 'success');
            });
        });
        draftsContainer.querySelectorAll('.draft-del').forEach(btn => {
            btn.addEventListener('click', () => {
                savedDrafts.splice(+btn.dataset.idx, 1);
                localStorage.setItem('web3ai_tweet_drafts', JSON.stringify(savedDrafts));
                renderDrafts();
            });
        });
    }

    // ─── Suggestion chips ────────────────────────────────────────────────────────
    document.querySelectorAll('.topic-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (topicInput) topicInput.value = chip.dataset.topic;
            generateThread(chip.dataset.topic);
        });
    });

    // ─── Toast helper ────────────────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
        if (window.showToast) { window.showToast(msg, type); return; }
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ─── Init ────────────────────────────────────────────────────────────────────
    renderDrafts();
})();
