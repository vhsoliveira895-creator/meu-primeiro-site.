(function () {
    const bgVideo = document.getElementById('bgVideo');
    const progressBar = document.getElementById('progressBar');
    const percentDisplay = document.getElementById('videoPercent');
    const videoError = document.getElementById('videoError');
    const contactForm = document.querySelector('.contact-form');

    function setErrorVisible(visible, message) {
        if (!videoError) return;
        videoError.style.display = visible ? 'block' : 'none';
        if (message) videoError.textContent = message;
    }

    if (bgVideo && progressBar && percentDisplay) {
        bgVideo.addEventListener('loadedmetadata', function () {
            percentDisplay.textContent = 'Video OK';
            setErrorVisible(false);
        });

        bgVideo.addEventListener('timeupdate', function () {
            const duration = bgVideo.duration;
            if (!Number.isFinite(duration) || duration <= 0) return;
            const percent = (bgVideo.currentTime / duration) * 100;
            progressBar.style.width = percent + '%';
            percentDisplay.textContent = Math.round(percent) + '%';
        });

        bgVideo.addEventListener('error', function () {
            setErrorVisible(true, 'Video não carregou — usando o fundo estático');
            percentDisplay.textContent = '—';
        });

        const playPromise = bgVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(function () {
                percentDisplay.textContent = 'Toque para reproduzir';
            });
        }
    }

    if (contactForm) {
        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const button = contactForm.querySelector('button[type="submit"]');
            if (button) {
                button.textContent = 'Mensagem registrada';
                button.disabled = true;
            }
        });
    }
})();
