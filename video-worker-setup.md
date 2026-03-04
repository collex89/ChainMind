# ChainMind Video API — Cloudflare Worker Setup

This guide shows you how to deploy a secure API proxy for the video generation feature. The proxy keeps your Replicate API token server-side (never exposed to users).

## Step 1: Get a Replicate API Token

1. Go to [replicate.com](https://replicate.com) and sign up (free)
2. Navigate to **Account Settings → API Tokens**
3. Create a new token and copy it

## Step 2: Deploy the Cloudflare Worker

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and sign up (free, 100K req/day)
2. Click **Create a Worker**
3. Replace the default code with the script below
4. Click **Save and Deploy**
5. Note your Worker URL (e.g., `https://chainmind-video.your-worker.workers.dev`)

## Step 3: Add Your Secrets

1. In the Worker settings, go to **Settings → Variables**
2. Add **two** encrypted Environment Variables:

| Variable Name | Value | Notes |
|---|---|---|
| `REPLICATE_TOKEN` | Your Replicate API token | Starts with `r8_...` |
| `JWT_SECRET` | Any random 32+ character string | e.g. `my-super-secret-key-chainmind-2026-xyz` |

> [!IMPORTANT]
> The `JWT_SECRET` is used to sign subscription tokens. Keep it secret and never change it, or all existing subscribers will lose access.

## Step 4: Connect to ChainMind

Open `js/video.js` and paste your Worker URL on line 11:

```javascript
const WORKER_URL = 'https://chainmind-video.your-worker.workers.dev';
```

---

## Cloudflare Worker Code

Copy and paste this entire script into your Cloudflare Worker:

```javascript
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
    const replicateHeaders = {
      'Authorization': `Bearer ${env.REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'respond-async',
    };

    // ── Configuration ─────────────────────────────────────────────────────
    const MERCHANT_WALLET = '3rzeYXaztAasbc6RthzGwJ9TqhpUYBgiYBBFGHZMmVd6';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const SUBSCRIPTION_PRICE = 10_000_000; // 10 USDC (6 decimals)
    const SUBSCRIPTION_DAYS = 30;
    const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

    try {
      // ══════════════════════════════════════════════════════════════════════
      // POST /rpc-proxy — Proxy Solana RPC calls (avoids CORS/rate-limit)
      // ══════════════════════════════════════════════════════════════════════
      if (url.pathname === '/rpc-proxy' && request.method === 'POST') {
        const body = await request.text();
        const rpcResp = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const rpcData = await rpcResp.text();
        return new Response(rpcData, { headers: jsonHeaders });
      }

      // ══════════════════════════════════════════════════════════════════════
      // POST /verify-payment — Verify on-chain USDC payment & issue JWT
      // ══════════════════════════════════════════════════════════════════════
      if (url.pathname === '/verify-payment' && request.method === 'POST') {
        const { txSignature, walletAddress } = await request.json();

        if (!txSignature || !walletAddress) {
          return new Response(JSON.stringify({ error: 'Missing txSignature or walletAddress' }), {
            status: 400, headers: jsonHeaders,
          });
        }

        // 1. Fetch transaction from Solana RPC
        const rpcResp = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTransaction',
            params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
          }),
        });
        const rpcData = await rpcResp.json();

        if (!rpcData.result) {
          return new Response(JSON.stringify({ error: 'Transaction not found on Solana. It may still be processing — try again in 30 seconds.' }), {
            status: 404, headers: jsonHeaders,
          });
        }

        const tx = rpcData.result;

        // 2. Check transaction was successful
        if (tx.meta && tx.meta.err !== null) {
          return new Response(JSON.stringify({ error: 'Transaction failed on-chain.' }), {
            status: 400, headers: jsonHeaders,
          });
        }

        // 3. Verify USDC transfer to merchant
        const instructions = tx.transaction?.message?.instructions || [];
        const innerInstructions = tx.meta?.innerInstructions || [];
        const allInstructions = [
          ...instructions,
          ...innerInstructions.flatMap(ii => ii.instructions || []),
        ];

        let verified = false;
        for (const ix of allInstructions) {
          const parsed = ix.parsed;
          if (!parsed) continue;

          // Check for SPL token transfer/transferChecked
          if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
            const info = parsed.info;
            const amount = parseInt(info.amount || info.tokenAmount?.amount || '0');
            const dest = info.destination;

            // Verify: correct amount and destination matches merchant ATA
            if (amount >= SUBSCRIPTION_PRICE) {
              // We need to check the destination is the merchant's USDC ATA
              // Fetch the destination token account owner
              const ownerResp = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0', id: 2,
                  method: 'getAccountInfo',
                  params: [dest, { encoding: 'jsonParsed' }],
                }),
              });
              const ownerData = await ownerResp.json();
              const parsedAcct = ownerData.result?.value?.data?.parsed?.info;

              if (parsedAcct &&
                  parsedAcct.owner === MERCHANT_WALLET &&
                  parsedAcct.mint === USDC_MINT) {
                verified = true;
                break;
              }
            }
          }
        }

        if (!verified) {
          return new Response(JSON.stringify({ error: 'Payment not verified. The transaction does not contain a valid 10 USDC transfer to the merchant.' }), {
            status: 400, headers: jsonHeaders,
          });
        }

        // 4. Payment verified! Issue JWT
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + (SUBSCRIPTION_DAYS * 24 * 60 * 60);
        const payload = {
          sub: walletAddress,
          tx: txSignature,
          iat: now,
          exp: expiresAt,
          plan: 'pro',
        };

        const token = await signJWT(payload, env.JWT_SECRET);

        return new Response(JSON.stringify({
          success: true,
          token,
          expiresAt: expiresAt * 1000, // ms for JS Date
          daysRemaining: SUBSCRIPTION_DAYS,
          walletAddress,
          txSignature,
        }), { headers: jsonHeaders });
      }

      // ══════════════════════════════════════════════════════════════════════
      // POST /validate-token — Verify JWT hasn't expired or been tampered
      // ══════════════════════════════════════════════════════════════════════
      if (url.pathname === '/validate-token' && request.method === 'POST') {
        const { token } = await request.json();

        if (!token) {
          return new Response(JSON.stringify({ valid: false, error: 'No token provided' }), {
            status: 400, headers: jsonHeaders,
          });
        }

        try {
          const payload = await verifyJWT(token, env.JWT_SECRET);
          const now = Math.floor(Date.now() / 1000);
          const daysRemaining = Math.max(0, Math.ceil((payload.exp - now) / 86400));

          return new Response(JSON.stringify({
            valid: true,
            walletAddress: payload.sub,
            plan: payload.plan,
            daysRemaining,
            expiresAt: payload.exp * 1000,
          }), { headers: jsonHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ valid: false, error: err.message }), {
            headers: jsonHeaders,
          });
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // POST /generate — Start video generation (Replicate)
      // ══════════════════════════════════════════════════════════════════════
      if (url.pathname === '/generate' && request.method === 'POST') {
        const body = await request.json();
        const { mode, prompt, image } = body;

        let apiUrl, reqBody;
        if (mode === 'image-to-video') {
          apiUrl = 'https://api.replicate.com/v1/predictions';
          reqBody = {
            version: '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438',
            input: { input_image: image, motion_bucket_id: 40, fps: 7 },
          };
        } else {
          apiUrl = 'https://api.replicate.com/v1/models/minimax/video-01/predictions';
          reqBody = { input: { prompt } };
        }

        const resp = await fetch(apiUrl, {
          method: 'POST', headers: replicateHeaders,
          body: JSON.stringify(reqBody),
        });
        const data = await resp.json();

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: data.detail || data.title || 'API error', status: resp.status }), {
            status: resp.status, headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ id: data.id, status: data.status }), { headers: jsonHeaders });
      }

      // GET /status/:id — Check video generation status
      if (url.pathname.startsWith('/status/')) {
        const id = url.pathname.split('/status/')[1];
        const resp = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
          headers: { 'Authorization': `Bearer ${env.REPLICATE_TOKEN}` },
        });
        const data = await resp.json();
        return new Response(JSON.stringify({
          status: data.status, output: data.output, error: data.error,
        }), { headers: jsonHeaders });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: jsonHeaders,
      });
    }
  },
};

// ── JWT Helpers (HMAC-SHA256, no dependencies) ────────────────────────────
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sigB64}`;
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const enc = new TextEncoder();
  const data = `${parts[0]}.${parts[1]}`;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  // Decode signature
  const sigStr = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const sigBytes = Uint8Array.from(atob(sigStr), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));

  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(atob(parts[1]));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}
```

## Testing

1. Deploy the Worker
2. Open ChainMind Video Studio
3. Enter a prompt and click **Generate Video**
4. The video should generate in ~30-60 seconds

> **Note:** Without the Worker URL configured, ChainMind Video Studio runs in **demo mode** — it simulates generation and shows sample videos so you can test the UI.
