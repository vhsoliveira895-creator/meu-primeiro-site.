const bgVideo = document.getElementById("bgVideo");
const progressBar = document.getElementById("progressBar");
const percentDisplay = document.getElementById("videoPercent");

if (bgVideo) {
  bgVideo.addEventListener("loadedmetadata", function () {
    percentDisplay.textContent = "0%";
  });

  bgVideo.addEventListener("timeupdate", function () {
    if (!bgVideo.duration) return;
    const percent = (bgVideo.currentTime / bgVideo.duration) * 100;
    progressBar.style.width = percent + "%";
    percentDisplay.textContent = Math.round(percent) + "%";
  });

  bgVideo.addEventListener("error", function () {
    if (percentDisplay) percentDisplay.textContent = "—";
  });

  bgVideo.play().catch(function () {
    // Autoplay pode ser bloqueado; o usuário ainda vê o restante da página.
  });
}

document.querySelectorAll(".btn-buy").forEach(function (btn) {
  btn.addEventListener("click", function () {
    window.alert("Projeto de portfólio: a compra ainda não está ligada a um backend.");
  });
});

const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

if (contactForm) {
  contactForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (formStatus) {
      formStatus.hidden = false;
      formStatus.textContent = "Mensagem registrada neste projeto de demonstração. Sem envio real.";
    }
    contactForm.reset();
  });
}
