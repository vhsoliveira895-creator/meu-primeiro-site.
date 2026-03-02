        // Video background progress
        const bgVideo = document.getElementById('bgVideo');
        const progressBar = document.getElementById('progressBar');
        const percentDisplay = document.getElementById('videoPercent');
        const videoError = document.getElementById('videoError');

        bgVideo.addEventListener('loadedmetadata', function() {
            console.log('✓ Video carregou! Duração:', bgVideo.duration);
            percentDisplay.textContent = 'Video OK';
        });

        bgVideo.addEventListener('timeupdate', function() {
            const percent = (bgVideo.currentTime / bgVideo.duration) * 100;
            progressBar.style.width = percent + '%';
            percentDisplay.textContent = Math.round(percent) + '%';
        });

        bgVideo.addEventListener('error', function(e) {
            console.error('✗ Erro no vídeo:', bgVideo.error);
            videoError.style.display = 'block';
            videoError.textContent = 'Video não carregou - usando fallback';
        });

        // Force play
        bgVideo.play().then(() => {
            console.log('✓ Video tocando');
        }).catch(e => {
            console.log('✗ Auto-play bloqueado:', e.message);
        });