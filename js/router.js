// ─── Shared Router & Nav Helpers ─────────────────────────────────────────────

(function () {
    // Highlight active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'app.html';
    document.querySelectorAll('.navbar-links a, .mobile-menu a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'app.html')) {
            link.classList.add('active');
        }
    });

    // Hamburger toggle
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-menu a').forEach(a => {
        a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });

    // Navbar scroll shadow
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 4px 32px rgba(0,0,0,0.4)' : '';
    });
})();

// ─── Global Toast System ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3300);
}

// ─── Animate count-up for stats ───────────────────────────────────────────────
function animateCountUp(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const step = target / 60;
    const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current).toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
    }, 16);
}

// Observer for count-up animation
const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            animateCountUp(e.target);
            countObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => countObserver.observe(el));
