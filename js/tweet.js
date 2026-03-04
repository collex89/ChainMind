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

    const TOPIC_KNOWLEDGE = {
        defi: {
            tweets: [
                'DeFi (Decentralized Finance) removes the middlemen from financial services. No banks. No brokers. Just code.',
                'At the core of DeFi are smart contracts — self-executing programs on blockchains like Ethereum or Solana that handle transactions automatically.',
                'The Total Value Locked (TVL) in DeFi protocols measures how much crypto is deposited. At its peak, DeFi held over $180B in assets.',
                'Key DeFi primitives:\n• AMMs (Automated Market Makers)\n• Lending protocols\n• Yield aggregators\n• Stablecoins\n• Derivatives\n\nEach one replaces a traditional financial service.',
                'AMMs like Uniswap use liquidity pools instead of order books. Users deposit token pairs and earn fees from every swap. That\'s yield farming basics.',
                'Risks in DeFi are real:\n❌ Smart contract bugs\n❌ Rug pulls\n❌ Impermanent loss\n❌ Oracle manipulation\n\nAlways DYOR before depositing.',
                'The best DeFi protocols have been audited, battle-tested, and are transparent about risk. Aave, Compound, Uniswap — all open-source.',
            ]
        },
        nft: {
            tweets: [
                'NFTs (Non-Fungible Tokens) prove digital ownership on-chain. Each token is unique and cannot be copied — unlike regular crypto.',
                'An NFT is just a token standard (ERC-721 or ERC-1155 on Ethereum). The magic is in what it represents: art, music, memberships, game items, real estate.',
                'The biggest NFT sale ever: Beeple\'s "Everydays: The First 5000 Days" sold for $69.3 million at Christie\'s in March 2021.',
                'NFT metadata stores the actual content (image, video, audio). Most live on IPFS or Arweave — decentralized storage that can\'t be taken down.',
                'NFT utility beyond JPEGs:\n🎟️ Event tickets\n🎮 In-game items\n🏠 Real estate claims\n💎 Loyalty rewards\n📜 On-chain credentials',
                'Royalties are one of NFTs\' most powerful features. Creators earn a % automatically on every secondary sale — smart contracts enforce it trustlessly.',
                'The NFT space is evolving: dynamic NFTs that change based on real-world data, soulbound tokens for identity, and fractional NFTs are all growing fast.',
            ]
        },
        layer2: {
            tweets: [
                'Layer 2 (L2) solutions scale Ethereum by processing transactions off-chain, then settling on Ethereum\'s mainnet. Speed goes up, fees go down.',
                'There are 2 main L2 types:\n\n⚡ Optimistic Rollups — assume txs are valid, allow 7-day challenges\n🔐 ZK Rollups — use cryptographic proofs to verify validity instantly',
                'Optimistic rollups (Arbitrum, Optimism, Base) are dominant today. They\'re Ethereum-compatible and easy to deploy existing Solidity contracts on.',
                'ZK rollups (zkSync, StarkNet, Polygon zkEVM) offer faster finality and better security. They use zero-knowledge proofs to verify entire batches in one shot.',
                'Transaction throughput comparison:\n• Ethereum L1: ~15 TPS\n• Arbitrum: ~40,000 TPS\n• zkSync: ~20,000 TPS\n\nThis is how crypto scales to billions of users.',
                'The Ethereum roadmap is built around L2s. Danksharding (EIP-4844) cuts L2 data costs by 10-100x with "blobs" — a new transaction type for rollup data.',
                'Bridge carefully. Moving assets between L1 ↔ L2 carries risk. Use well-audited bridges, never bridge your entire net worth at once.',
            ]
        },
        dao: {
            tweets: [
                'A DAO (Decentralized Autonomous Organization) is an organization governed by code and token-based voting — not CEOs or boardrooms.',
                'DAO governance works via proposals + voting. Token holders vote on everything: treasury spending, protocol upgrades, partnerships, hiring.',
                'The largest DAOs manage billions in treasuries:\n• Uniswap DAO: ~$4B+\n• BitDAO: ~$2B+\n• Compound: $500M+\n\nAll governed by community vote.',
                'Governance tokens give holders voting rights. But voter apathy is real — most DAOs struggle with low participation. This is an unsolved problem.',
                'DAO tooling is maturing fast:\n🗳️ Snapshot (offchain voting)\n🏦 Gnosis Safe (multisig treasury)\n💬 Discourse (governance forums)\n⚡ Tally (onchain execution)',
                'Legal structures for DAOs are emerging. Wyoming, Marshall Islands, and Panama now offer DAO LLC wrappers. Regulation is catching up.',
                'The future of DAOs: contribution-based reputation systems, AI-powered governance proposals, and cross-chain voting. Still early, still experimental.',
            ]
        },
        blockchain: {
            tweets: [
                'A blockchain is a distributed ledger — a database replicated across thousands of computers worldwide. No single point of failure. No single ruler.',
                'Every block contains:\n📦 Transaction data\n🕐 Timestamp\n🔗 Hash of previous block\n🔑 Its own unique hash\n\nChain them together = blockchain.',
                'Consensus mechanisms decide who adds the next block:\n⚡ Proof of Work (Bitcoin) — miners compete with computing power\n🌱 Proof of Stake (Ethereum) — validators stake crypto as collateral',
                'Bitcoin: the original blockchain. ~21M max supply, ~10min block time, pure store of value. The "digital gold" narrative is its clearest use case.',
                'Ethereum extended the idea: a programmable blockchain. Smart contracts enabled DeFi, NFTs, DAOs — an entire digital economy built on top.',
                'The blockchain trilemma (Vitalik Buterin): you can only pick 2 of 3:\n🔐 Security\n⚡ Scalability\n🌐 Decentralization\n\nThis drives most design decisions.',
                'The next frontier: modular blockchains. Separate layers for execution, settlement, and data availability. Celestia, EigenLayer, and Ethereum\'s roadmap are leading this.',
            ]
        },
        wallet: {
            tweets: [
                'A crypto wallet doesn\'t "store" your crypto. It stores your private key — the password that proves you own assets on the blockchain.',
                'Two types of wallets:\n🔗 Custodial — exchange holds your keys (easy, risky)\n🔐 Non-custodial — you hold your keys (harder, safer)\n\n"Not your keys, not your coins."',
                'Seed phrases = your master password. 12 or 24 random words that can recover your entire wallet.\n\n❌ Never screenshot it\n❌ Never type it online\n✅ Write it on paper, store safely',
                'Hardware wallets (Ledger, Trezor) are the gold standard. Your private key never touches the internet. Immune to malware and phishing.',
                'Common attack vectors:\n🎣 Phishing sites\n🪤 Fake wallet apps\n📋 Clipboard hijacking\n🤝 Malicious token approvals\n\nRevoke approvals regularly at revoke.cash.',
                'Multi-sig wallets require M-of-N signers to authorize a transaction. Perfect for DAOs, teams, and high-value personal wallets. Gnosis Safe is the standard.',
                'The future: account abstraction (ERC-4337) removes seed phrases. Social recovery, session keys, and gas sponsorship will make wallets feel like real apps.',
            ]
        },
    };

    // ─── Tone modifiers ─────────────────────────────────────────────────────────
    const TONE_HOOKS = {
        degen: ['ngl', 'ser', 'gm', 'lfg', 'ngmi if you sleep on this', 'based', 'this is the way', 'probably nothing 👀'],
        professional: ['According to on-chain data,', 'Research shows that', 'It\'s worth noting that', 'Historically speaking,', 'The data suggests'],
        beginner: ['In plain English:', 'Think of it like this:', 'Simple version:', 'Breaking this down:', 'No jargon — here\'s what it means:'],
        witty: ['Plot twist:', 'Hot take:', 'Counterintuitively,', 'The thing nobody tells you:', 'Unpopular opinion:'],
    };

    // ─── Standalone tweet templates ──────────────────────────────────────────────
    const SINGLE_TWEET_TEMPLATES = [
        (topic) => `The best time to learn about ${topic} was 5 years ago.\n\nThe second best time is today. 🧠`,
        (topic) => `People who understand ${topic} have an unfair advantage in the next bull run.\n\nDon't be the one who finds out too late.`,
        (topic) => `${topic} is one of those things that's hard to understand until suddenly it all clicks.\n\nAnd then you can't believe everyone doesn't get it.`,
        (topic) => `If you're still confused about ${topic}, that's fine.\n\nMost "experts" are too. Keep learning. 📚`,
        (topic) => `The most underrated thing about ${topic}:\n\nThe infrastructure being built right now will matter for decades.\n\nWe're early.`,
        (topic) => `Web3 without understanding ${topic} is like investing without understanding balance sheets.\n\nDo the work.`,
        (topic) => `${topic} is boring until you realize:\n\n→ It's replacing billion-dollar industries\n→ It's open to everyone\n→ You're early\n\nThen it's the most exciting thing in the world. 🌍`,
    ];

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

            // If document uploaded → use premium document analysis
            if (hasDocument) {
                generateFromDocument(topic);
                return;
            }

            // Standard topic-based generation
            if (!topic) {
                showToast('Please enter a topic or upload a document!', 'error');
                return;
            }
            generateThread(topic);
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
    function getTopicTweets(topic) {
        const lower = topic.toLowerCase();
        for (const [key, val] of Object.entries(TOPIC_KNOWLEDGE)) {
            if (lower.includes(key) || lower.includes(key.slice(0, 4))) {
                return val.tweets;
            }
        }
        // Generic fallback using store glossary
        const match = window.STORE && window.STORE.glossary
            ? window.STORE.glossary.find(t => lower.includes(t.term.toLowerCase()))
            : null;
        if (match) {
            return [
                `${match.term}: ${match.def}`,
                `A real-world example of ${match.term}: ${match.example}`,
                `${match.term} is closely related to: ${match.related.join(', ')}`,
                `Why ${match.term} matters: it's one of the foundational concepts in the ${match.cat} space.`,
                `The rise of ${match.term} has changed how we think about value, ownership, and trust in the digital age.`,
                `Common misconceptions about ${match.term}: most people think it's just speculation. In reality, it's infrastructure.`,
                `Where is ${match.term} headed? Adoption is accelerating. The question isn't if — it's how fast.`,
            ];
        }
        // Final generic fallback
        return [
            `${topic} is one of the most important concepts in Web3 right now. Here's why it matters.`,
            `The core idea behind ${topic}: decentralization, transparency, and trustless execution. These three principles change everything.`,
            `Most people dismiss ${topic} without understanding what it enables. Let me break that down.`,
            `${topic} isn't just a buzzword. It's a new primitive for how we coordinate, transact, and build on the internet.`,
            `Early adopters who understand ${topic} will have a significant edge. The learning curve exists for a reason — most people won't bother.`,
            `The risks around ${topic} are real, but so is the upside. The key is understanding both before committing capital or time.`,
            `Where does ${topic} go from here? Adoption is driven by utility. The projects building genuine utility will win long-term.`,
        ];
    }

    function applyTone(tweet, tone) {
        if (tone === 'neutral' || !TONE_HOOKS[tone]) return tweet;
        const hooks = TONE_HOOKS[tone];
        // 60% chance to prepend a tone hook (up from 40% for more variety)
        if (Math.random() < 0.6) {
            const hook = hooks[Math.floor(Math.random() * hooks.length)];
            return `${hook} ${tweet}`;
        }
        return tweet;
    }

    function generateThread(topic) {
        const tone = toneSelect ? toneSelect.value : 'neutral';
        const tmpl = THREAD_TEMPLATES[selectedTemplate] || THREAD_TEMPLATES.educational;
        const tweets = shuffleArray(getTopicTweets(topic)); // Shuffle for variety!
        const numTweets = tweetCountSlider ? parseInt(tweetCountSlider.value) : 8;

        // Calculate how many content tweets to include
        const maxContent = Math.max(1, numTweets - 2);
        const contentTweets = tweets.slice(0, maxContent);
        const total = contentTweets.length + 2;

        currentThread = [
            tmpl.opener(topic),
            ...contentTweets.map((tw, i) => `${i + 2}/${total}\n\n${applyTone(tw, tone)}`),
            tmpl.ender,
        ];

        renderThread(currentThread);
        outputSection.style.display = 'block';
        outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Thread generated! ✨', 'success');
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
        genSingleBtn.addEventListener('click', () => {
            const topic = topicInput ? topicInput.value.trim() : 'Web3';

            // If document uploaded + PRO active, generate from document
            if (window.TweetPremium && window.TweetPremium.getUploadedText() && window.TweetPremium.Subscription.isActive()) {
                const docText = window.TweetPremium.getUploadedText();
                const keyPoints = window.TweetPremium.Extractor.extract(docText, 1);
                if (keyPoints.length > 0) {
                    let tweet = keyPoints[0];
                    if (tweet.length > 280) tweet = tweet.substring(0, 277) + '...';
                    if (singleInput) {
                        singleInput.value = tweet;
                        charCounter.textContent = `${tweet.length}/280`;
                        singleOutput.style.display = 'block';
                        showToast('Tweet crafted from document! ✨', 'success');
                    }
                    return;
                }
            }

            // Standard single tweet
            const tmplFn = SINGLE_TWEET_TEMPLATES[Math.floor(Math.random() * SINGLE_TWEET_TEMPLATES.length)];
            const tweet = tmplFn(topic || 'Web3');
            if (singleInput) {
                singleInput.value = tweet;
                charCounter.textContent = `${tweet.length}/280`;
                singleOutput.style.display = 'block';
                showToast('Tweet crafted! ✨', 'success');
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
