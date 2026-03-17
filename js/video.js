// ─── AI Video Studio Module ─────────────────────────────────────────────────
// Handles text-to-video and image-to-video generation via Replicate API
// proxied through Cloudflare Worker for security.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    // ═══════════════════════════════════════════════════════════════════════════
    // ██  PASTE YOUR CLOUDFLARE WORKER URL HERE  ██
    // ══════════════════════════════════════════════════════════════════════════ 
    const WORKER_URL = 'https://chainmind-video.ugwucollins881.workers.dev';
    // ═══════════════════════════════════════════════════════════════════════════

    const MAX_FREE_TRIALS = 3;
    const TRIAL_KEY = 'cm_video_trials';
    const GALLERY_KEY = 'cm_video_gallery';

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const tabs = document.querySelectorAll('.studio-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const trialBadge = document.getElementById('trial-badge');
    const trialText = document.getElementById('trial-text');
    const genTextBtn = document.getElementById('gen-text-btn');
    const genImageBtn = document.getElementById('gen-image-btn');
    const textPrompt = document.getElementById('text-prompt');
    const motionPrompt = document.getElementById('motion-prompt');
    const uploadZone = document.getElementById('upload-zone');
    const imageUpload = document.getElementById('image-upload');
    const uploadPreview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const styleOptions = document.querySelectorAll('.style-option');
    const progressEl = document.getElementById('gen-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');
    const progressStage = document.getElementById('progress-stage');
    const progressPct = document.getElementById('progress-pct');
    const resultEl = document.getElementById('video-result');
    const resultVideo = document.getElementById('result-video');
    const downloadBtn = document.getElementById('download-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const paywallOverlay = document.getElementById('paywall-overlay');
    const closePaywall = document.getElementById('close-paywall');
    const subscribeBtn = document.getElementById('subscribe-btn');
    const galleryEl = document.getElementById('video-gallery');

    let selectedStyle = 'cinematic';
    let uploadedImageData = null;
    let lastPrompt = '';
    let lastMode = 'text';

    // ── Trial management ─────────────────────────────────────────────────────
    function getTrialsUsed() {
        return parseInt(localStorage.getItem(TRIAL_KEY) || '0');
    }

    function setTrialsUsed(n) {
        localStorage.setItem(TRIAL_KEY, String(n));
    }

    function isSubscribed() {
        // Check Thread Writer PRO subscription
        if (window.TweetPremium && window.TweetPremium.Subscription) {
            return window.TweetPremium.Subscription.isActive();
        }
        return localStorage.getItem('cm_pro_active') === 'true';
    }

    function canGenerate() {
        return isSubscribed() || getTrialsUsed() < MAX_FREE_TRIALS;
    }

    function consumeTrial() {
        if (!isSubscribed()) {
            setTrialsUsed(getTrialsUsed() + 1);
        }
    }

    function updateTrialBadge() {
        const used = getTrialsUsed();
        const remaining = MAX_FREE_TRIALS - used;

        if (isSubscribed()) {
            trialBadge.className = 'trial-badge paid';
            trialText.textContent = 'PRO · Unlimited generations';
        } else if (remaining > 0) {
            trialBadge.className = 'trial-badge free';
            trialText.textContent = `${remaining} free generation${remaining !== 1 ? 's' : ''} remaining`;
        } else {
            trialBadge.className = 'trial-badge exhausted';
            trialText.textContent = '0 free generations · Subscribe to continue';
        }
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // ── Style selector ───────────────────────────────────────────────────────
    styleOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            styleOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedStyle = opt.dataset.style;
        });
    });

    // ── Image upload ─────────────────────────────────────────────────────────
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleImageFile(file);
        });
    }

    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            if (e.target.files[0]) handleImageFile(e.target.files[0]);
        });
    }

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file (PNG, JPG, WebP)', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image too large. Max 10MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageData = e.target.result;
            previewImg.src = uploadedImageData;
            uploadPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // ── Progress simulation ──────────────────────────────────────────────────
    function showProgress() {
        progressEl.style.display = 'block';
        resultEl.style.display = 'none';
        let pct = 0;
        const stages = [
            'Initializing model...',
            'Processing prompt...',
            'Generating frames...',
            'Rendering video...',
            'Applying style filters...',
            'Finalizing output...',
        ];

        const interval = setInterval(() => {
            if (pct >= 95) {
                clearInterval(interval);
                return;
            }
            pct += Math.random() * 8 + 2;
            pct = Math.min(pct, 95);
            progressFill.style.width = `${pct}%`;
            progressPct.textContent = `${Math.round(pct)}%`;
            const stageIdx = Math.floor((pct / 100) * stages.length);
            progressStage.textContent = stages[Math.min(stageIdx, stages.length - 1)];
        }, 800);

        return {
            complete: () => {
                clearInterval(interval);
                progressFill.style.width = '100%';
                progressPct.textContent = '100%';
                progressStage.textContent = 'Complete!';
                setTimeout(() => {
                    progressEl.style.display = 'none';
                }, 500);
            },
            fail: () => {
                clearInterval(interval);
                progressStage.textContent = 'Generation failed';
                progressFill.style.background = '#ef4444';
            }
        };
    }

    // ── API calls ────────────────────────────────────────────────────────────
    async function generateTextToVideo(prompt, style) {
        if (!WORKER_URL) {
            // Demo mode — simulate generation
            return simulateGeneration(prompt);
        }

        const resp = await fetch(`${WORKER_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'text-to-video',
                prompt: `${prompt}, ${style} style`,
            }),
        });

        if (!resp.ok) throw new Error(`API error: ${resp.status}`);
        const data = await resp.json();
        return pollForResult(data.id);
    }

    async function generateImageToVideo(imageData, motionPromptText) {
        if (!WORKER_URL) {
            return simulateGeneration(motionPromptText || 'image animation');
        }

        const resp = await fetch(`${WORKER_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'image-to-video',
                image: imageData,
                prompt: motionPromptText || 'gentle camera motion',
            }),
        });

        if (!resp.ok) throw new Error(`API error: ${resp.status}`);
        const data = await resp.json();
        return pollForResult(data.id);
    }

    async function pollForResult(predictionId) {
        // Poll every 3s for up to 5 minutes
        const maxAttempts = 100;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const resp = await fetch(`${WORKER_URL}/status/${predictionId}`);
            const data = await resp.json();
            console.log(`[NexuBrain Video] Poll ${i + 1}/${maxAttempts}: ${data.status}`);

            if (data.status === 'succeeded') {
                // Replicate output can be a string URL or an array of URLs
                const output = data.output;
                if (Array.isArray(output)) return output[0];
                return output;
            }
            if (data.status === 'failed') {
                throw new Error(data.error || 'Generation failed');
            }
        }
        throw new Error('Generation timed out');
    }

    // ── Demo simulation (when no Worker URL configured) ─────────────────────
    function simulateGeneration(prompt) {
        return new Promise((resolve) => {
            // Simulate 5-8 second generation time
            const delay = 5000 + Math.random() * 3000;
            setTimeout(() => {
                // Return a demo video URL (Web3-themed stock video)
                const demoVideos = [
                    'https://cdn.pixabay.com/video/2024/03/06/203034-920698236_large.mp4',
                    'https://cdn.pixabay.com/video/2023/10/28/186922-879448538_large.mp4',
                    'https://cdn.pixabay.com/video/2021/04/04/69992-533625877_large.mp4',
                ];
                resolve(demoVideos[Math.floor(Math.random() * demoVideos.length)]);
            }, delay);
        });
    }

    // ── Generate handler ─────────────────────────────────────────────────────
    async function handleGenerate(mode) {
        if (!canGenerate()) {
            paywallOverlay.classList.add('open');
            return;
        }

        let prompt = '';
        lastMode = mode;

        if (mode === 'text') {
            prompt = textPrompt ? textPrompt.value.trim() : '';
            if (!prompt) {
                showToast('Please enter a video description!', 'error');
                return;
            }
            lastPrompt = prompt;
        } else {
            if (!uploadedImageData) {
                showToast('Please upload an image first!', 'error');
                return;
            }
        }

        // Disable buttons
        if (genTextBtn) genTextBtn.disabled = true;
        if (genImageBtn) genImageBtn.disabled = true;

        const progress = showProgress();

        try {
            let videoUrl;
            if (mode === 'text') {
                videoUrl = await generateTextToVideo(prompt, selectedStyle);
            } else {
                videoUrl = await generateImageToVideo(uploadedImageData, motionPrompt ? motionPrompt.value.trim() : '');
            }

            progress.complete();
            consumeTrial();
            updateTrialBadge();

            // Show result
            setTimeout(() => {
                resultEl.style.display = 'block';
                resultVideo.src = videoUrl;
                resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 600);

            // Wire download button via worker proxy (bypasses CORS)
            if (downloadBtn) {
                downloadBtn.onclick = async (e) => {
                    e.preventDefault();
                    downloadBtn.textContent = '⏳ Downloading...';
                    downloadBtn.disabled = true;
                    try {
                        const proxyUrl = `${WORKER_URL}/download?url=${encodeURIComponent(videoUrl)}`;
                        const resp = await fetch(proxyUrl);
                        if (!resp.ok) throw new Error('Download failed');
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = 'nexubrain_video.mp4';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        downloadBtn.textContent = '⬇️ Download';
                    } catch (err) {
                        window.open(videoUrl, '_blank');
                        downloadBtn.textContent = '⬇️ Download';
                    }
                    downloadBtn.disabled = false;
                };
            }

            // Save to gallery
            saveToGallery(prompt || 'Image animation', videoUrl);

            showToast('🎬 Video generated successfully!', 'success');
        } catch (err) {
            progress.fail();
            showToast(`Generation failed: ${err.message}`, 'error');
        } finally {
            if (genTextBtn) genTextBtn.disabled = false;
            if (genImageBtn) genImageBtn.disabled = false;
        }
    }

    if (genTextBtn) genTextBtn.addEventListener('click', () => handleGenerate('text'));
    if (genImageBtn) genImageBtn.addEventListener('click', () => handleGenerate('image'));

    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            handleGenerate(lastMode);
        });
    }

    // ── Paywall ──────────────────────────────────────────────────────────────
    if (closePaywall) {
        closePaywall.addEventListener('click', () => {
            paywallOverlay.classList.remove('open');
        });
    }

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            // Trigger card payment flow
            if (window.TweetPremium && window.TweetPremium.payWithCard) {
                window.TweetPremium.payWithCard().then(() => {
                    showToast('NexuBrain PRO activated! 🎉', 'success');
                    setTimeout(() => location.reload(), 1500);
                }).catch(err => {
                    showToast(err.message || 'Payment failed.', 'error');
                });
            } else {
                // Fallback — redirect to Thread Writer for payment
                showToast('Redirecting to subscription page...', 'info');
                setTimeout(() => {
                    window.location.href = 'tweet.html';
                }, 1200);
            }
        });
    }

    // ── Gallery ──────────────────────────────────────────────────────────────
    function getGallery() {
        try {
            return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
        } catch { return []; }
    }

    function saveToGallery(label, url) {
        const gallery = getGallery();
        gallery.unshift({
            label: label.substring(0, 40),
            url,
            date: new Date().toLocaleDateString(),
        });
        if (gallery.length > 8) gallery.pop();
        localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
        renderGallery();
    }

    function renderGallery() {
        if (!galleryEl) return;
        const gallery = getGallery();
        if (!gallery.length) {
            galleryEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem">No videos generated yet. Create your first one!</p>';
            return;
        }
        galleryEl.innerHTML = `<div class="gallery-grid">${gallery.map(v => `
            <div class="gallery-item" onclick="document.getElementById('result-video').src='${v.url}';document.getElementById('video-result').style.display='block';document.getElementById('download-btn').href='${v.url}'">
                <video src="${v.url}" muted preload="metadata"></video>
                <div class="gallery-label">${v.label}</div>
            </div>
        `).join('')}</div>`;
    }

    // ── Toast ────────────────────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
        if (window.showToast) { window.showToast(msg, type); return; }
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    updateTrialBadge();
    renderGallery();
})();
