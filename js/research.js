// ─── AI Research Hub — Upgraded Intelligence v2 ──────────────────────────────
//
// Key improvements over v1:
// • Priority-based intent detection (exact phrase → specific term → category → fallback)
// • Explicit keyword-to-topic maps — NO more splitting topic titles into tokens
// • Rich inline knowledge base beyond store.js topics
// • Composite answers that combine multiple sub-topics
// • Query normalisation strips filler words before matching
// • Confidence scoring for multi-match disambiguation
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    const WORKER_URL = 'https://chainmind-video.ugwucollins881.workers.dev';
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const historyEl = document.getElementById('search-history');

    let searchHistory = JSON.parse(localStorage.getItem('w3ai_history') || '[]');
    let conversationHistory = []; // Track conversation for AI context
    renderHistory();

    // ── Markdown to HTML converter for AI responses ──────────────────────
    function markdownToHtml(md) {
        return md
            .replace(/^### (.+)$/gm, '<h3 style="color:var(--text-primary);margin:0.75rem 0 0.4rem">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 style="color:var(--text-primary);margin:0.75rem 0 0.4rem;font-size:1.05rem">$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li style="margin:0.2rem 0">$1</li>')
            .replace(/^\d+\. (.+)$/gm, '<li style="margin:0.2rem 0">$1</li>')
            .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul style="padding-left:1.2rem;margin:0.4rem 0">${m}</ul>`)
            .replace(/`([^`]+)`/g, '<code style="background:rgba(139,92,246,0.15);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.85em">$1</code>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RANDOMIZATION ENGINE — ensures unique responses every time
    // ══════════════════════════════════════════════════════════════════════════
    function shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function pickRandom(arr, n) {
        return shuffleArray(arr).slice(0, Math.min(n, arr.length));
    }

    function randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Opener variations for rich answers
    const OPENER_PHRASES = [
        (title) => `Here's a comprehensive look at <strong>${title}</strong>:`,
        (title) => `Let me break down <strong>${title}</strong> for you:`,
        (title) => `Great question! Here's what you need to know about <strong>${title}</strong>:`,
        (title) => `<strong>${title}</strong> — here's the essential breakdown:`,
        (title) => `Diving into <strong>${title}</strong>. Here are the key insights:`,
        (title) => `Everything you need to understand about <strong>${title}</strong>:`,
        (title) => `<strong>${title}</strong> is a fascinating topic. Let me walk you through it:`,
    ];

    // Did-you-know facts pool (general Web3)
    const DID_YOU_KNOW = [
        'The first Bitcoin transaction was for 2 pizzas — worth $41 at the time, now over $700M.',
        'Ethereum processes more transaction value per year than PayPal.',
        'Over 50% of Fortune 100 companies are building Web3 products.',
        'The DeFi ecosystem grew from $1B to $180B TVL in just 2 years.',
        'Vitalik Buterin proposed Ethereum at age 19.',
        'The Lightning Network can process over 1 million Bitcoin transactions per second.',
        'NFT trading volume peaked at $25B in 2021.',
        'There are over 25,000 DAOs managing billions in treasury funds.',
        'ZK proofs were first described in 1985, decades before blockchain existed.',
        'Solana processes more transactions per day than Ethereum, Polygon, and Arbitrum combined.',
        'The total crypto market cap briefly exceeded $3 trillion in November 2021.',
        'Ethereum\'s Merge reduced its energy consumption by 99.95%.',
    ];

    // Glossary answer variation templates
    const GLOSSARY_TEMPLATES = [
        (term, cat, def, example, related) => `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
      <strong style="font-size:1.05rem;color:var(--text-primary)">${term}</strong>
      <span class="badge badge-${cat}">${cat}</span>
    </div>
    <p style="color:var(--text-secondary);margin-bottom:0.75rem">${def}</p>
    <div style="padding:0.65rem;background:rgba(34,211,238,0.05);border-radius:8px;border-left:3px solid rgba(34,211,238,0.4);margin-bottom:0.75rem">
      <div style="font-size:0.78rem;font-weight:700;color:var(--cyan-1);margin-bottom:0.3rem">💡 Example</div>
      <div style="font-size:0.85rem;color:var(--text-secondary)">${example}</div>
    </div>
    <div style="font-size:0.82rem">
      <strong style="color:var(--purple-1)">Related terms:</strong>
      <span style="color:var(--text-secondary)"> ${related}</span>
    </div>`,

        (term, cat, def, example, related) => `<div style="margin-bottom:0.75rem">
      <strong style="font-size:1.1rem;color:var(--text-primary)">${term}</strong>
      <span class="badge badge-${cat}" style="margin-left:0.5rem">${cat}</span>
    </div>
    <div style="padding:0.75rem;background:rgba(139,92,246,0.06);border-radius:10px;margin-bottom:0.75rem">
      <p style="color:var(--text-secondary);margin:0">${def}</p>
    </div>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem"><strong style="color:var(--cyan-1)">In practice:</strong> ${example}</p>
    <div style="font-size:0.82rem">
      <strong style="color:var(--purple-1)">Explore related:</strong>
      <span style="color:var(--text-secondary)"> ${related}</span>
    </div>`,

        (term, cat, def, example, related) => `<strong style="font-size:1.05rem;color:var(--text-primary)">${term}</strong> <span class="badge badge-${cat}">${cat}</span>
    <p style="color:var(--text-secondary);margin:0.75rem 0">${def}</p>
    <div style="padding:0.65rem;background:rgba(0,0,0,0.2);border-radius:8px;border-left:3px solid var(--green-1);margin-bottom:0.75rem">
      <div style="font-size:0.78rem;font-weight:700;color:var(--green-1);margin-bottom:0.3rem">🔍 Real-world example</div>
      <div style="font-size:0.85rem;color:var(--text-secondary)">${example}</div>
    </div>
    <p style="font-size:0.82rem;color:var(--text-muted)">Also check out: <span style="color:var(--purple-1)">${related}</span></p>`,

        (term, cat, def, example, related) => `<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.75rem">
      <div><strong style="font-size:1.05rem">${term}</strong> · <span class="badge badge-${cat}">${cat}</span></div>
      <p style="color:var(--text-secondary);font-size:0.92rem">${def}</p>
    </div>
    <div style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.12);border-radius:10px;padding:0.75rem;margin-bottom:0.75rem">
      <div style="font-size:0.78rem;font-weight:700;color:var(--purple-1);margin-bottom:0.3rem">📋 Example</div>
      <div style="font-size:0.85rem;color:var(--text-secondary)">${example}</div>
    </div>
    <p style="font-size:0.82rem"><strong style="color:var(--cyan-1)">Related:</strong> <span style="color:var(--text-secondary)">${related}</span></p>`,
    ];

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 1 — INLINE RICH KNOWLEDGE BASE
    // Each entry has: title, summary, sections[], tags[]
    // ══════════════════════════════════════════════════════════════════════════
    const KNOWLEDGE = {

        web3: {
            title: 'What is Web3?',
            icon: '🌐',
            tags: ['web3', 'web 3', 'web3.0', 'what is web3', 'explain web3', 'overview'],
            summary: 'Web3 is the next evolution of the internet — a decentralised, user-owned version of the web built on public blockchains. Unlike Web2 (owned by corporations like Google and Meta), Web3 gives users control of their data, identity, and assets through cryptography.',
            sections: [
                {
                    label: '🧠 Web1 → Web2 → Web3',
                    body: '<b>Web1 (1990–2005)</b>: Read-only. Static web pages.<br><b>Web2 (2005–now)</b>: Read-write. Social media, apps — but data owned by corporations.<br><b>Web3 (now)</b>: Read-write-<em>own</em>. Decentralised apps where users hold their assets and identity on-chain.',
                },
                {
                    label: '🔑 Core Pillars of Web3',
                    body: '• <b>Decentralisation</b> — No single point of control<br>• <b>Trustlessness</b> — Smart contracts enforce rules automatically<br>• <b>Permissionlessness</b> — Anyone can build or participate<br>• <b>Native payments</b> — Cryptocurrency as first-class money<br>• <b>Self-sovereign identity</b> — You own your wallet, not a platform',
                },
                {
                    label: '⚙️ Key Technologies',
                    body: 'Blockchains (Ethereum, Solana, BNB Chain), Smart Contracts, DeFi, NFTs, DAOs, Layer 2 scaling, Zero-knowledge proofs, Decentralised storage (IPFS, Arweave)',
                },
                {
                    label: '🚀 Why It Matters',
                    body: 'Web3 enables: borderless finance without banks, creator ownership of content, community governance of platforms, programmable money, and an internet that can\'t be shut down by any single company or government.',
                },
            ],
        },

        defi: {
            title: 'DeFi — Decentralised Finance',
            icon: '⚡',
            tags: ['defi', 'decentralised finance', 'decentralized finance', 'dex', 'liquidity', 'amm', 'yield farming', 'lending', 'staking', 'aave', 'uniswap', 'compound', 'impermanent loss', 'liquidity pool', 'tvl', 'total value locked'],
            summary: 'DeFi (Decentralised Finance) recreates financial services — lending, trading, earning yield — using smart contracts instead of banks. Anyone with a wallet can participate without identity verification.',
            sections: [
                {
                    label: '🏗️ DeFi Primitives',
                    body: '• <b>AMMs</b> (Automated Market Makers) — Uniswap, Curve use liquidity pools instead of order books<br>• <b>Lending/Borrowing</b> — Aave, Compound let users lend assets to earn interest or borrow against collateral<br>• <b>Yield Aggregators</b> — Yearn.finance auto-compounds yields from multiple protocols<br>• <b>Stablecoins</b> — USDC, DAI, USDT maintain $1 peg through different mechanisms<br>• <b>Derivatives</b> — dYdX, GMX offer perpetuals and options on-chain',
                },
                {
                    label: '📊 Key Metrics',
                    body: '<b>TVL (Total Value Locked)</b>: Total crypto deposited in DeFi protocols. Peaked at ~$180B in Nov 2021.<br><b>APY/APR</b>: Annual yield earned by liquidity providers or lenders.<br><b>Slippage</b>: Price impact of a trade on an AMM — larger trades = more slippage.',
                },
                {
                    label: '⚠️ DeFi Risks',
                    body: '• Smart contract bugs (countless hacks in history)<br>• Impermanent loss for LPs when prices diverge<br>• Oracle manipulation — price feeds attacked to drain protocols<br>• Rug pulls — dev team drains liquidity and disappears<br>• Regulatory uncertainty',
                },
                {
                    label: '⚡ Top Protocols',
                    body: 'Uniswap (DEX), Aave (lending), Curve (stablecoin swaps), Compound (lending), MakerDAO (DAI stablecoin), Balancer (weighted pools), Lido (staking), Yearn (yield aggregation)',
                },
            ],
        },

        nft: {
            title: 'NFTs — Non-Fungible Tokens',
            icon: '🎨',
            tags: ['nft', 'nfts', 'non-fungible', 'digital art', 'opensea', 'erc-721', 'erc721', 'erc-1155', 'mint', 'minting', 'royalties', 'metadata', 'ipfs nft', 'bored ape', 'bayc'],
            summary: 'NFTs are unique cryptographic tokens on a blockchain that prove ownership of a specific digital (or physical) asset. Unlike cryptocurrency (fungible), each NFT is one-of-a-kind and cannot be replicated.',
            sections: [
                {
                    label: '🔗 How NFTs Work',
                    body: 'An NFT is a token standard — ERC-721 or ERC-1155 on Ethereum. The token lives on-chain; the actual asset (image, video) is usually stored on decentralised storage like IPFS or Arweave. The token contains metadata pointing to the asset.',
                },
                {
                    label: '🎭 NFT Use Cases',
                    body: '• <b>Digital art</b> — Beeple sold "Everydays" for $69.3M at Christie\'s<br>• <b>Gaming items</b> — In-game weapons, skins with true ownership<br>• <b>Music</b> — Artists sell songs as NFTs, keeping more revenue<br>• <b>Memberships</b> — Bored Ape Yacht Club as exclusive club access<br>• <b>Real estate</b> — Deeds tokenised on-chain<br>• <b>Identity</b> — Soulbound tokens for non-transferable credentials',
                },
                {
                    label: '💰 Creator Royalties',
                    body: 'NFT smart contracts can encode royalty percentages (e.g., 5-10%) so creators automatically earn on every secondary sale — no middlemen needed.',
                },
                {
                    label: '🔮 Future of NFTs',
                    body: 'Dynamic NFTs that change based on real-world data (e.g., sports stats), fractional NFTs for partial ownership of expensive assets, and soulbound tokens for on-chain identity are key trends.',
                },
            ],
        },

        layer2: {
            title: 'Layer 2 Scaling Solutions',
            icon: '🔷',
            tags: ['layer 2', 'layer2', 'l2', 'rollup', 'rollups', 'optimistic rollup', 'zk rollup', 'arbitrum', 'optimism', 'base', 'zksync', 'starknet', 'polygon', 'scaling', 'ethereum scaling', 'transaction fees', 'gas fees'],
            summary: 'Layer 2 solutions scale Ethereum by processing transactions off the main chain (Layer 1) and then settling proofs back on it. This dramatically reduces transaction costs and increases throughput.',
            sections: [
                {
                    label: '⚡ Two Main Approaches',
                    body: '<b>Optimistic Rollups</b> (Arbitrum, Optimism, Base): Assume transactions are valid. Anyone can challenge invalid ones within a 7-day window. EVM-compatible — easy to port Solidity code.<br><br><b>ZK Rollups</b> (zkSync, StarkNet, Polygon zkEVM): Use zero-knowledge proofs to cryptographically prove batches of transactions are valid. Faster finality but more complex.',
                },
                {
                    label: '📈 Performance Comparison',
                    body: '• Ethereum L1: ~15 TPS, $5–50 per tx<br>• Arbitrum: ~40,000 TPS, $0.01–0.10 per tx<br>• zkSync: ~20,000 TPS, $0.01 per tx<br>• Optimism: ~2,000 TPS, $0.01–0.05 per tx',
                },
                {
                    label: '🔗 Key L2 Projects',
                    body: '<b>Arbitrum</b>: Largest L2 by TVL, EVM-compatible, hosts major DeFi protocols<br><b>Base</b>: Coinbase\'s L2, built on OP Stack, rapid user growth<br><b>Optimism</b>: OP Stack powers a "Superchain" ecosystem<br><b>zkSync Era</b>: ZK-based, native account abstraction support<br><b>StarkNet</b>: Uses Cairo language, most battle-tested ZK infrastructure',
                },
                {
                    label: '🛡️ EIP-4844 "Proto-Danksharding"',
                    body: 'Introduced "blobs" — a new transaction type that allows L2s to post data more cheaply on Ethereum. Reduced L2 costs by 10-100x. Part of Ethereum\'s Dencun upgrade (March 2024).',
                },
            ],
        },

        dao: {
            title: 'DAOs — Decentralised Autonomous Organisations',
            icon: '🏛️',
            tags: ['dao', 'daos', 'governance', 'governance token', 'voting', 'proposal', 'treasury', 'multisig', 'snapshot', 'on-chain governance', 'off-chain governance', 'token voting'],
            summary: 'A DAO is an organisation governed by smart contracts and token-based voting instead of a CEO and board. Anyone holding governance tokens can propose and vote on decisions — from treasury spending to protocol upgrades.',
            sections: [
                {
                    label: '🗳️ How DAO Governance Works',
                    body: '1. A member creates a proposal (e.g., "Allocate $100K to marketing")<br>2. Token holders vote — usually 1 token = 1 vote<br>3. If quorum is met and vote passes, smart contracts execute it automatically (on-chain) or a multisig executes it (off-chain)<br>4. All activity is transparent on the blockchain',
                },
                {
                    label: '💰 Major DAO Treasuries',
                    body: '• <b>Uniswap DAO</b>: $3.5B+ treasury (UNI tokens)<br>• <b>Arbitrum DAO</b>: $3B+ in ARB tokens<br>• <b>ENS DAO</b>: Governs Ethereum Name Service<br>• <b>Gitcoin DAO</b>: Funds open-source development<br>• <b>MakerDAO</b>: Controls the DAI stablecoin system',
                },
                {
                    label: '🔧 DAO Tooling',
                    body: '• <b>Snapshot</b> — Offchain gasless voting<br>• <b>Tally</b> — Onchain governance execution<br>• <b>Gnosis Safe</b> — Multisig treasury management<br>• <b>Discourse</b> — Forum for governance discussion<br>• <b>Boardroom</b> — DAO analytics dashboard',
                },
                {
                    label: '⚠️ DAO Challenges',
                    body: 'Voter apathy (most token holders don\'t vote), plutocracy risk (whales dominate), legal uncertainty, slow decision-making, and Sybil attacks (one person controlling many wallets).',
                },
            ],
        },

        blockchain: {
            title: 'Blockchain Fundamentals',
            icon: '⛓️',
            tags: ['blockchain', 'block', 'chain', 'distributed ledger', 'consensus', 'proof of work', 'proof of stake', 'pow', 'pos', 'bitcoin', 'ethereum', 'validator', 'miner', 'node', 'hash', 'merkle', 'finality', 'immutable'],
            summary: 'A blockchain is a distributed, append-only ledger shared across thousands of computers (nodes). Every transaction is grouped into blocks, cryptographically linked to the previous block, and cannot be altered — creating a tamper-proof history.',
            sections: [
                {
                    label: '🔗 How Blocks Work',
                    body: 'Each block contains: transaction data, a timestamp, the hash of the previous block, and its own hash (fingerprint). Changing one block would change its hash and break every subsequent block — making fraud computationally impractical.',
                },
                {
                    label: '⚖️ Consensus Mechanisms',
                    body: '<b>Proof of Work (PoW)</b> — Bitcoin. Miners compete using computational power to add blocks. Energy-intensive but battle-tested since 2009.<br><br><b>Proof of Stake (PoS)</b> — Ethereum (post-Merge). Validators stake ETH as collateral. If they cheat, they get "slashed". Far more energy-efficient (99.95% less energy than PoW).<br><br><b>Delegated PoS</b> — Solana, BNB Chain. Faster but more centralised.',
                },
                {
                    label: '🔺 The Blockchain Trilemma',
                    body: 'Coined by Vitalik Buterin — a blockchain can only fully achieve 2 of these 3:<br>• <b>Security</b> — resistant to attacks<br>• <b>Scalability</b> — handles many transactions<br>• <b>Decentralisation</b> — no central control<br><br>This is why Layer 2s exist — offload scalability while inheriting L1 security.',
                },
                {
                    label: '⛓️ Major Blockchains Compared',
                    body: '• <b>Bitcoin</b>: Most secure, PoW, ~7 TPS, digital gold<br>• <b>Ethereum</b>: Programmable, PoS, most DeFi/NFT activity<br>• <b>Solana</b>: ~65,000 TPS, low fees, PoH consensus<br>• <b>BNB Chain</b>: EVM-compatible, centralised, high usage<br>• <b>Avalanche</b>: Subnet architecture, EVM-compatible',
                },
            ],
        },

        wallet: {
            title: 'Crypto Wallets & Security',
            icon: '🔐',
            tags: ['wallet', 'wallets', 'seed phrase', 'private key', 'metamask', 'phantom', 'ledger', 'trezor', 'hardware wallet', 'hot wallet', 'cold wallet', 'custodial', 'non-custodial', 'self-custody', 'approve', 'revoke', 'phishing', 'account abstraction', 'erc-4337'],
            summary: 'A crypto wallet doesn\'t store coins — it stores your private key, which proves ownership of your on-chain assets. Wallet security is the most critical skill in Web3.',
            sections: [
                {
                    label: '🗂️ Types of Wallets',
                    body: '<b>Hot Wallets</b> (connected to internet): MetaMask, Phantom, Rabby — convenient but more attack surface.<br><br><b>Hardware Wallets</b> (cold): Ledger, Trezor — private key never touches the internet. Best for large holdings.<br><br><b>Custodial</b>: Exchange holds your keys (Coinbase, Binance) — easy but "not your keys, not your coins".<br><br><b>Smart Contract Wallets</b>: Safe (Gnosis), Argent — programmable rules, social recovery.',
                },
                {
                    label: '🔑 Seed Phrases',
                    body: 'A 12 or 24-word BIP-39 mnemonic that generates all your private keys. Anyone who has it controls your funds.<br><br>✅ Write on paper, store in fireproof safe<br>✅ Never type it anywhere online<br>❌ Never screenshot it<br>❌ Never share with anyone — not even "support"',
                },
                {
                    label: '⚠️ Common Attack Vectors',
                    body: '🎣 <b>Phishing</b> — Fake websites that mimic MetaMask, Uniswap etc.<br>📋 <b>Clipboard hijacking</b> — Malware replaces copied wallet addresses<br>🪤 <b>Malicious approvals</b> — Signing a token approval that drains your wallet<br>💬 <b>Social engineering</b> — Fake support agents on Discord/Telegram asking for seed phrases<br>🤝 <b>Fake airdrops</b> — NFTs that drain your wallet when you interact with them',
                },
                {
                    label: '🔮 Account Abstraction (ERC-4337)',
                    body: 'The future of wallets: eliminates seed phrases via social recovery, adds session keys for dApps, allows gas sponsorship, and makes wallets feel like real apps. Already live on Ethereum and many L2s.',
                },
            ],
        },

        smartcontract: {
            title: 'Smart Contracts',
            icon: '📝',
            tags: ['smart contract', 'smart contracts', 'solidity', 'evm', 'ethereum virtual machine', 'abi', 'bytecode', 'deploy', 'audit', 'security audit', 'gas', 'gas limit', 'gas price'],
            summary: 'Smart contracts are self-executing programs stored on a blockchain. They run exactly as coded — no downtime, censorship, or third-party interference. Once deployed, they are permanent and public.',
            sections: [
                {
                    label: '⚙️ How Smart Contracts Work',
                    body: 'Written in Solidity (Ethereum) or Rust (Solana), compiled to bytecode, and deployed to the blockchain. Every interaction costs gas (computation fee). The contract\'s logic executes automatically when conditions are met — no human needed.',
                },
                {
                    label: '🏗️ What They Enable',
                    body: '• DeFi: Automated lending, trading, yield — no banks<br>• NFTs: Ownership certificates with royalty logic<br>• DAOs: On-chain governance execution<br>• Token issuance: ERC-20, ERC-721 standards<br>• Escrow: Automatic fund release on completion<br>• Insurance: Parametric payouts triggered by oracles',
                },
                {
                    label: '🛡️ Security & Audits',
                    body: 'Common vulnerabilities: reentrancy attacks, integer overflow, access control bugs, oracle manipulation.<br><br>Best-practice: professional audits (Trail of Bits, OpenZeppelin, Certik), bug bounty programs, formal verification. Most major hacks are due to unaudited or poorly audited contracts.',
                },
            ],
        },

        zk: {
            title: 'Zero-Knowledge Proofs',
            icon: '🔬',
            tags: ['zk', 'zero knowledge', 'zero-knowledge', 'zk proof', 'zk rollup', 'zkp', 'snark', 'stark', 'groth16', 'plonk', 'privacy', 'circom', 'cairo', 'prover', 'verifier'],
            summary: 'Zero-Knowledge Proofs (ZKPs) allow one party to prove something is true without revealing WHY it\'s true. In Web3 they power private transactions and massively scalable rollups.',
            sections: [
                {
                    label: '🧪 The Core Idea',
                    body: 'Example: Prove you know a password without revealing the password. Or prove a batch of 10,000 transactions are all valid without showing each one — this is how ZK rollups work.<br><br>Key property: the verifier learns nothing about the inputs beyond "the statement is true".',
                },
                {
                    label: '🔷 ZK-SNARKs vs ZK-STARKs',
                    body: '<b>SNARKs</b> (Succinct Non-interactive ARguments of Knowledge): Compact, fast to verify, require trusted setup. Used by Zcash, Groth16.<br><br><b>STARKs</b> (Scalable Transparent ARguments of Knowledge): No trusted setup, post-quantum secure, larger proof size. Used by StarkNet.',
                },
                {
                    label: '🌍 Applications',
                    body: '• <b>ZK Rollups</b>: Scale Ethereum 100-1000x<br>• <b>Private transactions</b>: Zcash, Tornado Cash<br>• <b>ZK-KYC</b>: Prove you are 18+ without revealing your ID<br>• <b>ZK identity</b>: Polygon ID, Worldcoin<br>• <b>ZK ML</b>: Prove an AI model ran correctly',
                },
            ],
        },

        stablecoin: {
            title: 'Stablecoins Explained',
            icon: '🏦',
            tags: ['stablecoin', 'stablecoins', 'usdc', 'usdt', 'dai', 'tether', 'pegged', 'algorithmic stablecoin', 'collateral', 'frax', 'luna', 'ust', 'de-peg'],
            summary: 'Stablecoins are cryptocurrencies pegged to a reference asset (usually $1 USD). They combine blockchain\'s programmability with price stability, making them essential for DeFi, payments, and savings.',
            sections: [
                {
                    label: '🏗️ Types of Stablecoins',
                    body: '<b>Fiat-backed</b> (USDC, USDT): Each token is backed 1:1 by real dollars in a bank. Most stable but centralised — issuer can freeze your tokens.<br><br><b>Crypto-collateralised</b> (DAI, crvUSD): Backed by excess crypto collateral (e.g., 150% ETH to mint DAI). Decentralised but can be liquidated.<br><br><b>Algorithmic</b> (UST): Tried to maintain peg through supply/demand algorithms. UST collapsed in May 2022, wiping $40B in value.',
                },
                {
                    label: '📊 Current Market',
                    body: 'Stablecoin market cap: ~$160B (2024). USDT (Tether) is largest at ~$90B. USDC is second. DAI/USDS is the largest decentralised stablecoin. Used for remittances, DeFi, and as on/off ramps.',
                },
                {
                    label: '⚠️ De-peg Risk',
                    body: 'No stablecoin is perfectly risk-free. USDC briefly de-pegged to $0.87 in March 2023 when Silicon Valley Bank (which held $3.3B of reserves) collapsed. Eventually restored. Always diversify stablecoin exposure.',
                },
            ],
        },

        ethereum: {
            title: 'Ethereum — The World Computer',
            icon: '💎',
            tags: ['ethereum', 'eth', 'ether', 'vitalik', 'evm', 'merge', 'pos ethereum', 'staking eth', 'validator ethereum', 'gas ethereum', 'dencun', 'roadmap ethereum', 'eip', 'eip-1559'],
            summary: 'Ethereum is the world\'s largest smart contract platform. Beyond being a currency, ETH is programmable money — the "oil" powering a global, decentralised application ecosystem.',
            sections: [
                {
                    label: '📅 Key Milestones',
                    body: '• 2015 — Ethereum mainnet launch<br>• 2017 — ICO boom on ERC-20 tokens<br>• 2020 — DeFi Summer<br>• 2021 — NFT boom, EIP-1559 (fee burn mechanism)<br>• 2022 — The Merge (PoW → PoS, 99.95% energy reduction)<br>• 2024 — Dencun upgrade (EIP-4844, blob transactions reducing L2 fees)',
                },
                {
                    label: '🛣️ Ethereum Roadmap',
                    body: 'Vitalik\'s roadmap phases: <b>The Merge</b> ✅ → <b>The Surge</b> (full danksharding for L2 data) → <b>The Scourge</b> (MEV resistance) → <b>The Verge</b> (Verkle trees, stateless clients) → <b>The Purge</b> (history expiry) → <b>The Splurge</b> (misc improvements)',
                },
                {
                    label: '💰 ETH as Money',
                    body: 'Post-Merge, ETH issuance dropped ~90%. When network usage is high, more ETH is burned (EIP-1559) than issued — making ETH deflationary ("ultrasound money"). Total burned: 4M+ ETH as of 2024.',
                },
            ],
        },

        bitcoin: {
            title: 'Bitcoin — Digital Gold',
            icon: '₿',
            tags: ['bitcoin', 'btc', 'satoshi', 'satoshi nakamoto', 'halving', 'mining', 'proof of work bitcoin', '21 million', 'lightning network', 'ordinals', 'runes'],
            summary: 'Bitcoin is the first and most secure blockchain, created by pseudonymous Satoshi Nakamoto in 2009. Its primary use case is a decentralised store of value — digital gold with a hard cap of 21 million coins.',
            sections: [
                {
                    label: '📊 Bitcoin Basics',
                    body: '• Max supply: 21 million BTC (ever)<br>• Current supply: ~19.7 million mined<br>• Block time: ~10 minutes<br>• Consensus: Proof of Work (SHA-256)<br>• Script language: Bitcoin Script (intentionally limited)',
                },
                {
                    label: '📅 Bitcoin Halvings',
                    body: 'Every ~4 years (210,000 blocks), the mining reward halves. This controlled supply schedule is why Bitcoin is considered "sound money".<br>• 2009: 50 BTC per block<br>• 2012: 25 BTC<br>• 2016: 12.5 BTC<br>• 2020: 6.25 BTC<br>• 2024: 3.125 BTC (April 2024)',
                },
                {
                    label: '⚡ Bitcoin\'s Expanding Ecosystem',
                    body: '<b>Lightning Network</b>: Payment channels for instant, near-free Bitcoin transactions — used in El Salvador.<br><b>Ordinals</b>: Data (images, text) inscribed directly onto satoshis — Bitcoin\'s own NFTs.<br><b>Runes</b>: Fungible token protocol for Bitcoin (launched at 2024 halving).',
                },
            ],
        },

        solana: {
            title: 'Solana — High-Performance Blockchain',
            icon: '☀️',
            tags: ['solana', 'sol', 'proof of history', 'poh', 'svm', 'solana virtual machine', 'jupiter', 'raydium', 'helius', 'saga'],
            summary: 'Solana is a high-performance Layer 1 blockchain designed for speed and low cost. It uses a unique consensus mechanism called Proof of History to achieve ~65,000 TPS with sub-second finality.',
            sections: [
                {
                    label: '⚡ What Makes Solana Fast',
                    body: '<b>Proof of History (PoH)</b>: A cryptographic clock that sequences transactions before validators see them, removing the need for nodes to communicate timestamps. Combined with Proof of Stake for economic security.<br><br>Result: ~400ms block times, $0.0001 avg transaction cost.',
                },
                {
                    label: '🏗️ Solana Ecosystem',
                    body: 'DeFi: Jupiter (DEX aggregator), Raydium, Orca<br>NFTs: Magic Eden<br>Wallets: Phantom, Backpack<br>Infrastructure: Helius (RPC), Jito (MEV)<br>Consumer: Dialect, Tensor',
                },
                {
                    label: '📋 Trade-offs',
                    body: 'Higher throughput comes at the cost of decentralisation — fewer validators (~2,000 vs Ethereum\'s ~1M). Notable network outages have occurred (2021, 2022). Hardware requirements for validators are high, raising centralisation concerns.',
                },
            ],
        },

        impermanentloss: {
            title: 'Impermanent Loss Explained',
            icon: '📉',
            tags: ['impermanent loss', 'il', 'liquidity provider', 'lp', 'amm loss', 'pool loss'],
            summary: 'Impermanent Loss (IL) occurs when you provide liquidity to an AMM pool and the price of your deposited tokens changes relative to when you deposited. You end up with less value than if you had just held the tokens.',
            sections: [
                {
                    label: '📐 How IL Happens',
                    body: 'When you deposit ETH + USDC into a 50/50 pool at $2,000 ETH, the AMM auto-rebalances as prices move. If ETH rises to $4,000, arbitrageurs buy cheap ETH from your pool, leaving you with less ETH and more USDC — giving you less than if you\'d just held.<br><br>The "loss" is impermanent because if prices return to entry levels, it disappears.',
                },
                {
                    label: '📊 IL Magnitude',
                    body: '• 1.25x price change → 0.6% IL<br>• 1.5x price change → 2% IL<br>• 2x price change → 5.7% IL<br>• 5x price change → 25% IL<br><br>Trading fee revenue often offsets IL — especially in high-volume, stable pairs.',
                },
                {
                    label: '🛡️ Minimising IL',
                    body: 'Deposit correlated pairs (ETH/stETH), stable pairs (USDC/DAI), or use concentrated liquidity (Uniswap V3) to earn more fees with less capital at risk. Always calculate expected IL before providing liquidity.',
                },
            ],
        },

        'gas fees': {
            title: 'Gas Fees — How They Work',
            icon: '⛽',
            tags: ['gas', 'gas fees', 'gas price', 'gwei', 'base fee', 'priority fee', 'eip-1559', 'gas limit', 'out of gas'],
            summary: 'Gas is the unit measuring the computation required for operations on EVM chains. Gas fees are paid in ETH (or the chain\'s native token) and compensate validators for computation and security.',
            sections: [
                {
                    label: '⚙️ EIP-1559 Fee Structure',
                    body: 'Since August 2021, Ethereum uses a two-part fee:<br>• <b>Base fee</b>: Set by the network, BURNED (removed from supply)<br>• <b>Priority fee</b> (tip): Goes to validators for inclusion priority<br><br>Total fee = (Base fee + Priority fee) × Gas used',
                },
                {
                    label: '💡 Reducing Gas Costs',
                    body: '• Use L2s (Arbitrum, Base, Optimism) — 10-100x cheaper<br>• Transact during low-activity periods (weekends, late night UTC)<br>• Use DeFi protocols that batch operations<br>• Monitor gas at gasnow.org, ethgasstation.info',
                },
            ],
        },

        web3jobs: {
            title: 'Getting a Web3 Job',
            icon: '💼',
            tags: ['web3 job', 'web3 jobs', 'get job web3', 'web3 career', 'web3 developer', 'solidity developer', 'blockchain job', 'crypto job'],
            summary: 'Web3 careers are one of the fastest growing in tech. Key roles include Solidity developers, ZK engineers, DevRel, DAO contributors, and more.',
            sections: [
                {
                    label: '🔧 Most In-Demand Skills',
                    body: '• <b>Solidity</b> — Ethereum smart contract development (highest paid)<br>• <b>Rust</b> — Solana programs, ZK circuits<br>• <b>TypeScript + ethers.js / viem</b> — Frontend/backend Web3 integration<br>• <b>Cairo / Circom</b> — ZK circuit languages<br>• <b>Solana Programs</b> — Anchor framework<br>• <b>DevRel</b> — Developer relations, docs, community',
                },
                {
                    label: '🚀 How to Get Hired',
                    body: '1. Deploy contracts — a live dApp on mainnet or testnet beats any resume<br>2. Win hackathons — ETHGlobal, Solana Breakpoint actively recruit winners<br>3. Contribute to open-source — audit a protocol, write docs<br>4. Join DAOs — BanklessDAO, Developer DAO open doors<br>5. Build in public — share your learning on X/Twitter',
                },
            ],
        },

    };

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 2 — SMART INTENT RESOLVER
    // Priority: exact topic > keyword match > glossary term > partial > fallback
    // ══════════════════════════════════════════════════════════════════════════

    function normaliseQuery(q) {
        // Strip common filler before matching
        return q.toLowerCase()
            .replace(/what is|what are|explain|tell me about|how does|how do|define|describe|give me info on|talk about|i want to know about|can you explain/gi, '')
            .replace(/[?!.,]/g, '')
            .trim();
    }

    function scoreQuery(cleanQ, tags) {
        let score = 0;
        for (const tag of tags) {
            if (cleanQ === tag) { score += 100; break; } // Exact full match
            if (cleanQ.includes(tag)) score += tag.split(' ').length * 15; // Phrase match
            if (tag.includes(cleanQ) && cleanQ.length > 2) score += 10; // Partial
        }
        return score;
    }

    function getAnswer(rawQuery) {
        const cleanQ = normaliseQuery(rawQuery);
        const knowledge = window.STORE && window.STORE.knowledge ? window.STORE.knowledge : {};
        const glossary = window.STORE && window.STORE.glossary ? window.STORE.glossary : [];

        // ── Priority 1: Score all inline KNOWLEDGE entries ─────────────────────
        // For short queries (1-3 words), a low score is fine — they're asking "what is X"
        // For longer questions (4+ words), require exact match — they need a specific answer from AI
        const wordCount = cleanQ.split(/\s+/).length;
        const scoreThreshold = wordCount <= 3 ? 10 : 80;

        let bestScore = 0;
        let bestEntry = null;
        for (const entry of Object.values(KNOWLEDGE)) {
            const s = scoreQuery(cleanQ, entry.tags);
            if (s > bestScore) { bestScore = s; bestEntry = entry; }
        }
        if (bestEntry && bestScore >= scoreThreshold) {
            return buildRichAnswer(bestEntry);
        }

        // For longer questions, skip local matching and let Groq AI handle it
        if (wordCount <= 3) {
            // ── Priority 2: Store knowledge base (store.js topics) ─────────────
            for (const [, topic] of Object.entries(knowledge)) {
                const topicKey = topic.title.toLowerCase();
                if (cleanQ.includes('defi') && topicKey.includes('defi')) return buildStoreTopicAnswer(topic);
                if ((cleanQ.includes('nft') || cleanQ.includes('non-fungible')) && topicKey.includes('nft')) return buildStoreTopicAnswer(topic);
                if ((cleanQ.includes('layer 2') || cleanQ.includes('l2') || cleanQ.includes('rollup')) && topicKey.includes('layer')) return buildStoreTopicAnswer(topic);
                if (cleanQ.includes('dao') && topicKey.includes('dao')) return buildStoreTopicAnswer(topic);
                if ((cleanQ.includes('wallet') || cleanQ.includes('seed') || cleanQ.includes('private key') || cleanQ.includes('metamask')) && topicKey.includes('wallet')) return buildStoreTopicAnswer(topic);
                if ((cleanQ.includes('block') && !cleanQ.includes('blockchain is')) && topicKey.includes('blockchain') && cleanQ.length < 15) return buildStoreTopicAnswer(topic);
            }

            // ── Priority 3: Glossary exact + phrase match ──────────────────────
            let best = null;
            let bestGScore = 0;
            for (const term of glossary) {
                const tl = term.term.toLowerCase();
                let gs = 0;
                if (cleanQ === tl) gs = 100;
                else if (cleanQ.includes(tl)) gs = tl.split(' ').length * 20;
                else if (tl.includes(cleanQ) && cleanQ.length > 3) gs = 10;
                if (gs > bestGScore) { bestGScore = gs; best = term; }
            }
            if (best && bestGScore >= 10) return buildGlossaryAnswer(best);
        }

        // Priority 4 removed — Groq AI now handles anything not matched above

        // ── Priority 5: Return null — caller will use AI API ────────────────
        return null;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3 — RESPONSE BUILDERS
    // ══════════════════════════════════════════════════════════════════════════

    function buildRichAnswer(entry) {
        // Randomize opener
        const openerFn = randomFrom(OPENER_PHRASES);
        let html = `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem">
      <span style="font-size:1.5rem">${entry.icon}</span>
      <strong style="font-size:1.05rem;color:var(--text-primary)">${entry.title}</strong>
    </div>`;
        html += `<p style="color:var(--text-secondary);margin-bottom:0.5rem;font-size:0.88rem">${openerFn(entry.title)}</p>`;
        html += `<p style="color:var(--text-secondary);margin-bottom:1rem">${entry.summary}</p>`;

        // Shuffle sections and pick a random subset (2-3)
        const numSections = Math.min(entry.sections.length, 2 + Math.floor(Math.random() * 2));
        const selectedSections = pickRandom(entry.sections, numSections);

        // Vary section styling
        const borderColors = ['rgba(139,92,246,0.5)', 'rgba(34,211,238,0.4)', 'rgba(52,211,153,0.4)', 'rgba(244,114,182,0.4)'];
        selectedSections.forEach((section, i) => {
            const borderColor = borderColors[i % borderColors.length];
            html += `<div style="margin-bottom:0.9rem;padding:0.75rem;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid ${borderColor}">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:0.4rem;color:var(--cyan-1)">${section.label}</div>
        <div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.65">${section.body}</div>
      </div>`;
        });

        // Add a random Did-you-know fact
        const fact = randomFrom(DID_YOU_KNOW);
        html += `<div style="margin-top:0.5rem;padding:0.6rem 0.85rem;background:rgba(251,191,36,0.06);border-radius:8px;border:1px solid rgba(251,191,36,0.15);font-size:0.82rem;color:var(--text-secondary)">
      🧠 <strong style="color:var(--yellow-1)">Did you know?</strong> ${fact}
    </div>`;

        // Vary the footer CTA
        const footerCtas = [
            '💡 Want to go deeper? <a href="learn.html" style="color:var(--purple-1)">Browse Glossary →</a> or ask a follow-up question below.',
            '🔍 Explore more: <a href="learn.html" style="color:var(--purple-1)">100+ terms in the glossary →</a>',
            '📚 Keep learning: <a href="learn.html" style="color:var(--purple-1)">Search the full glossary →</a> or ask another question.',
            '🚀 Want the full picture? <a href="learn.html" style="color:var(--purple-1)">Dive into the glossary →</a>',
        ];
        html += `<div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted)">
      ${randomFrom(footerCtas)}
    </div>`;
        return html;
    }

    function buildStoreTopicAnswer(topic) {
        let html = `<strong style="font-size:1.05rem;color:var(--text-primary)">${topic.title}</strong><br><br>`;
        html += `<p style="color:var(--text-secondary)">${topic.summary}</p><br>`;
        html += `<strong style="color:var(--cyan-1)">Key Points:</strong>
      <ul style="margin-top:0.5rem;padding-left:1.2rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.3rem">`;
        topic.keyPoints.forEach(p => { html += `<li>${p}</li>`; });
        html += `</ul>`;
        if (topic.protocols) {
            html += `<br><strong style="color:var(--purple-1)">Notable Protocols:</strong>
        <span style="color:var(--text-secondary)"> ${topic.protocols.join(', ')}</span>`;
        }
        return html;
    }

    function buildGlossaryAnswer(term) {
        const colorMap = { DeFi: 'purple', NFT: 'pink', Infrastructure: 'cyan', 'Layer 2': 'green', DAO: 'yellow', Wallet: 'cyan' };
        const color = colorMap[term.cat] || 'purple';
        // Pick a random template for variety
        const tmplFn = randomFrom(GLOSSARY_TEMPLATES);
        const relatedStr = shuffleArray(term.related).join(' · ');
        return tmplFn(term.term, color, term.def, term.example, relatedStr);
    }

    function buildSmartFallback(rawQuery, cleanQ) {
        // Suggest topics most likely related to query words
        const queryWords = cleanQ.split(/\s+/).filter(w => w.length > 2);
        const suggestions = Object.values(KNOWLEDGE)
            .filter(e => queryWords.some(w => e.tags.some(t => t.includes(w))))
            .slice(0, 3)
            .map(e => `<button class="chip suggestion-chip" data-q="${e.title}" style="margin:0.25rem">${e.icon} ${e.title}</button>`)
            .join('');

        return `<div style="margin-bottom:0.75rem">
      <strong style="color:var(--text-primary)">Hmm, I want to make sure I give you the best answer for "<em>${rawQuery}</em>".</strong>
    </div>
    <p style="color:var(--text-secondary)">I have deep knowledge on these Web3 areas — did you mean one of these?</p>
    <div style="margin:0.75rem 0;display:flex;flex-wrap:wrap;gap:0.4rem">
      <button class="chip suggestion-chip" data-q="What is Web3?">🌐 Web3 Overview</button>
      <button class="chip suggestion-chip" data-q="DeFi — Decentralised Finance">⚡ DeFi</button>
      <button class="chip suggestion-chip" data-q="NFTs — Non-Fungible Tokens">🎨 NFTs</button>
      <button class="chip suggestion-chip" data-q="Layer 2 Scaling Solutions">🔷 Layer 2</button>
      <button class="chip suggestion-chip" data-q="DAOs — Decentralised Autonomous Organisations">🏛️ DAOs</button>
      <button class="chip suggestion-chip" data-q="Blockchain Fundamentals">⛓️ Blockchain</button>
      ${suggestions}
    </div>
    <p style="font-size:0.82rem;color:var(--text-muted)">Or browse <a href="learn.html" style="color:var(--purple-1)">100+ glossary terms →</a></p>`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4 — CHAT UI
    // ══════════════════════════════════════════════════════════════════════════

    function appendMessage(content, role = 'ai') {
        const msg = document.createElement('div');
        msg.className = `ai-message ${role === 'user' ? 'user-message' : ''}`;
        msg.style.flexDirection = role === 'user' ? 'row-reverse' : 'row';
        msg.innerHTML = `
      <div class="ai-avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="ai-bubble">${content}</div>`;
        chatBody.appendChild(msg);
        chatBody.scrollTop = chatBody.scrollHeight;

        // Bind any new suggestion chips rendered inside AI bubbles
        msg.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chatInput.value = chip.dataset.q;
                sendMessage();
            });
        });
        return msg;
    }

    function showTyping() {
        const msg = document.createElement('div');
        msg.className = 'ai-message';
        msg.id = 'typing-indicator';
        msg.innerHTML = `<div class="ai-avatar">🤖</div>
      <div class="ai-bubble ai-typing"><span></span><span></span><span></span></div>`;
        chatBody.appendChild(msg);
        chatBody.scrollTop = chatBody.scrollHeight;
        return msg;
    }

    // ── Call Groq AI via worker ────────────────────────────────────────────
    async function callAI(message) {
        try {
            const resp = await fetch(`${WORKER_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history: conversationHistory.slice(-6) }),
            });
            const data = await resp.json();
            if (data.success && data.reply) {
                return data.reply;
            }
            return data.reply || data.error || 'I couldn\'t generate a response. Please try again.';
        } catch (err) {
            console.error('[ChainMind AI] Error:', err);
            return 'I\'m having trouble connecting to the AI service. Please try again in a moment.';
        }
    }

    async function sendMessage() {
        const q = chatInput.value.trim();
        if (!q) return;
        chatInput.value = '';
        sendBtn.disabled = true;
        appendMessage(q, 'user');
        conversationHistory.push({ role: 'user', content: q });

        if (!searchHistory.includes(q)) {
            searchHistory.unshift(q);
            if (searchHistory.length > 8) searchHistory.pop();
            localStorage.setItem('w3ai_history', JSON.stringify(searchHistory));
            renderHistory();
        }

        const typing = showTyping();

        // Try local knowledge first (instant)
        const localAnswer = getAnswer(q);
        if (localAnswer) {
            const delay = 600 + Math.min(q.length * 8, 800);
            await new Promise(r => setTimeout(r, delay));
            typing.remove();
            appendMessage(localAnswer, 'ai');
            conversationHistory.push({ role: 'assistant', content: localAnswer });
        } else {
            // Call Groq AI for everything else
            const aiReply = await callAI(q);
            typing.remove();
            const formattedReply = `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                <span style="font-size:1.2rem">✨</span>
                <strong style="color:var(--cyan-1);font-size:0.85rem">Powered by ChainMind AI</strong>
            </div>` + markdownToHtml(aiReply);
            appendMessage(formattedReply, 'ai');
            conversationHistory.push({ role: 'assistant', content: aiReply });
        }

        sendBtn.disabled = false;
        // Keep conversation history manageable
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-12);
        }
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

    // ── Suggestion chips ──────────────────────────────────────────────────────
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.q;
            sendMessage();
        });
    });

    // ── History ───────────────────────────────────────────────────────────────
    function renderHistory() {
        if (!historyEl) return;
        historyEl.innerHTML = searchHistory.length
            ? searchHistory.map(h =>
                `<button class="chip history-chip" style="text-align:left;white-space:nowrap;overflow:hidden;max-width:220px;text-overflow:ellipsis"
            data-q="${h.replace(/"/g, '&quot;')}">${h}</button>`
            ).join('')
            : '<span style="color:var(--text-muted);font-size:0.82rem">No history yet</span>';

        historyEl.querySelectorAll('.history-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                chatInput.value = btn.dataset.q;
                sendMessage();
            });
        });
    }
})();
