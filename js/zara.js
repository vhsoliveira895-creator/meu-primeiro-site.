(function () {
  var DELAY_MS = 12000;
  var MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  var WA = "https://wa.me/5585999886993?text=" + encodeURIComponent("Ola, ZA-TECH. Falei com a Zara no site e quero continuar o atendimento.");
  var HIST_KEY = "zaZaraHistorico";
  var SESSION_KEY = "zaZaraSessao";

  var state = {
    step: "askName",
    nome: "",
    messages: [],
    busy: false
  };

  function key() {
    return (window.ZA_GEMINI_API_KEY || "").trim();
  }

  function saudacao() {
    var h = Number(
      new Intl.DateTimeFormat("pt-BR", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Fortaleza"
      }).format(new Date())
    );
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  }

  function loadHist() {
    try {
      var raw = localStorage.getItem(HIST_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(-12) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHist(entry) {
    var list = loadHist();
    list.push(entry);
    localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(-40)));
  }

  function systemPrompt() {
    var hist = loadHist();
    var casos = hist.length
      ? hist
          .map(function (c, i) {
            return (
              (i + 1) +
              ". Cliente " +
              (c.nome || "sem nome") +
              ": " +
              (c.resumo || "")
            );
          })
          .join("\n")
      : "Nenhum caso anterior neste aparelho.";

    return (
      "Voce e Zara, atendente da ZA-TECH, laboratorio de informatica em Fortaleza. " +
      "Seja cordial, educada e objetiva. Fale em portugues do Brasil, frases curtas. " +
      "Trate o cliente pelo primeiro nome quando souber. " +
      "Faca pre-diagnostico: notebook, desktop, GPU, placa-mae e fonte. " +
      "Pergunte sintomas, quando comecou, se molhou, se caiu, se liga, se tem imagem, barulho, cheiro de queimado. " +
      "Nao invente preco, prazo nem garantia. Nao diga que o conserto e certo. " +
      "Deixe claro que e pre-diagnostico e o tecnico confirma na bancada. " +
      "Quando fizer sentido, convide para o WhatsApp (85) 99988-6993. " +
      "Use os casos anteriores so como referencia, sem expor dados de outros clientes.\n\n" +
      "Cliente atual: " +
      (state.nome || "ainda nao informado") +
      ".\nCasos anteriores neste aparelho:\n" +
      casos
    );
  }

  function el(id) {
    return document.getElementById(id);
  }

  function bubble(who, text) {
    var log = el("zaraLog");
    if (!log) return null;
    var row = document.createElement("div");
    row.className = "zara-row " + who;
    var p = document.createElement("p");
    p.textContent = text;
    row.appendChild(p);
    var typing = el("zaraTyping");
    if (typing) log.insertBefore(row, typing);
    else log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function setTyping(on) {
    var typing = el("zaraTyping");
    var log = el("zaraLog");
    if (!typing) return;
    typing.hidden = !on;
    if (log) log.scrollTop = log.scrollHeight;
  }

  function typeZara(text, done) {
    setTyping(true);
    setTimeout(function () {
      setTyping(false);
      bubble("zara", text);
      if (done) done();
    }, 420);
  }

  function setOpen(open) {
    var win = el("zaraWin");
    var launch = el("zaraLaunch");
    if (!win || !launch) return;
    win.hidden = !open;
    launch.hidden = open;
    document.body.classList.toggle("zara-open", open);
    var toast = el("toast");
    if (open && toast) toast.hidden = true;
    if (open) {
      if (state.step === "askName" && !el("zaraLog").querySelector(".zara-row")) greet();
      var input = el("zaraInput");
      if (input) input.focus();
    }
  }

  function greet() {
    var s = saudacao();
    var text =
      s +
      ". Eu sou a Zara, da ZA-TECH. Prazer em te atender. Como posso te chamar?";
    typeZara(text);
    state.messages.push({ role: "model", parts: [{ text: text }] });
  }

  function looksYes(t) {
    return (
      /^(sim|quero|pode|vamos|ok|okay|desejo|claro|isso|positivo|uhum|bora)\b/i.test(t) ||
      (/pre[-\s]?diagn/i.test(t) && !/nao|não/.test(t))
    );
  }

  function looksNo(t) {
    return /^(nao|não|agora nao|agora não|depois|negativo)\b/i.test(t);
  }

  function firstName(raw) {
    var clean = raw.replace(/[^A-Za-zÀ-ÿ\s'-]/g, " ").trim().split(/\s+/)[0] || "";
    if (clean.length < 2) return "";
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  async function askGemini(userText) {
    var apiKey = key();
    if (!apiKey) {
      return (
        "Consigo seguir o pre-diagnostico por aqui. Me conte o aparelho (notebook, desktop, GPU, placa-mae ou fonte) e o que esta acontecendo. " +
        "Se preferir falar com a bancada agora: WhatsApp (85) 99988-6993."
      );
    }

    var contents = state.messages.concat([{ role: "user", parts: [{ text: userText }] }]);
    var body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt() }] },
      contents: contents,
      generationConfig: { temperature: 0.55, maxOutputTokens: 420 }
    });

    var lastErr = "sem resposta";
    for (var i = 0; i < MODELS.length; i++) {
      try {
        var res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            MODELS[i] +
            ":generateContent?key=" +
            encodeURIComponent(apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body
          }
        );
        var data = await res.json();
        if (!res.ok) {
          lastErr = (data.error && data.error.message) || res.status;
          continue;
        }
        var text =
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts
            ? data.candidates[0].content.parts
                .map(function (p) {
                  return p.text || "";
                })
                .join("\n")
                .trim()
            : "";
        if (text) return text;
      } catch (e) {
        lastErr = e.message || String(e);
      }
    }
    return (
      "Tive um problema para falar com a IA agora (" +
      lastErr +
      "). Pode repetir em uma frase, ou chamar no WhatsApp (85) 99988-6993."
    );
  }

  async function onSend(raw) {
    var text = (raw || "").trim();
    if (!text || state.busy) return;
    var input = el("zaraInput");
    if (input) input.value = "";
    bubble("user", text);

    if (state.step === "askName") {
      var nome = firstName(text);
      if (!nome) {
        typeZara("Pode me passar so o primeiro nome, por favor?");
        return;
      }
      state.nome = nome;
      state.step = "askDiag";
      typeZara(
        "Prazer, " +
          nome +
          ". Voce gostaria de fazer um pre-diagnostico agora?"
      );
      return;
    }

    if (state.step === "askDiag") {
      if (looksNo(text)) {
        state.step = "idle";
        typeZara(
          "Tudo bem, " +
            state.nome +
            ". Qualquer hora estamos aqui. Se preferir, a bancada atende no WhatsApp (85) 99988-6993."
        );
        saveHist({
          nome: state.nome,
          resumo: "Recusou pre-diagnostico no site.",
          em: Date.now()
        });
        return;
      }
      if (!looksYes(text) && text.length < 8) {
        typeZara(
          state.nome + ", voce deseja fazer o pre-diagnostico agora? Pode responder sim ou nao."
        );
        return;
      }
      state.step = "diag";
      if (!looksYes(text)) {
        state.messages.push({ role: "user", parts: [{ text: text }] });
      } else {
        state.messages.push({
          role: "user",
          parts: [{ text: "Sim, quero o pre-diagnostico." }]
        });
      }
    } else {
      state.messages.push({ role: "user", parts: [{ text: text }] });
    }

    state.busy = true;
    setTyping(true);
    var reply = await askGemini(text);
    state.messages.push({ role: "model", parts: [{ text: reply }] });
    saveHist({
      nome: state.nome,
      resumo: text.slice(0, 180) + " | Zara: " + reply.slice(0, 180),
      em: Date.now()
    });
    typeZara(reply, function () {
      state.busy = false;
    });
  }

  function bind() {
    var form = el("zaraForm");
    var launch = el("zaraLaunch");
    var closeBtn = el("zaraClose");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        onSend(el("zaraInput").value);
      });
    }
    if (launch) {
      launch.addEventListener("click", function () {
        setOpen(true);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setOpen(false);
        try {
          sessionStorage.setItem(SESSION_KEY, "minimized");
        } catch (e) {}
      });
    }
  }

  function openLater() {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "minimized") {
        el("zaraLaunch").hidden = false;
        return;
      }
    } catch (e) {}
    setTimeout(function () {
      setOpen(true);
      if (state.step === "askName" && !el("zaraLog").querySelector(".zara-row")) greet();
    }, DELAY_MS);
  }

  function start() {
    bind();
    el("zaraLaunch").hidden = false;
    el("zaraWin").hidden = true;
    openLater();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
