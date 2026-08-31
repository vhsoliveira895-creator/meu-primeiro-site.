(function () {
  var MAX_WAIT = 20000;
  var MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  var WA_LAB =
    "WhatsApp do laboratório: (85) 99988-6993. Traga o equipamento (e o carregador, se for notebook).";
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
    busy: false,
    greeted: false
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
        gpu: "placa de vídeo",
        "placa-mae": "placa-mãe",
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
      "Você é Zara, da ZA-TECH (Fortaleza). Português do Brasil. Não invente preço nem prazo.\n" +
      "Após a apresentação, diga só 'Prazer' (sem nome) e pergunte: em que posso lhe ajudar?\n" +
      "Não liste diagnóstico nem orçamento na abertura. Não use sr, sra, senhor, senhora.\n" +
      "Não assuma conserto de máquina. Pergunte em que pode ajudar e extraia o motivo na conversa.\n" +
      "Só depois do motivo, se for reparo, siga o roteiro técnico. Nunca fale o nome do cliente.\n" +
      "ROTEIRO (se for reparo): sintoma, tipo de equipamento, se desktop/notebook peça CONFIGURAÇÃO " +
      "(memória 8/16 GB, SSD ou HD, Intel i5 / Ryzen 5), liga?, imagem?, Windows.\n" +
      "Hardware -> laboratório WhatsApp (85) 99988-6993. Sistema -> backup; lab formata se quiser.\n" +
      "Não escreva Prazer, Boa nem Obrigada, Boa.\n\n" +
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
    t = t.replace(
      /Pode me dizer[, ]*(por gentileza, )?o que (voce|você|o\(a\) sr\(a\)) busca na ZA-TECH\??/gi,
      "Em que posso lhe ajudar?"
    );
    t = t.replace(/\s*Diagnostico, orcamento, peca ou outra orientacao\.?/gi, "");
    t = t.replace(/\s*Diagnóstico, orçamento, peça ou outra orientação\.?/gi, "");
    t = t.replace(/\s+\./g, ".").replace(/\s{2,}/g, " ").trim();
    if (!t) t = "Prazer. Em que posso lhe ajudar?";
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
      greet();
      var input = el("zaraInput");
      if (input) input.focus();
    }
  }

  function greet() {
    if (state.greeted || state.step !== "askName") return;
    var log = el("zaraLog");
    if (log && log.querySelector(".zara-row")) {
      state.greeted = true;
      return;
    }
    state.greeted = true;
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
      "Pelo que descreveu, aponta falha de hardware. Precisa de bancada no laboratório ZA-TECH, em Fortaleza. " +
      "O técnico confirma na ESD. " +
      WA_LAB
    );
  }

  function textoSistema() {
    return (
      "Isso parece mais sistema (Windows/programas/drivers), não peça queimada. Backup primeiro. " +
      "Se quiser formatação, drivers e checagem de disco, o laboratório também faz. " +
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
    return window.ZA_FRASE_MOTIVO || "Prazer. Em que posso lhe ajudar?";
  }

  function perguntaConfig() {
    state.step = "askConfig";
    return "Você consegue me informar a configuração do computador? Exemplo: quanto tem de memória (8 GB, 16 GB), se o disco é SSD ou HD, e qual o processador (Intel i5, Ryzen 5).";
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
        return "Sem problema. Pode me contar o que você precisa?";
      }
      state.sintoma = t;
      if (/or[cç]amento|orcamento|quanto custa|pre[cç]o|valor/.test(t.toLowerCase()) && !detectHardware(t) && !detectSoftware(t) && !detectEquip(t)) {
        state.step = "lab";
        return (
          "O valor sai após a triagem na bancada, em Fortaleza. " +
          "Se quiser adiantar, descreva o ocorrido aqui, ou fale no WhatsApp (85) 99988-6993."
        );
      }
      if (/endere[cç]o|onde fica|horario|visita/.test(t.toLowerCase()) && !detectHardware(t) && !detectEquip(t)) {
        state.step = "lab";
        return "Laboratório ZA-TECH em Fortaleza. O atendimento de peça é agendado pelo WhatsApp (85) 99988-6993.";
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
      return "Certo. Você se refere a notebook, desktop, placa de vídeo, placa-mãe ou fonte?";
    }

    if (state.step === "askEquip") {
      var found = detectEquip(t);
      if (!found) {
        return "Confirma para mim: notebook, desktop, placa de vídeo, placa-mãe ou fonte?";
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
        return "Se não liga, é hardware (fonte, placa-mãe ou alimentação). " + textoLabHardware();
      }
      state.liga = "sim";
      state.step = "askImage";
      return "Liga. Tem imagem na tela ou fica preta, sem vídeo?";
    }

    if (state.step === "askImage") {
      if (looksNo(t) || /preta|sem video|sem imagem|sem sinal|nao da video|não dá vídeo/.test(t.toLowerCase())) {
        state.imagem = "nao";
        state.classe = "hardware";
        state.step = "lab";
        return "Sem imagem com o equipamento ligando: GPU, memória, cabo ou placa-mãe. " + textoLabHardware();
      }
      state.imagem = "sim";
      state.step = "askSystem";
      return "O Windows inicia? Fica lento, trava, tela azul, vírus, ou não entra no sistema?";
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
        return "Pode ser sistema e peça ao mesmo tempo. O laboratório testa hardware e sistema na mesma triagem. " + WA_LAB;
      }
      return "Detalhe o sistema: inicia o Windows, trava em programa, tela azul, ou liga sem entrar no SO?";
    }

    if (state.step === "lab") {
      if (state.classe === "software") return textoSistema();
      if (state.classe === "misto") {
        return "Melhor trazer no laboratório para testar peça e sistema. " + WA_LAB;
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
    return "Pode detalhar se liga, se há imagem e se o Windows inicia? Se preferir bancada: " + WA_LAB;
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
    return localReply(userText) + " (A IA não respondeu agora: " + lastErr + ".)";
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

  function start() {
    bind();
    window.ZA_ABRIR_ZARA = function () {
      setOpen(true);
    };
    var launch = el("zaraLaunch");
    var win = el("zaraWin");
    if (launch) launch.hidden = false;
    if (win) win.hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
