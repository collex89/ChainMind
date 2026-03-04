// ─── ChainMind Auth Module ───────────────────────────────────────────────────
// Handles: User signup, login, session management, and auth UI (modal + navbar)
// ──────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    const WORKER_URL = 'https://chainmind-video.ugwucollins881.workers.dev';
    const AUTH_KEY = 'chainmind_auth';

    // ═══════════════════════════════════════════════════════════════════════════
    //  SESSION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    const Auth = {
        getSession() {
            try { return JSON.parse(localStorage.getItem(AUTH_KEY)); }
            catch { return null; }
        },

        isLoggedIn() {
            const session = this.getSession();
            return !!(session && session.token);
        },

        getToken() {
            const session = this.getSession();
            return session?.token || null;
        },

        getUser() {
            const session = this.getSession();
            return session?.user || null;
        },

        saveSession(token, user) {
            localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
        },

        logout() {
            localStorage.removeItem(AUTH_KEY);
            window.location.reload();
        },

        // ─── API Calls ───────────────────────────────────────────────────────

        async signup(email, password, name) {
            const resp = await fetch(`${WORKER_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Signup failed.');
            this.saveSession(data.token, data.user);
            return data;
        },

        async login(email, password) {
            const resp = await fetch(`${WORKER_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Login failed.');
            this.saveSession(data.token, data.user);
            return data;
        },

        async refreshProfile() {
            const token = this.getToken();
            if (!token) return null;
            try {
                const resp = await fetch(`${WORKER_URL}/auth/me`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });
                const data = await resp.json();
                if (data.success) {
                    const session = this.getSession();
                    session.user = data.user;
                    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
                    return data.user;
                }
            } catch (e) {
                console.warn('[Auth] Profile refresh failed:', e.message);
            }
            return null;
        },

        // Get auth header for API calls
        authHeaders() {
            const token = this.getToken();
            if (!token) return {};
            return { 'Authorization': `Bearer ${token}` };
        },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    //  AUTH MODAL UI
    // ═══════════════════════════════════════════════════════════════════════════

    function createAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-backdrop"></div>
            <div class="auth-card">
                <div class="auth-header">
                    <div class="auth-logo">
                        <img src="assets/chainmind_logo.png" alt="ChainMind" style="width:36px;height:36px;border-radius:10px">
                        <span>ChainMind</span>
                    </div>
                    <p class="auth-subtitle">Sign in to save your progress and unlock all features</p>
                </div>

                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Log In</button>
                    <button class="auth-tab" data-tab="signup">Sign Up</button>
                </div>

                <form id="auth-login-form" class="auth-form">
                    <div class="auth-field">
                        <label for="auth-login-email">Email</label>
                        <input type="email" id="auth-login-email" class="input" placeholder="you@example.com" required>
                    </div>
                    <div class="auth-field">
                        <label for="auth-login-password">Password</label>
                        <input type="password" id="auth-login-password" class="input" placeholder="Your password" required>
                    </div>
                    <button type="submit" class="btn btn-primary auth-submit">Log In →</button>
                    <div id="auth-login-error" class="auth-error"></div>
                </form>

                <form id="auth-signup-form" class="auth-form" style="display:none">
                    <div class="auth-field">
                        <label for="auth-signup-name">Name</label>
                        <input type="text" id="auth-signup-name" class="input" placeholder="Your name" required>
                    </div>
                    <div class="auth-field">
                        <label for="auth-signup-email">Email</label>
                        <input type="email" id="auth-signup-email" class="input" placeholder="you@example.com" required>
                    </div>
                    <div class="auth-field">
                        <label for="auth-signup-password">Password</label>
                        <input type="password" id="auth-signup-password" class="input" placeholder="Min 6 characters" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary auth-submit">Create Account →</button>
                    <div id="auth-signup-error" class="auth-error"></div>
                </form>

                <div class="auth-footer">
                    <span>🔒 Secure · No spam · Your data is safe</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        injectAuthStyles();
        wireAuthModal(modal);
    }

    function wireAuthModal(modal) {
        // Tab switching
        const tabs = modal.querySelectorAll('.auth-tab');
        const loginForm = modal.querySelector('#auth-login-form');
        const signupForm = modal.querySelector('#auth-signup-form');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'login') {
                    loginForm.style.display = 'block';
                    signupForm.style.display = 'none';
                } else {
                    loginForm.style.display = 'none';
                    signupForm.style.display = 'block';
                }
            });
        });

        // Login form
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('.auth-submit');
            const errEl = modal.querySelector('#auth-login-error');
            const email = modal.querySelector('#auth-login-email').value;
            const password = modal.querySelector('#auth-login-password').value;

            btn.disabled = true;
            btn.textContent = '⏳ Logging in...';
            errEl.textContent = '';

            try {
                await Auth.login(email, password);
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.style.display = 'none';
                    updateNavbar();
                    if (window.showToast) showToast('Welcome back! 👋', 'success');
                }, 300);
            } catch (err) {
                errEl.textContent = err.message;
                btn.disabled = false;
                btn.textContent = 'Log In →';
            }
        });

        // Signup form
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = signupForm.querySelector('.auth-submit');
            const errEl = modal.querySelector('#auth-signup-error');
            const name = modal.querySelector('#auth-signup-name').value;
            const email = modal.querySelector('#auth-signup-email').value;
            const password = modal.querySelector('#auth-signup-password').value;

            btn.disabled = true;
            btn.textContent = '⏳ Creating account...';
            errEl.textContent = '';

            try {
                await Auth.signup(email, password, name);
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.style.display = 'none';
                    updateNavbar();
                    if (window.showToast) showToast('Account created! Welcome to ChainMind 🎉', 'success');
                }, 300);
            } catch (err) {
                errEl.textContent = err.message;
                btn.disabled = false;
                btn.textContent = 'Create Account →';
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  NAVBAR USER DISPLAY
    // ═══════════════════════════════════════════════════════════════════════════

    function updateNavbar() {
        const ctaArea = document.querySelector('.navbar-cta');
        if (!ctaArea) return;

        // Remove any existing user display
        const existing = ctaArea.querySelector('.nav-user');
        if (existing) existing.remove();

        if (Auth.isLoggedIn()) {
            const user = Auth.getUser();

            // Hide the "Ask AI" button to make room
            const askBtn = ctaArea.querySelector('.btn-primary');
            if (askBtn) askBtn.style.display = 'none';

            const userEl = document.createElement('div');
            userEl.className = 'nav-user';
            const initial = (user?.name || user?.email || 'U')[0].toUpperCase();
            const planLabel = user?.plan === 'pro' ? 'PRO' : 'FREE';
            const planClass = user?.plan === 'pro' ? 'pro' : 'free';

            userEl.innerHTML = `
                <div class="nav-user-avatar">${initial}</div>
                <span class="nav-plan-badge ${planClass}">${planLabel}</span>
                <button class="nav-logout-btn" title="Log out">✕</button>
            `;
            ctaArea.insertBefore(userEl, ctaArea.firstChild);

            userEl.querySelector('.nav-logout-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Log out of ChainMind?')) Auth.logout();
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    function injectAuthStyles() {
        if (document.getElementById('auth-styles')) return;
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = `
            #auth-modal {
                position: fixed; inset: 0; z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                transition: opacity 0.3s;
            }
            .auth-backdrop {
                position: absolute; inset: 0;
                background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
            }
            .auth-card {
                position: relative; z-index: 1;
                background: var(--bg-card, #1a1a2e); border: 1px solid var(--border, rgba(255,255,255,0.08));
                border-radius: 16px; padding: 2rem; width: 100%; max-width: 420px;
                box-shadow: 0 24px 48px rgba(0,0,0,0.4);
                animation: authSlideUp 0.35s ease;
            }
            @keyframes authSlideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .auth-header { text-align: center; margin-bottom: 1.5rem; }
            .auth-logo {
                display: flex; align-items: center; justify-content: center; gap: 0.6rem;
                font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;
            }
            .auth-subtitle { font-size: 0.85rem; color: var(--text-muted, #888); }
            .auth-tabs {
                display: flex; gap: 0; margin-bottom: 1.5rem;
                border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 10px;
                overflow: hidden;
            }
            .auth-tab {
                flex: 1; padding: 0.65rem; font-size: 0.85rem; font-weight: 600;
                background: transparent; border: none; color: var(--text-muted, #888);
                cursor: pointer; transition: all 0.2s;
            }
            .auth-tab.active {
                background: var(--grad-primary, linear-gradient(135deg,#7c3aed,#06b6d4));
                color: #fff;
            }
            .auth-field { margin-bottom: 1rem; }
            .auth-field label {
                display: block; font-size: 0.8rem; font-weight: 600;
                margin-bottom: 0.35rem; color: var(--text-secondary, #aaa);
            }
            .auth-submit {
                width: 100%; justify-content: center; margin-top: 0.5rem;
                padding: 0.75rem !important; font-size: 0.95rem !important;
            }
            .auth-error {
                margin-top: 0.75rem; font-size: 0.82rem; color: #ef4444;
                text-align: center; min-height: 1.2em;
            }
            .auth-footer {
                margin-top: 1.25rem; text-align: center;
                font-size: 0.75rem; color: var(--text-muted, #666);
            }

            /* Navbar user display — compact */
            .nav-user {
                display: flex; align-items: center; gap: 0.4rem;
            }
            .nav-user-avatar {
                width: 32px; height: 32px; border-radius: 50%;
                background: linear-gradient(135deg,#7c3aed,#06b6d4);
                display: flex; align-items: center; justify-content: center;
                font-size: 0.8rem; font-weight: 700; color: #fff;
                flex-shrink: 0;
            }
            .nav-plan-badge {
                font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.05em; padding: 2px 7px; border-radius: 4px;
            }
            .nav-plan-badge.pro { background: linear-gradient(135deg,#7c3aed,#06b6d4); color: #fff; }
            .nav-plan-badge.free { background: rgba(255,255,255,0.1); color: var(--text-muted, #888); }
            .nav-logout-btn {
                background: none; border: none; color: var(--text-muted, #888);
                cursor: pointer; font-size: 0.75rem; padding: 0.2rem;
                opacity: 0.5; transition: opacity 0.2s;
            }
            .nav-logout-btn:hover { opacity: 1; color: #ef4444; }

            @media (max-width: 768px) {
                .auth-card { margin: 1rem; padding: 1.5rem; }
                .nav-plan-badge { display: none; }
            }
        `;
        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════════════════

    function init() {
        if (Auth.isLoggedIn()) {
            updateNavbar();
            // Silently refresh profile in background
            Auth.refreshProfile().then(() => updateNavbar());
        } else {
            createAuthModal();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose globally
    window.ChainMindAuth = Auth;

})();
