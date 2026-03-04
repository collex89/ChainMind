// ─── Feedback Module (EmailJS) ────────────────────────────────────────────────
// EmailJS Setup Instructions:
// 1. Go to https://www.emailjs.com and create a free account
// 2. Add an Email Service (Gmail recommended) → copy the Service ID
// 3. Create an Email Template with variables: {{from_name}}, {{from_email}}, {{feedback_type}}, {{rating}}, {{message}}, {{timestamp}}
// 4. Go to Account → API Keys → copy your Public Key
// 5. Replace the placeholders below with your actual IDs

(function () {
    const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';   // ← Replace with your EmailJS public key
    const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';   // ← Replace with your EmailJS service ID
    const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // ← Replace with your EmailJS template ID

    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // ─── Star Rating ──────────────────────────────────────────────────────────
    let selectedRating = 0;
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((star, i) => {
        star.addEventListener('mouseover', () => highlightStars(i + 1));
        star.addEventListener('mouseleave', () => highlightStars(selectedRating));
        star.addEventListener('click', () => {
            selectedRating = i + 1;
            highlightStars(selectedRating);
        });
    });

    function highlightStars(count) {
        stars.forEach((s, i) => {
            s.classList.toggle('active', i < count);
        });
    }

    // ─── Feedback Type Selection ───────────────────────────────────────────────
    let selectedType = '';
    document.querySelectorAll('.type-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedType = option.querySelector('.type-label').textContent;
            const radio = option.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // ─── Form Submission ───────────────────────────────────────────────────────
    const form = document.getElementById('feedback-form');
    const submitBtn = document.getElementById('feedback-submit');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('fb-name').value.trim();
            const email = document.getElementById('fb-email').value.trim();
            const message = document.getElementById('fb-message').value.trim();

            if (!name || !message) { showToast('Please fill in your name and message.', 'error'); return; }
            if (!selectedType) { showToast('Please select a feedback type.', 'error'); return; }
            if (!selectedRating) { showToast('Please give a star rating.', 'error'); return; }

            const Stars = '⭐'.repeat(selectedRating);

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            const templateParams = {
                from_name: name,
                from_email: email || 'Not provided',
                feedback_type: selectedType,
                rating: `${selectedRating}/5 ${Stars}`,
                message: message,
                timestamp: new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }),
                to_email: 'ugwucollins881@gmail.com'
            };

            try {
                if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
                    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
                    showSuccess();
                } else {
                    // Demo mode: simulate sending when not configured
                    await new Promise(r => setTimeout(r, 1500));
                    showSuccess(true);
                }
            } catch (err) {
                console.error('EmailJS error:', err);
                showToast('Failed to send. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Feedback';
            }
        });
    }

    function showSuccess(demo = false) {
        form.style.display = 'none';
        const success = document.getElementById('feedback-success');
        if (success) success.style.display = 'block';
        if (demo) showToast('Demo mode: EmailJS not configured yet.', 'info');
        else showToast('Feedback sent to ugwucollins881@gmail.com!', 'success');
    }

    // Reset button
    const resetBtn = document.getElementById('feedback-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            form.style.display = 'block';
            document.getElementById('feedback-success').style.display = 'none';
            form.reset();
            selectedRating = 0;
            selectedType = '';
            highlightStars(0);
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
        });
    }
})();
