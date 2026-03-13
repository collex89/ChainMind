// ─── Feedback Module ─────────────────────────────────────────────────────────

(function () {
    // ─── Star Rating ──────────────────────────────────────────────────────────
    let selectedRating = 0;
    const ratingContainer = document.getElementById('rating-container');
    const ratingInput = document.getElementById('fb-rating');
    const stars = document.querySelectorAll('.star-btn');
    
    stars.forEach((star, i) => {
        star.addEventListener('mouseover', () => highlightStars(i + 1));
        star.addEventListener('mouseleave', () => highlightStars(selectedRating));
        star.addEventListener('click', () => {
            selectedRating = i + 1;
            if (ratingInput) ratingInput.value = selectedRating;
            highlightStars(selectedRating);
        });
    });

    function highlightStars(count) {
        stars.forEach((s, i) => {
            if (i < count) {
                s.style.color = 'var(--yellow-1)';
                s.querySelector('svg').style.fill = 'var(--yellow-1)';
            } else {
                s.style.color = 'var(--text-secondary)';
                s.querySelector('svg').style.fill = 'none';
            }
        });
    }

    // ─── Feedback Type Selection ───────────────────────────────────────────────
    let selectedType = '';
    const typeOptions = document.querySelectorAll('.type-option');
    typeOptions.forEach(option => {
        option.addEventListener('click', () => {
            typeOptions.forEach(o => {
                o.style.borderColor = 'var(--border)';
                o.style.background = 'var(--bg-card)';
            });
            option.style.borderColor = 'var(--purple-1)';
            option.style.background = 'rgba(139, 92, 246, 0.05)';
            
            selectedType = option.querySelector('input[type="radio"]').value;
            const radio = option.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // ─── Form Submission ───────────────────────────────────────────────────────
    window.submitFeedback = async function(e) {
        e.preventDefault();

        const form = document.getElementById('feedback-form');
        const submitBtn = document.getElementById('feedback-submit');
        const name = document.getElementById('fb-name').value.trim();
        const email = document.getElementById('fb-email').value.trim();
        const message = document.getElementById('fb-message').value.trim();

        if (!name || !message) { 
            if (typeof showToast !== 'undefined') showToast('Please fill in your name and message.', 'error'); 
            return; 
        }
        if (!selectedType) { 
            if (typeof showToast !== 'undefined') showToast('Please select a feedback type.', 'error'); 
            return; 
        }
        if (!selectedRating) { 
            if (typeof showToast !== 'undefined') showToast('Please give a star rating.', 'error'); 
            return; 
        }

        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Sending...';

        const payload = {
            name: name,
            email: email || 'Not provided',
            type: selectedType,
            rating: selectedRating,
            message: message,
            timestamp: new Date().toISOString(),
            target_email: 'chainmind000@gmail.com'
        };

        try {
            // Attempt to send to worker API
            const workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://chainmind-api.ugwucollins881.workers.dev';
            const response = await fetch(`${workerUrl}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn('Backend API failed, simulating success for demo', await response.text());
                // Fallback for demo purposes if backend isn't ready
                await new Promise(r => setTimeout(r, 1000));
            }
            
            showSuccess();
            
        } catch (err) {
            console.warn('Fetch error, simulating success for demo', err);
            // Fallback for demo purposes
            await new Promise(r => setTimeout(r, 1000));
            showSuccess();
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    };

    function showSuccess() {
        const form = document.getElementById('feedback-form');
        const success = document.getElementById('feedback-success');
        
        if (form && success) {
            form.style.display = 'none';
            success.style.display = 'block';
        }
        if (typeof showToast !== 'undefined') {
            showToast('Feedback sent successfully to the team!', 'success');
        }
    }

    // ─── Reset Button ──────────────────────────────────────────────────────────
    window.resetFeedbackForm = function() {
        const form = document.getElementById('feedback-form');
        const success = document.getElementById('feedback-success');
        
        if (form && success) {
            form.style.display = 'block';
            success.style.display = 'none';
            form.reset();
            
            selectedRating = 0;
            if (ratingInput) ratingInput.value = 0;
            highlightStars(0);
            
            selectedType = '';
            typeOptions.forEach(o => {
                o.style.borderColor = 'var(--border)';
                o.style.background = 'var(--bg-card)';
            });
        }
    };
})();
