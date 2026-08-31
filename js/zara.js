(function () {
  var DELAY_MS = 12000;
  var MAX_WAIT = 20000;
  var MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  var WA_LAB =
    "WhatsApp do laboratorio: (85) 99988-6993. Traga o equipamento (e o carregador, se for notebook).";
  var HIST_KEY = "zaZaraHistorico";
  var SESSION_KEY = "zaZaraSessao";

  var state = {
    step: "askName",
    nome: "",
    equipamento: "",
    sintoma: "",
    liga: "",
    imagem: "",
    sistema: "",
    classe: "",
    messages: [],
    busy: false
  };

  function key() {
    return (window.ZA_GEMINI_API_KEY || "").trim();
  }

  function sleep(ms) {
    return new Promise(function (ok) {
      setTimeout(ok, ms);
    });
  }

  function typingMs(text) {
    var n = (text || "").length;
    return Math.min(MAX_WAIT, Math.max(5000, 4500 + n * 48));
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

  function detectEquip(t) {
    var s = (t || "").toLowerCase();
    if (/note|laptop|netbook/.test(s)) return "notebook";
    if (/\bgpu\b|placa de v[ií]deo|placa de video|rtx|gtx|radeon|vga/.test(s)) return "gpu";
    if (/placa.?m[aã]e|motherboard|mobo/.test(s)) return "placa-mae";
    if (/\bfonte\b|psu|power supply/.test(s)) return "fonte";
    if (/desktop|gabinete|computador|tower|\bpc\b/.test(s)) return "desktop";
    return "";
  }

  function labelEquip(id) {
    return (
      {
        notebook: "notebook",
        desktop: "desktop",
        gpu: "placa de video",
        "placa-mae": "placa-mae",
        fonte: "fonte"
      }[id] || ""
    );
  }

  function systemPrompt() {
    var hist = loadHist();
    var casos = hist.length
      ? hist
          .map(function (c, i) {
            return (
              i +
              1 +
              ". " +
              (c.nome || "cliente") +
              " / " +
              (c.equipamento || "?") +
              ": " +
              (c.resumo || "")
            );
          })
          .join("\n")
      : "Nenhum caso anterior neste aparelho.";

    return (
      "Voce e Zara, atendente da ZA-TECH, laboratorio de informatica em Fortaleza (CE). " +
      "Cordial e educada. Portugues do Brasil. Frases curtas. Nao invente preco, prazo ou garantia.\n\n" +
      "ROTEIRO OBRIGATORIO:\n" +
      "1) Acolhimento e nome.\n" +
      "2) O que esta acontecendo com o equipamento.\n" +
      "3) Identificar: notebook, desktop, GPU, placa-mae ou fonte. Sem isso, nao feche diagnostico.\n" +
      "4) Pre-diagnostico nesta ordem: (a) liga? (b) tem imagem? (c) o SISTEMA inicia " +
      "(Windows/Linux: lento, trava, tela azul, virus, nao entra no SO).\n" +
      "5) CLASSIFICAR:\n" +
      "- HARDWARE: nao liga, sem imagem, cheiro de queimado, estalo, artefato, liquido, queda, curto, fonte desarma, sem POST. " +
      "Acao: direcionar ao LABORATORIO ZA-TECH. Nao oriente abrir a peca em casa. " +
      "Texto: precisa de bancada. WhatsApp (85) 99988-6993. Trazer equipamento e carregador se notebook.\n" +
      "- SISTEMA: Windows lento, programa, driver, virus, formatar, login, inicia mas trava. " +
      "Acao: backup primeiro; laboratorio faz formatacao e checagem de disco se quiser.\n" +
      "- MISTO: peca e sistema. Trazer ao laboratorio para triagem unica.\n" +
      "6) Sempre deixe claro que e pre-diagnostico; o tecnico confirma na bancada ESD.\n\n" +
      "SERVICOS: GPU, placa-mae, fonte, notebook, desktop, limpeza termica, upgrade, sistema/backup, preventiva.\n\n" +
      "Cliente: " +
      (state.nome || "ainda sem nome") +
      ".\nEquipamento: " +
      (labelEquip(state.equipamento) || "ainda nao") +
      ".\nSintoma: " +
      (state.sintoma || "ainda nao") +
      ".\nLiga: " +
      (state.liga || "?") +
      ".\nImagem: " +
      (state.imagem || "?") +
      ".\nSistema: " +
      (state.sistema || "?") +
      ".\nClasse: " +
      (state.classe || "?") +
      ".\nEtapa: " +
      state.step +
      ".\nCasos anteriores:\n" +
      casos
    );
  }

  function el(id) {
    return document.getElementById(id);
  }

  function revealLast() {
    var log = el("zaraLog");
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }

  function bubble(who, text) {
    var log = el("zaraLog");
    if (!log) return null;
    var row = document.createElement("div");
    row.className = "zara-row is-" + who;
    var msg = document.createElement("div");
    msg.className = "zara-msg";
    msg.textContent = text;
    row.appendChild(msg);
    var typing = el("zaraTyping");
    if (typing) log.insertBefore(row, typing);
    else log.appendChild(row);
    revealLast();
    return msg;
  }

  function setTyping(on) {
    var typing = el("zaraTyping");
    if (!typing) return;
    typing.hidden = !on;
    revealLast();
  }

  async function speak(text) {
    state.busy = true;
    setTyping(true);
    await sleep(typingMs(text));
    setTyping(false);
    bubble("zara", text);
    state.messages.push({ role: "model", parts: [{ text: text }] });
    state.busy = false;
  }

  async function speakAfterWork(work) {
    state.busy = true;
    setTyping(true);
    var started = Date.now();
    var reply = await work();
    var target = typingMs(reply);
    var left = Math.max(0, Math.min(MAX_WAIT, target) - (Date.now() - started));
    if (left) await sleep(left);
    setTyping(false);
    bubble("zara", reply);
    state.messages.push({ role: "model", parts: [{ text: reply }] });
    state.busy = false;
    return reply;
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
    var text =
      saudacao() +
      ". Eu sou a Zara, da ZA-TECH. Seja bem-vindo. Como posso te chamar?";
    speak(text);
  }

  function looksYes(t) {
    return /^(sim|s|ss|liga|ligado|liga sim|tenho|tem|aparece|ok|claro|positivo)\b/i.test(
      (t || "").trim()
    ) || /\b(sim|liga|tem imagem|ta ligando|está ligando)\b/i.test(t);
  }

  function looksNo(t) {
    return /^(nao|não|n|negativo|nunca)\b/i.test((t || "").trim()) ||
      /\b(nao liga|não liga|nao acende|não acende|sem imagem|tela preta|morto)\b/i.test(t);
  }

  function detectHardware(t) {
    var s = (t || "").toLowerCase();
    return /nao liga|não liga|sem energia|cheiro|queim|estalo|chiado|artefato|tela preta|sem imagem|liquido|líquido|derram|caiu|queda|curto|nao da video|não dá vídeo|fonte desarma|bip|nao da post|não dá post|capacitor|placa morta|gpu morta/.test(
      s
    );
  }

  function detectSoftware(t) {
    var s = (t || "").toLowerCase();
    return /windows|linux|sistema|formatar|v[ií]rus|lento|travando|programa|driver|atualiza|tela azul|bsod|login|senha|office|lento pra abrir|erro de sistema|nao inicia o windows|não inicia o windows|restauração|restauracao/.test(
      s
    );
  }

  function textoLabHardware() {
    return (
      "Pelo pre-diagnostico, isso aponta falha de hardware. Nao e caso so de sistema: precisa de bancada no laboratorio ZA-TECH, em Fortaleza. " +
      "O tecnico confirma na ESD. " +
      WA_LAB
    );
  }

  function textoSistema() {
    return (
      "Isso parece mais sistema (Windows/programas/drivers), nao peca queimada. Backup primeiro. " +
      "Se quiser formatacao, drivers e checagem de disco, o laboratorio tambem faz. " +
      WA_LAB
    );
  }

  function firstName(raw) {
    var clean = raw.replace(/[^A-Za-zÀ-ÿ\s'-]/g, " ").trim().split(/\s+/)[0] || "";
    if (clean.length < 2) return "";
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  function startPowerQuestion() {
    state.step = "askPower";
    return (
      "Obrigada, " +
      state.nome +
      ". Equipamento: " +
      labelEquip(state.equipamento) +
      ". Vamos ao pre-diagnostico. O aparelho liga? Acende luz, ventoinha ou bip?"
    );
  }

  function localReply(userText) {
    var t = userText || "";

    if (state.step === "askSymptom") {
      state.sintoma = t;
      var eq = detectEquip(t);
      if (eq) {
        state.equipamento = eq;
        if (detectHardware(t) && !detectSoftware(t)) {
          state.classe = "hardware";
          state.step = "lab";
          return textoLabHardware();
        }
        return startPowerQuestion();
      }
      state.step = "askEquip";
      return (
        "Entendi, " +
        state.nome +
        ". Para identificar o equipamento: e notebook, desktop, placa de video, placa-mae ou fonte?"
      );
    }

    if (state.step === "askEquip") {
      var found = detectEquip(t);
      if (!found) {
        return "Pode confirmar, por favor: notebook, desktop, placa de video, placa-mae ou fonte?";
      }
      state.equipamento = found;
      if (detectHardware(state.sintoma + " " + t) && !detectSoftware(t)) {
        state.classe = "hardware";
        state.step = "lab";
        return textoLabHardware();
      }
      return startPowerQuestion();
    }

    if (state.step === "askPower") {
      if (looksNo(t) || /nao liga|não liga|morto|sem energia/.test(t.toLowerCase())) {
        state.liga = "nao";
        state.classe = "hardware";
        state.step = "lab";
        return "Se nao liga, o pre-diagnostico e de hardware (fonte, placa-mae ou alimentacao). " + textoLabHardware();
      }
      state.liga = "sim";
      state.step = "askImage";
      return "Ele liga. Aparece imagem na tela, ou fica preta / sem video?";
    }

    if (state.step === "askImage") {
      if (looksNo(t) || /preta|sem video|sem imagem|sem sinal|nao da video|não dá vídeo/.test(t.toLowerCase())) {
        state.imagem = "nao";
        state.classe = "hardware";
        state.step = "lab";
        return "Sem imagem, com o aparelho ligando, costuma ser GPU, memoria, cabo ou placa-mae. " + textoLabHardware();
      }
      state.imagem = "sim";
      state.step = "askSystem";
      return "Tem imagem. Agora o sistema: o Windows (ou Linux) inicia normal, ou trava, fica lento, da tela azul, virus, ou nao entra no sistema?";
    }

    if (state.step === "askSystem") {
      state.sistema = t;
      if (detectHardware(t) && !detectSoftware(t)) {
        state.classe = "hardware";
        state.step = "lab";
        return textoLabHardware();
      }
      if (detectSoftware(t) && !detectHardware(t)) {
        state.classe = "software";
        state.step = "lab";
        return textoSistema();
      }
      if (detectHardware(t) && detectSoftware(t)) {
        state.classe = "misto";
        state.step = "lab";
        return "Pode ser sistema e peca ao mesmo tempo. O laboratorio testa hardware e sistema na mesma triagem. " + WA_LAB;
      }
      return (
        "Pode detalhar o sistema, " +
        state.nome +
        "? Por exemplo: inicia o Windows, trava em programa, tela azul, ou o PC liga sem entrar no sistema."
      );
    }

    if (state.step === "lab") {
      if (state.classe === "software") return textoSistema();
      if (state.classe === "misto") {
        return "Melhor trazer ao laboratorio para testar peca e sistema. " + WA_LAB;
      }
      return textoLabHardware();
    }

    if (detectHardware(t)) {
      state.classe = "hardware";
      state.step = "lab";
      return textoLabHardware();
    }
    if (detectSoftware(t)) {
      state.classe = "software";
      state.step = "lab";
      return textoSistema();
    }
    return "Pode repetir se o aparelho liga, se tem imagem e se o sistema inicia? Assim eu fecho o pre-diagnostico. Se ja quiser a bancada: " + WA_LAB;
  }

  async function askGemini(userText) {
    var apiKey = key();
    if (!apiKey) return localReply(userText);

    var contents = state.messages.concat([{ role: "user", parts: [{ text: userText }] }]);
    var body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt() }] },
      contents: contents,
      generationConfig: { temperature: 0.45, maxOutputTokens: 380 }
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
    return localReply(userText) + " (A IA nao respondeu agora: " + lastErr + ".)";
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
        await speak("Pode me passar so o primeiro nome, por favor?");
        return;
      }
      state.nome = nome;
      state.step = "askSymptom";
      await speak(
        "Prazer, " +
          nome +
          ". Seja bem-vindo a ZA-TECH. Antes de comecar o pre-atendimento, pode me contar o que esta acontecendo com o equipamento?"
      );
      return;
    }

    var eqNow = detectEquip(text);
    if (eqNow) state.equipamento = eqNow;

    state.messages.push({ role: "user", parts: [{ text: text }] });
    var reply = await speakAfterWork(function () {
      return askGemini(text);
    });
    saveHist({
      nome: state.nome,
      equipamento: state.equipamento,
      classe: state.classe,
      resumo: text.slice(0, 160) + " | " + (reply || "").slice(0, 160),
      em: Date.now()
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
