const PHRASES = [
  "Inform\u00e1tica de laborat\u00f3rio.",
  "Reparo. Manuten\u00e7\u00e3o. Precis\u00e3o.",
  "Reballing. Multimetro. Precisao.",
  "ZA-TECH. Fortaleza."
];

const TICKER = [
  "Diagnostico com o dono na bancada.",
  "Onde o equipamento estiver, o dono esta junto.",
  "Reballing de GPU na lupa.",
  "Reballing de modulos de memoria.",
  "Afericao com multimetro.",
  "Agende uma consulta com o tecnico.",
  "Pre-atendimento com a Zara."
];

const TOASTS = [
  "Diagnostico na frente do cliente.",
  "Agende uma consulta: (85) 99988-6993.",
  "Comece o pre-atendimento com a Zara."
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
  ticker();
  toasts();
  tabs();
  document.querySelectorAll("[data-open-zara]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (typeof window.ZA_ABRIR_ZARA === "function") window.ZA_ABRIR_ZARA();
    });
  });
  document.getElementById("toTop").addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
