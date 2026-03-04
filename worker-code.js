export default {
    async fetch(request, env) {
        // Alias D1 binding (matches your Cloudflare binding name)
        env.DB = env['chainmind-binding'] || env.DB;

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

        // Replicate API headers (for video generation)
        const replicateHeaders = {
            'Authorization': `Bearer ${env.REPLICATE_TOKEN}`,
            'Content-Type': 'application/json',
            'Prefer': 'respond-async',
        };

        // ── Helper: hash password with SHA-256 (native in Workers) ──────────
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + (env.PASSWORD_SALT || 'chainmind_salt_2026'));
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // ── Helper: generate session token ──────────────────────────────────
        function generateToken(userId, email) {
            const payload = {
                uid: userId,
                email: email,
                iat: Date.now(),
                exp: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
            };
            return btoa(JSON.stringify(payload));
        }

        // ── Helper: verify session token ────────────────────────────────────
        function verifyToken(token) {
            try {
                const payload = JSON.parse(atob(token));
                if (!payload.exp || Date.now() >= payload.exp) return null;
                return payload;
            } catch {
                return null;
            }
        }

        // ── Helper: get user from Authorization header ──────────────────────
        function getAuthToken(request) {
            const auth = request.headers.get('Authorization');
            if (auth && auth.startsWith('Bearer ')) {
                return auth.slice(7);
            }
            return null;
        }

        try {
            // ════════════════════════════════════════════════════════════════════
            // POST /auth/signup — Create a new account
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/auth/signup' && request.method === 'POST') {
                const { email, password, name } = await request.json();

                if (!email || !password) {
                    return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }
                if (password.length < 6) {
                    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                // Check if email already exists
                const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
                if (existing) {
                    return new Response(JSON.stringify({ error: 'An account with this email already exists. Please log in.' }), {
                        status: 409, headers: jsonHeaders,
                    });
                }

                const passwordHash = await hashPassword(password);
                const now = Date.now();

                const result = await env.DB.prepare(
                    'INSERT INTO users (email, password_hash, name, plan, plan_expires_at, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(email.toLowerCase().trim(), passwordHash, name || 'Anonymous', 'free', 0, now, now).run();

                const userId = result.meta.last_row_id;
                const token = generateToken(userId, email.toLowerCase().trim());

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    user: {
                        id: userId,
                        email: email.toLowerCase().trim(),
                        name: name || 'Anonymous',
                        plan: 'free',
                        planExpiresAt: 0,
                    },
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /auth/login — Log in with email + password
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/auth/login' && request.method === 'POST') {
                const { email, password } = await request.json();

                if (!email || !password) {
                    return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
                if (!user) {
                    return new Response(JSON.stringify({ error: 'No account found with this email.' }), {
                        status: 401, headers: jsonHeaders,
                    });
                }

                const passwordHash = await hashPassword(password);
                if (passwordHash !== user.password_hash) {
                    return new Response(JSON.stringify({ error: 'Incorrect password.' }), {
                        status: 401, headers: jsonHeaders,
                    });
                }

                // Update last login
                await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Date.now(), user.id).run();

                // Check if plan expired
                let plan = user.plan;
                if (plan === 'pro' && user.plan_expires_at && Date.now() >= user.plan_expires_at) {
                    plan = 'free';
                    await env.DB.prepare('UPDATE users SET plan = ? WHERE id = ?').bind('free', user.id).run();
                }

                const token = generateToken(user.id, user.email);

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        plan: plan,
                        planExpiresAt: user.plan_expires_at,
                    },
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /auth/me — Get current user profile
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/auth/me' && request.method === 'POST') {
                const token = getAuthToken(request);
                const payload = token ? verifyToken(token) : null;

                if (!payload) {
                    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
                        status: 401, headers: jsonHeaders,
                    });
                }

                const user = await env.DB.prepare('SELECT id, email, name, plan, plan_expires_at, created_at FROM users WHERE id = ?').bind(payload.uid).first();
                if (!user) {
                    return new Response(JSON.stringify({ error: 'User not found.' }), {
                        status: 404, headers: jsonHeaders,
                    });
                }

                // Check if plan expired
                let plan = user.plan;
                if (plan === 'pro' && user.plan_expires_at && Date.now() >= user.plan_expires_at) {
                    plan = 'free';
                    await env.DB.prepare('UPDATE users SET plan = ? WHERE id = ?').bind('free', user.id).run();
                }

                return new Response(JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        plan: plan,
                        planExpiresAt: user.plan_expires_at,
                        createdAt: user.created_at,
                    },
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /verify-payment — Verify Paystack card payment & upgrade user
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/verify-payment' && request.method === 'POST') {
                const { reference } = await request.json();
                if (!reference) {
                    return new Response(JSON.stringify({ error: 'Missing payment reference' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                // Verify with Paystack API
                const paystackResp = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                    headers: { 'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}` },
                });
                const paystackData = await paystackResp.json();

                if (!paystackData.status || paystackData.data.status !== 'success') {
                    return new Response(JSON.stringify({
                        error: 'Payment not verified. Transaction was not successful.',
                        success: false,
                    }), { status: 400, headers: jsonHeaders });
                }

                // Payment verified!
                const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
                const customerEmail = paystackData.data.customer?.email || '';

                // Update user plan in DB if authenticated
                const token = getAuthToken(request);
                const payload = token ? verifyToken(token) : null;
                if (payload) {
                    await env.DB.prepare(
                        'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?'
                    ).bind('pro', expiresAt, payload.uid).run();
                }

                // Generate subscription token
                const tokenPayload = {
                    ref: reference,
                    email: customerEmail,
                    exp: expiresAt,
                    iat: Date.now(),
                };
                const subToken = btoa(JSON.stringify(tokenPayload));

                return new Response(JSON.stringify({
                    success: true,
                    token: subToken,
                    expiresAt,
                    email: customerEmail,
                    txReference: reference,
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /validate-token — Validate subscription token
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/validate-token' && request.method === 'POST') {
                const { token } = await request.json();
                if (!token) {
                    return new Response(JSON.stringify({ valid: false, error: 'No token provided' }), {
                        headers: jsonHeaders,
                    });
                }

                try {
                    const payload = JSON.parse(atob(token));
                    if (!payload.exp || Date.now() >= payload.exp) {
                        return new Response(JSON.stringify({ valid: false, error: 'Token expired' }), {
                            headers: jsonHeaders,
                        });
                    }
                    return new Response(JSON.stringify({ valid: true }), { headers: jsonHeaders });
                } catch {
                    return new Response(JSON.stringify({ valid: false, error: 'Invalid token' }), {
                        headers: jsonHeaders,
                    });
                }
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /restore-subscription — Restore PRO access by email
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/restore-subscription' && request.method === 'POST') {
                const { email } = await request.json();
                if (!email) {
                    return new Response(JSON.stringify({ success: false, error: 'Please provide your email address.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                const paystackResp = await fetch(
                    `https://api.paystack.co/transaction?customer=${encodeURIComponent(email)}&status=success&perPage=10`,
                    { headers: { 'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}` } }
                );
                const paystackData = await paystackResp.json();

                if (!paystackData.status || !paystackData.data || paystackData.data.length === 0) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'No payment found for this email. Please check the email you used during payment.',
                    }), { status: 404, headers: jsonHeaders });
                }

                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const validPayment = paystackData.data.find(tx => {
                    const txDate = new Date(tx.paid_at || tx.created_at).getTime();
                    return txDate >= thirtyDaysAgo && tx.status === 'success';
                });

                if (!validPayment) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Your subscription has expired. Please subscribe again.',
                    }), { status: 404, headers: jsonHeaders });
                }

                const paidAt = new Date(validPayment.paid_at || validPayment.created_at).getTime();
                const expiresAt = paidAt + (30 * 24 * 60 * 60 * 1000);

                if (Date.now() >= expiresAt) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Your subscription has expired. Please subscribe again.',
                    }), { status: 404, headers: jsonHeaders });
                }

                // Also update user in DB if they have an account
                const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
                if (user) {
                    await env.DB.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').bind('pro', expiresAt, user.id).run();
                }

                const tokenPayload = { ref: validPayment.reference, email, exp: expiresAt, iat: Date.now() };
                const token = btoa(JSON.stringify(tokenPayload));

                return new Response(JSON.stringify({
                    success: true, token, expiresAt, email, txReference: validPayment.reference,
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /training/save — Save training submission
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/training/save' && request.method === 'POST') {
                const token = getAuthToken(request);
                const payload = token ? verifyToken(token) : null;

                if (!payload) {
                    return new Response(JSON.stringify({ error: 'Please log in to submit training data.' }), {
                        status: 401, headers: jsonHeaders,
                    });
                }

                const { term, definition, category, difficulty } = await request.json();
                if (!term || !definition) {
                    return new Response(JSON.stringify({ error: 'Term and definition are required.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                const result = await env.DB.prepare(
                    'INSERT INTO training (user_id, term, definition, category, difficulty, votes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(payload.uid, term, definition, category || '', difficulty || '', 0, Date.now()).run();

                return new Response(JSON.stringify({
                    success: true, id: result.meta.last_row_id,
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // GET /training/feed — Get community training feed
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/training/feed' && request.method === 'GET') {
                const limit = parseInt(url.searchParams.get('limit') || '50');
                const rows = await env.DB.prepare(
                    `SELECT t.id, t.term, t.definition, t.category, t.difficulty, t.votes, t.created_at,
                            u.name as author, u.email as author_email
                     FROM training t JOIN users u ON t.user_id = u.id
                     ORDER BY t.created_at DESC LIMIT ?`
                ).bind(limit).all();

                return new Response(JSON.stringify({
                    success: true, submissions: rows.results || [],
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /training/vote — Vote on a training submission
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/training/vote' && request.method === 'POST') {
                const token = getAuthToken(request);
                const payload = token ? verifyToken(token) : null;
                if (!payload) {
                    return new Response(JSON.stringify({ error: 'Please log in to vote.' }), {
                        status: 401, headers: jsonHeaders,
                    });
                }

                const { submissionId } = await request.json();
                if (!submissionId) {
                    return new Response(JSON.stringify({ error: 'Missing submission ID.' }), {
                        status: 400, headers: jsonHeaders,
                    });
                }

                await env.DB.prepare('UPDATE training SET votes = votes + 1 WHERE id = ?').bind(submissionId).run();

                return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // GET /admin/users — List all users (protected)
            // ════════════════════════════════════════════════════════════════════
            if (url.pathname === '/admin/users' && request.method === 'GET') {
                const key = url.searchParams.get('key');
                if (key !== env.ADMIN_KEY) {
                    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                        status: 403, headers: jsonHeaders,
                    });
                }

                const rows = await env.DB.prepare(
                    'SELECT id, email, name, plan, plan_expires_at, created_at, last_login FROM users ORDER BY created_at DESC'
                ).all();

                return new Response(JSON.stringify({
                    success: true,
                    total: rows.results?.length || 0,
                    users: rows.results || [],
                }), { headers: jsonHeaders });
            }

            // ════════════════════════════════════════════════════════════════════
            // POST /generate — Start a video prediction (Replicate)
            // ════════════════════════════════════════════════════════════════════
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
                    method: 'POST',
                    headers: replicateHeaders,
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

            // GET /status/:id — Check prediction status
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
