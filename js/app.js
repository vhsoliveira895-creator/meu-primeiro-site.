const PHRASES = [
  "Inform\u00e1tica de laborat\u00f3rio.",
  "Reparo. Manuten\u00e7\u00e3o. Precis\u00e3o.",
  "GPU. Placa-m\u00e3e. Fonte.",
  "ZA-TECH. Fortaleza."
];

const TICKER = [
  "Bancada ESD pronta.",
  "GPU em teste de carga.",
  "Notebook em limpeza t\u00e9rmica.",
  "Fonte em bancada isolada.",
  "Laudo fotogr\u00e1fico na etapa cr\u00edtica."
];

const TOASTS = [
  "Chamado novo: diagn\u00f3stico de placa-m\u00e3e.",
  "Manuten\u00e7\u00e3o preventiva liberada.",
  "Cliente no WhatsApp (85) 99988-6993."
];

function typewriter(el) {
  if (!el) return;
  let p = 0;
  let i = 0;
  let del = false;
  function tick() {
    if (document.body.classList.contains("zara-open")) {
      setTimeout(tick, 400);
      return;
    }
    const t = PHRASES[p];
    if (!del) {
      i += 1;
      el.textContent = t.slice(0, i);
      if (i === t.length) {
        del = true;
        setTimeout(tick, 1700);
        return;
      }
      setTimeout(tick, 48);
      return;
    }
    i -= 1;
    el.textContent = t.slice(0, i);
    if (i === 0) {
      del = false;
      p = (p + 1) % PHRASES.length;
      setTimeout(tick, 260);
      return;
    }
    setTimeout(tick, 26);
  }
  tick();
}

function heroPhotos() {
  const imgs = Array.from(document.querySelectorAll(".hero-bg img"));
  if (imgs.length < 2) return;
  let n = 0;
  setInterval(function () {
    imgs[n].classList.remove("is-live");
    n = (n + 1) % imgs.length;
    imgs[n].classList.add("is-live");
  }, 5600);
}

function ticker() {
  const el = document.getElementById("tickerMsg");
  if (!el) return;
  let n = 0;
  setInterval(function () {
    el.style.opacity = "0";
    setTimeout(function () {
      n = (n + 1) % TICKER.length;
      el.textContent = TICKER[n];
      el.style.opacity = "1";
    }, 280);
  }, 3400);
}

function toasts() {
  const box = document.getElementById("toast");
  if (!box) return;
  let n = 0;
  function show() {
    if (document.body.classList.contains("zara-open")) return;
    box.hidden = false;
    box.textContent = TOASTS[n];
    setTimeout(function () {
      box.hidden = true;
      n = (n + 1) % TOASTS.length;
    }, 4200);
  }
  setTimeout(show, 1800);
  setInterval(show, 9000);
}

function tabs() {
  const buttons = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-tab");
      buttons.forEach(function (b) {
        b.classList.toggle("on", b === btn);
      });
      panels.forEach(function (p) {
        const on = p.getAttribute("data-panel") === id;
        p.classList.toggle("on", on);
        p.hidden = !on;
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  typewriter(document.getElementById("typeLine"));
  heroPhotos();
  ticker();
  toasts();
  tabs();
  document.getElementById("toTop").addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
