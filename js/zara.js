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
    config: "",
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
      "Voce e Zara, da ZA-TECH (Fortaleza). Portugues do Brasil. Nao invente preco nem prazo.\n" +
      "Apos a apresentacao, diga so 'Prazer' (sem nome) e pergunte: em que posso lhe ajudar?\n" +
      "Nao liste diagnostico nem orcamento na abertura. Nao use sr, sra, senhor, senhora.\n" +
      "Nao assuma que e conserto de maquina. Extraia o motivo: diagnostico, orcamento, peca, upgrade ou informacao do laboratorio.\n" +
      "So depois do motivo, se for reparo, siga o roteiro tecnico. Nunca fale o nome do cliente.\n" +
      "ROTEIRO (se for reparo): sintoma, tipo de equipamento, se desktop/notebook peca CONFIGURACAO " +
      "(memoria 8/16 GB, SSD ou HD, Intel i5 / Ryzen 5), liga?, imagem?, Windows.\n" +
      "Hardware -> laboratorio WhatsApp (85) 99988-6993. Sistema -> backup; lab formata se quiser.\n" +
      "Nao escreva Prazer, Boa nem Obrigada, Boa.\n\n" +
      "Cliente: em atendimento.\nEquipamento: " +
      (labelEquip(state.equipamento) || "?") +
      ".\nConfig: " +
      (state.config || "?") +
      ".\nSintoma: " +
      (state.sintoma || "?") +
      ".\nEtapa: " +
      state.step +
      ".\nCasos:\n" +
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

  function palavraNorm(w) {
    return String(w || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function cumprimentoLixo(w) {
    return /^(boa|bom|noite|tarde|dia|ola|oi|eae|eai|hey|obrigado|obrigada)$/.test(
      palavraNorm(w)
    );
  }

  function nomeLixo(w) {
    return (
      cumprimentoLixo(w) ||
      /^(valeu|sim|nao|n|desktop|notebook|pc|teste|zara|sr|sra|senhor|senhora)$/.test(
        palavraNorm(w)
      )
    );
  }

  function nomeValido(w) {
    var s = String(w || "").trim();
    return s.length >= 2 && !nomeLixo(s);
  }

  function limpaFala(text) {
    var t = String(text || "");
    t = t.replace(
      /\b(prazer|obrigad[oa]|ol[aá]|oi|beleza)[,:]?\s+[A-Za-zÀ-ÿ]{2,20}\.?/gi,
      function (_, abertura) {
        return abertura.charAt(0).toUpperCase() + abertura.slice(1).toLowerCase();
      }
    );
    t = t.replace(/\s+\./g, ".").replace(/\s{2,}/g, " ").trim();
    return t;
  }

  async function speak(text) {
    text = limpaFala(text);
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
    var reply = limpaFala(await work());
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
      "Pelo que descreveu, aponta falha de hardware. Precisa de bancada no laboratorio ZA-TECH, em Fortaleza. " +
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

  function capitalizaNome(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  function palavraNome(w) {
    var n = String(w || "").trim();
    if (n.length < 2 || nomeLixo(n)) return "";
    if (
      /^(me|meu|minha|chamo|chama|chamar|nome|sou|eh|eu|de|o|a|um|uma|iae)$/.test(
        palavraNorm(n)
      )
    ) {
      return "";
    }
    return capitalizaNome(n);
  }

  function firstName(raw) {
    var original = String(raw || "");
    var ident = original.match(
      /(?:me\s+chamo|meu\s+nome\s+(?:[eéèê]|eh)|eu\s+sou|pode\s+me\s+chamar(?:\s+de)?)\s+([A-Za-zÀ-ÿ']{2,20})/i
    );
    if (ident) {
      var peloPadrao = palavraNome(ident[1]);
      if (peloPadrao) return peloPadrao;
    }

    var t = original
      .replace(/\b(bom|boa)\s+(dia|tarde|noite)\b/gi, " ")
      .replace(/\b(ol[aá]+|oi+|eae|eai|hey|eita)\b/gi, " ")
      .replace(/[^A-Za-zÀ-ÿ\s'-]/g, " ")
      .trim();
    var words = t.split(/\s+/).filter(Boolean);
    var i;
    var got;
    for (i = 0; i < words.length; i++) {
      got = palavraNome(words[i]);
      if (got) return got;
    }
    return "";
  }

  function temDemanda(t) {
    var s = (t || "").toLowerCase();
    return !!(
      detectEquip(s) ||
      detectHardware(s) ||
      detectSoftware(s) ||
      /or[cç]amento|pre[cç]o|quanto custa|valor|conserto|consertar|reparo|manuten[cç][aã]o|pe[cç]a|upgrade|formatar|laboratorio|endere[cç]o|horario|visita|orcamento/.test(
        s
      )
    );
  }

  function perguntaMotivo() {
    return "Prazer. Em que posso lhe ajudar?";
  }

  function perguntaConfig() {
    state.step = "askConfig";
    return "Voce consegue me informar a configuracao do computador? Exemplo: quanto tem de memoria (8 GB, 16 GB), se o disco e SSD ou HD, e qual o processador (Intel i5, Ryzen 5).";
  }

  function perguntaLiga() {
    state.step = "askPower";
    return "Esse equipamento chega a ligar? Acende luz, ventoinha ou bip?";
  }

  function aposEquipamento() {
    if (detectHardware(state.sintoma) && !detectSoftware(state.sintoma)) {
      state.classe = "hardware";
      state.step = "lab";
      return textoLabHardware();
    }
    if (state.equipamento === "desktop" || state.equipamento === "notebook") {
      return perguntaConfig();
    }
    return perguntaLiga();
  }

  function localReply(userText) {
    var t = userText || "";

    if (state.step === "askSymptom") {
      if (!temDemanda(t) && (t || "").trim().length < 12) {
        return "Sem problema. Pode me contar o que voce precisa?";
      }
      state.sintoma = t;
      if (/or[cç]amento|orcamento|quanto custa|pre[cç]o|valor/.test(t.toLowerCase()) && !detectHardware(t) && !detectSoftware(t) && !detectEquip(t)) {
        state.step = "lab";
        return (
          "O valor sai apos a triagem na bancada, em Fortaleza. " +
          "Se quiser adiantar, descreva o ocorrido aqui, ou fale no WhatsApp (85) 99988-6993."
        );
      }
      if (/endere[cç]o|onde fica|horario|visita/.test(t.toLowerCase()) && !detectHardware(t) && !detectEquip(t)) {
        state.step = "lab";
        return "Laboratorio ZA-TECH em Fortaleza. O atendimento de peca e agendado pelo WhatsApp (85) 99988-6993.";
      }
      var eq = detectEquip(t);
      if (eq) {
        state.equipamento = eq;
        if (detectHardware(t) && !detectSoftware(t)) {
          state.classe = "hardware";
          state.step = "lab";
          return textoLabHardware();
        }
        return aposEquipamento();
      }
      state.step = "askEquip";
      return "Certo. Voce se refere a notebook, desktop, placa de video, placa-mae ou fonte?";
    }

    if (state.step === "askEquip") {
      var found = detectEquip(t);
      if (!found) {
        return "Confirma pra mim: notebook, desktop, placa de video, placa-mae ou fonte?";
      }
      state.equipamento = found;
      return aposEquipamento();
    }

    if (state.step === "askConfig") {
      state.config = t;
      if (detectHardware(t) && !detectSoftware(t)) {
        state.classe = "hardware";
        state.step = "lab";
        return textoLabHardware();
      }
      return perguntaLiga();
    }

    if (state.step === "askPower") {
      if (looksNo(t) || /nao liga|não liga|morto|sem energia/.test(t.toLowerCase())) {
        state.liga = "nao";
        state.classe = "hardware";
        state.step = "lab";
        return "Se nao liga, e hardware (fonte, placa-mae ou alimentacao). " + textoLabHardware();
      }
      state.liga = "sim";
      state.step = "askImage";
      return "Liga. Tem imagem na tela ou fica preta, sem video?";
    }

    if (state.step === "askImage") {
      if (looksNo(t) || /preta|sem video|sem imagem|sem sinal|nao da video|não dá vídeo/.test(t.toLowerCase())) {
        state.imagem = "nao";
        state.classe = "hardware";
        state.step = "lab";
        return "Sem imagem com o equipamento ligando: GPU, memoria, cabo ou placa-mae. " + textoLabHardware();
      }
      state.imagem = "sim";
      state.step = "askSystem";
      return "O Windows inicia? Fica lento, trava, tela azul, virus, ou nao entra no sistema?";
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
      return "Detalha o sistema: inicia o Windows, trava em programa, tela azul, ou liga sem entrar no SO?";
    }

    if (state.step === "lab") {
      if (state.classe === "software") return textoSistema();
      if (state.classe === "misto") {
        return "Melhor trazer no laboratorio pra testar peca e sistema. " + WA_LAB;
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
    return "Pode detalhar se liga, se ha imagem e se o Windows inicia? Se preferir bancada: " + WA_LAB;
  }

  async function askGemini(userText) {
    var apiKey = key();
    var roteiro = {
      askSymptom: 1,
      askEquip: 1,
      askConfig: 1,
      askPower: 1,
      askImage: 1,
      askSystem: 1,
      lab: 1
    };
    if (!apiKey || roteiro[state.step]) return localReply(userText);

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
      if (nome) state.nome = nome;
      state.step = "askSymptom";
      if (temDemanda(text)) {
        await speak("Prazer. " + localReply(text));
        return;
      }
      await speak(perguntaMotivo());
      return;
    }

    var eqNow = detectEquip(text);
    if (eqNow) state.equipamento = eqNow;

    state.messages.push({ role: "user", parts: [{ text: text }] });
    var reply = await speakAfterWork(function () {
      return askGemini(text);
    });
    saveHist({
      nome: nomeValido(state.nome) ? state.nome : "",
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
