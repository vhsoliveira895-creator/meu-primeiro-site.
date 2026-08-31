(function () {
  var DELAY_MS = 12000;
  var MAX_WAIT = 20000;
  var MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  var HIST_KEY = "zaZaraHistorico";
  var SESSION_KEY = "zaZaraSessao";

  var state = {
    step: "askName",
    nome: "",
    equipamento: "",
    sintoma: "",
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
      "Voce e Zara, atendente humana da ZA-TECH, laboratorio de informatica em Fortaleza (CE). " +
      "Sempre cordial, educada e clara. Portugues do Brasil. Frases curtas. Nunca soe robotica. " +
      "Trate pelo primeiro nome. Nao use gíria pesada. Nao invente preco, prazo, peca ou garantia. " +
      "Deixe claro que isto e pre-diagnostico; o tecnico confirma na bancada ESD.\n\n" +
      "ORDEM OBRIGATORIA DO ATENDIMENTO:\n" +
      "1) Acolhimento educado (ja feito se o nome existir). Nao pule para o diagnostico sem educacao.\n" +
      "2) Pergunte o que esta acontecendo com o equipamento (sintoma).\n" +
      "3) Identifique o equipamento: notebook, desktop, GPU/placa de video, placa-mae ou fonte. " +
      "Se nao estiver claro, pergunte. Nao faca pre-diagnostico antes de identificar.\n" +
      "4) Depois de identificado, faca o pre-diagnostico: quando comecou, se liga, se tem imagem, " +
      "superaquecimento, barulho, cheiro de queimado, queda, liquido, uso em jogo, POST, cabo.\n" +
      "5) Resumo do pre-diagnostico em linguagem simples + convite ao WhatsApp (85) 99988-6993.\n\n" +
      "SERVICOS ZA-TECH: reparo e manutencao de notebook, desktop, GPU, placa-mae e fonte; " +
      "limpeza termica, upgrade, sistema/backup, preventiva. Fortaleza. " +
      "Nao atenda assunto fora de informatica; redirecione com educacao.\n\n" +
      "Cliente: " +
      (state.nome || "ainda sem nome") +
      ".\nEquipamento identificado: " +
      (labelEquip(state.equipamento) || "ainda nao") +
      ".\nSintoma ja relatado: " +
      (state.sintoma || "ainda nao") +
      ".\nEtapa atual: " +
      state.step +
      ".\nCasos anteriores neste aparelho (referencia interna, nao exponha):\n" +
      casos
    );
  }

  function el(id) {
    return document.getElementById(id);
  }

  function revealLast() {
    var log = el("zaraLog");
    if (!log) return;
    var rows = log.querySelectorAll(".zara-row");
    var last = rows[rows.length - 1];
    if (last) last.scrollIntoView({ block: "nearest", inline: "nearest" });
    else log.scrollTop = log.scrollHeight;
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
    revealLast();
    return p;
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

  function firstName(raw) {
    var clean = raw.replace(/[^A-Za-zÀ-ÿ\s'-]/g, " ").trim().split(/\s+/)[0] || "";
    if (clean.length < 2) return "";
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  function localReply(userText) {
    if (state.step === "askSymptom") {
      state.sintoma = userText;
      var eq = detectEquip(userText);
      if (eq) {
        state.equipamento = eq;
        state.step = "diag";
        return (
          "Obrigada, " +
          state.nome +
          ". Identifiquei: " +
          labelEquip(eq) +
          ". Agora o pre-diagnostico: o aparelho liga? Aparece imagem? Comecou do nada ou depois de queda, liquido ou calor?"
        );
      }
      state.step = "askEquip";
      return (
        "Entendi, " +
        state.nome +
        ". Para eu identificar o equipamento: e notebook, desktop, placa de video, placa-mae ou fonte?"
      );
    }
    if (state.step === "askEquip") {
      var found = detectEquip(userText);
      if (!found) {
        return "Pode confirmar, por favor: notebook, desktop, placa de video, placa-mae ou fonte?";
      }
      state.equipamento = found;
      state.step = "diag";
      return (
        "Perfeito. Equipamento: " +
        labelEquip(found) +
        ". Pre-diagnostico: ele liga? Tem imagem na tela? Tem barulho, cheiro de queimado ou superaquecimento?"
      );
    }
    return (
      "Obrigada pelas informacoes. Isso ja ajuda o pre-diagnostico, mas o tecnico confirma na bancada. " +
      "Se quiser, seguimos no WhatsApp (85) 99988-6993. Pode mandar foto do equipamento e do sintoma."
    );
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

    if (state.step === "askSymptom") {
      state.sintoma = text;
      var maybe = detectEquip(text);
      if (maybe) state.equipamento = maybe;
      if (!state.equipamento) state.step = "askEquip";
      else state.step = "diag";
    } else if (state.step === "askEquip") {
      var eq = detectEquip(text);
      if (eq) {
        state.equipamento = eq;
        state.step = "diag";
      }
    }

    state.messages.push({ role: "user", parts: [{ text: text }] });
    var reply = await speakAfterWork(function () {
      return askGemini(text);
    });
    saveHist({
      nome: state.nome,
      equipamento: state.equipamento,
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
