/* Interface do Jarvis. O Python chama as funções de window.hud;
   os botões chamam o Python via window.pywebview.api. */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const ROTULOS = {
    iniciando: "iniciando", ocioso: "aguardando", ouvindo: "ouvindo",
    transcrevendo: "processando", pensando: "pensando", falando: "falando", erro: "erro",
  };
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  // ---------------- estado compartilhado com o desenho ----------------
  const s = { estado: "iniciando", nivelMic: 0, nivel: 0, alvo: 0 };

  // ---------------- chamadas ao Python ----------------
  function py(metodo, ...args) {
    const api = window.pywebview && window.pywebview.api;
    if (api && api[metodo]) return api[metodo](...args);
    console.log("[sem pywebview]", metodo, ...args); // aberto direto no navegador
  }

  // ---------------- API usada pelo Python ----------------
  const hud = {
    estado(nome) {
      s.estado = nome;
      document.body.dataset.estado = nome;
      $("#estado-rotulo").textContent = ROTULOS[nome] || nome;
      if (nome === "ocioso") $("#ferramenta").classList.remove("visivel");
    },
    nivel(v) { s.nivelMic = Math.max(0, Math.min(1, Number(v) || 0)); },
    mensagem(quem, texto) {
      adicionarRegistro(quem === "jarvis" ? "jarvis" : "voce", texto);
      $("#legenda").textContent = quem === "jarvis" ? texto : `“${texto}”`;
    },
    aviso(texto) { adicionarRegistro("aviso", texto); },
    ferramenta(nome) {
      const el = $("#ferramenta");
      el.textContent = nome;
      el.classList.add("visivel");
    },
    sistema(d) {
      for (const chave of ["cpu", "ram", "disco", "bateria"]) {
        const el = document.querySelector(`.medidor[data-chave="${chave}"]`);
        const v = d[chave];
        if (v === null || v === undefined) {
          el.querySelector("b").textContent = chave === "bateria" ? "AC" : "--";
          el.querySelector("i").style.width = "0";
          continue;
        }
        el.querySelector("b").textContent = `${v}%${chave === "bateria" && d.carregando ? "⚡" : ""}`;
        el.querySelector("i").style.width = `${v}%`;
        const alto = chave === "bateria" ? v < 30 : v > 75;
        const critico = chave === "bateria" ? v < 15 : v > 90;
        el.classList.toggle("alto", alto && !critico);
        el.classList.toggle("critico", critico);
      }
    },
    modulos(mapa) {
      const ul = $("#modulos");
      ul.innerHTML = "";
      for (const [nome, ok] of Object.entries(mapa)) {
        const li = document.createElement("li");
        li.textContent = nome;
        li.className = ok ? "on" : "";
        li.title = ok ? "ativo" : "não configurado";
        ul.appendChild(li);
      }
    },
    aba(nome) { mostrarAba(nome); },
    painel(nome, dados) { (PAINEIS[nome] || (() => {}))(dados || {}); },
    claude(ev) { eventoClaude(ev); },
    claude_info(info) {
      $("#claude-pasta").textContent = info.pasta || "--";
      $("#claude-pasta").title = `Pasta onde o Claude trabalha: ${info.pasta}`;
      claudeDisponivel = !!info.disponivel;
      if (!claudeDisponivel) {
        $("#chat").innerHTML = "";
        adicionarChat("erro", "Claude Code não encontrado. Instale a extensão do Claude Code no VS Code " +
          "ou ponha o caminho do claude.exe em CLAUDE_CODE_EXE no arquivo .env.");
        $("#chat-texto").disabled = true;
      }
    },
    terminal_dados(d) { if (term) term.write(d); },
    terminal_saiu() {
      if (!term) return;
      term.write("\r\n\x1b[33m[Claude Code encerrado. Aperte Enter para abrir de novo.]\x1b[0m\r\n");
      terminalEncerrado = true;
    },
  };
  window.hud = hud;

  function adicionarRegistro(tipo, texto) {
    const ol = $("#registro");
    const li = document.createElement("li");
    li.className = tipo;
    const quem = document.createElement("small");
    const agora = new Date();
    const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    quem.textContent = `${tipo === "jarvis" ? "Jarvis" : tipo === "voce" ? "Você" : "Sistema"} · ${hora}`;
    li.append(quem, document.createTextNode(texto));
    ol.appendChild(li);
    while (ol.children.length > 80) ol.firstChild.remove();
    ol.scrollTop = ol.scrollHeight;
  }

  // ---------------- relógio ----------------
  function relogio() {
    const d = new Date();
    $("#hora").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    $("#data").textContent = `${DIAS[d.getDay()]} · ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }
  relogio();
  setInterval(relogio, 1000);

  // ---------------- controles ----------------
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const campo = $("#texto");
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = "";
    py("enviar_texto", texto);
  });
  $("#btn-mic").addEventListener("click", () => py("ouvir"));
  $("#btn-silenciar").addEventListener("click", () => py("silenciar"));
  $("#btn-esquecer").addEventListener("click", () => py("esquecer"));
  document.querySelectorAll(".atalhos button").forEach((b) =>
    b.addEventListener("click", () => py("enviar_texto", b.dataset.cmd)));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest(".xterm")) return;   // o terminal usa as próprias teclas
    if (e.key === "F2" || (e.ctrlKey && e.code === "Space")) { e.preventDefault(); py("ouvir"); }
    if (e.key === "Escape") py("silenciar");
  });

  // ---------------- abas ----------------
  let abaAtual = "registro";
  function mostrarAba(nome) {
    abaAtual = nome;
    document.querySelectorAll(".abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
    document.querySelectorAll(".aba-conteudo").forEach((c) => c.classList.toggle("ativa", c.dataset.aba === nome));
    document.body.classList.toggle("largo", nome !== "registro");
    if (nome === "terminal") iniciarTerminal();
    if (nome === "claude") setTimeout(() => $("#chat-texto").focus(), 50);
  }
  document.querySelectorAll(".abas button").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.aba)));

  // ---------------- aba Claude ----------------
  let claudeDisponivel = true;
  let pensando = null;

  function formatar(texto) {
    // tudo é escapado antes; só depois entram <pre>, <code> e <b>
    const seguro = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return seguro
      .replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, codigo) => `<pre><code>${codigo.replace(/\n$/, "")}</code></pre>`)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  }

  function adicionarChat(tipo, texto) {
    const chat = $("#chat");
    const aviso = chat.querySelector(".chat-aviso");
    if (aviso) aviso.remove();
    const el = document.createElement("div");
    if (tipo === "ferramenta") {
      el.className = "ferramenta-linha";
      el.textContent = texto;
      el.title = texto;
    } else {
      el.className = `msg ${tipo}`;
      if (tipo === "claude") el.innerHTML = formatar(texto);
      else el.textContent = texto;
    }
    chat.insertBefore(el, pensando && pensando.parentNode === chat ? pensando : null);
    chat.scrollTop = chat.scrollHeight;
  }

  function eventoClaude(ev) {
    const chat = $("#chat");
    if (ev.tipo === "voce") adicionarChat("voce", ev.texto);
    else if (ev.tipo === "texto") adicionarChat("claude", ev.texto);
    else if (ev.tipo === "ferramenta") adicionarChat("ferramenta", ev.texto);
    else if (ev.tipo === "erro") adicionarChat("erro", ev.texto);
    else if (ev.tipo === "nova") {
      chat.innerHTML = '<p class="chat-aviso">Nova conversa. O Claude não lembra do que foi dito antes.</p>';
    } else if (ev.tipo === "ocupado") {
      $("#claude-ponto").classList.toggle("ocupado", ev.valor);
      $("#claude-parar").disabled = !ev.valor;
      if (ev.valor) {
        pensando = document.createElement("div");
        pensando.className = "pensando";
        pensando.textContent = "Claude trabalhando…";
        chat.appendChild(pensando);
      } else if (pensando) {
        pensando.remove();
        pensando = null;
      }
      chat.scrollTop = chat.scrollHeight;
    }
  }

  function enviarAoClaude() {
    const campo = $("#chat-texto");
    const texto = campo.value.trim();
    if (!texto || !claudeDisponivel) return;
    campo.value = "";
    py("claude_enviar", texto);
  }
  $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); enviarAoClaude(); });
  $("#chat-texto").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarAoClaude(); }
  });
  $("#claude-nova").addEventListener("click", () => py("claude_nova"));
  $("#claude-parar").addEventListener("click", () => py("claude_parar"));
  $("#claude-comandos").addEventListener("change", (e) => py("claude_permitir_comandos", e.target.checked));

  // ---------------- aba Terminal (Claude Code interativo) ----------------
  let term = null, ajuste = null, terminalEncerrado = false;
  const caixaTerminal = $("#terminal");

  function iniciarTerminal() {
    if (term) { setTimeout(ajustarTerminal, 60); term.focus(); return; }
    if (!window.Terminal || !window.FitAddon) {
      caixaTerminal.innerHTML = '<p class="terminal-aviso">Não foi possível carregar o terminal (ui/vendor/xterm).</p>';
      return;
    }
    term = new Terminal({
      fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: 13, cursorBlink: true, scrollback: 5000,
      theme: { background: "#03080e", foreground: "#d8f1ff", cursor: "#4fd8ff", selectionBackground: "rgba(79, 216, 255, 0.3)" },
    });
    ajuste = new FitAddon.FitAddon();
    term.loadAddon(ajuste);
    term.open(caixaTerminal);
    ajuste.fit();
    term.onData(digitar);
    new ResizeObserver(() => ajustarTerminal()).observe(caixaTerminal);
    py("terminal_iniciar", term.cols, term.rows);
    term.focus();
  }

  function ajustarTerminal() {
    if (!term || caixaTerminal.offsetParent === null) return;   // aba escondida
    const antes = `${term.cols}x${term.rows}`;
    ajuste.fit();
    if (`${term.cols}x${term.rows}` !== antes) py("terminal_redimensionar", term.cols, term.rows);
  }

  // as teclas vão em ordem: cada envio espera o anterior terminar
  let fila = Promise.resolve(), pendente = "", agendado = false;
  function digitar(dados) {
    if (terminalEncerrado) {
      if (!dados.includes("\r")) return;
      terminalEncerrado = false;
      term.reset();
      py("terminal_reiniciar", term.cols, term.rows);
      return;
    }
    pendente += dados;
    if (agendado) return;
    agendado = true;
    fila = fila.then(() => {
      agendado = false;
      const lote = pendente;
      pendente = "";
      return lote ? py("terminal_escrever", lote) : null;
    });
  }
  $("#terminal-reiniciar").addEventListener("click", () => {
    if (!term) return iniciarTerminal();
    terminalEncerrado = false;
    term.reset();
    py("terminal_reiniciar", term.cols, term.rows);
    term.focus();
  });

  // ---------------- painéis ----------------
  const ICONE_PLAY = "M8 5v14l11-7z", ICONE_PAUSA = "M6 5h4v14H6zm8 0h4v14h-4z";

  function lista(el, itens) {
    el.innerHTML = "";
    for (const item of itens) el.appendChild(item);
  }
  function li(classe, partes) {
    const el = document.createElement("li");
    if (classe) el.className = classe;
    for (const [tag, texto] of partes) {
      const filho = tag ? document.createElement(tag) : document.createTextNode("");
      filho.textContent = texto;
      el.appendChild(filho);
    }
    return el;
  }

  const PAINEIS = {
    clima(d) {
      if (d.erro) { $("#clima-cond").textContent = "indisponível"; $("#clima-cond").title = d.erro; return; }
      $("#clima-temp").textContent = `${d.temp}°`;
      $("#clima-local").textContent = d.local;
      $("#clima-cond").textContent = d.condicao;
      $("#clima-hoje").textContent = `Hoje ${d.min}° a ${d.max}° · sensação ${d.sensacao}°` +
        (d.chuva != null ? ` · chuva ${d.chuva}%` : "");
      lista($("#clima-dias"), d.dias.map((dia) => {
        const el = li("", [["b", dia.dia], ["span", `${dia.min}°/${dia.max}°`], ["small", dia.chuva != null ? `${dia.chuva}%` : ""]]);
        el.title = dia.condicao;
        return el;
      }));
    },
    google(d) {
      const eventos = $("#eventos");
      if (d.desativado) {
        lista(eventos, [li("vazio", [["", "Google não conectado (veja o README)."]])]);
        $("#emails").hidden = true;
        return;
      }
      if (d.erro) { lista(eventos, [li("vazio", [["", `Indisponível: ${d.erro}`]])]); return; }
      lista(eventos, d.eventos.length
        ? d.eventos.slice(0, 5).map((ev) => li("", [["b", ev.hora], ["span", ev.titulo]]))
        : [li("vazio", [["", "Nenhum compromisso hoje."]])]);
      $("#emails-n").textContent = Number(d.nao_lidos).toLocaleString("pt-BR");
      $("#emails").hidden = false;
    },
    spotify(d) {
      const capa = $("#capa");
      let musica = "Nada tocando", artista = "", tocando = false;
      if (d.desativado) { musica = "Spotify não configurado"; artista = "os botões usam as teclas de mídia"; }
      else if (d.erro) { musica = "Spotify indisponível"; artista = d.erro; }
      else if (!d.vazio) { musica = d.musica; artista = d.artista; tocando = d.tocando; }
      $("#musica").textContent = musica;
      $("#artista").textContent = artista;
      $("#artista").title = artista;
      capa.hidden = !d.capa;
      if (d.capa && capa.src !== d.capa) capa.src = d.capa;
      $("#icone-play").setAttribute("d", tocando ? ICONE_PAUSA : ICONE_PLAY);
    },
  };

  document.querySelectorAll("[data-midia]").forEach((b) =>
    b.addEventListener("click", () => py("midia", b.dataset.midia)));
  document.querySelectorAll("[data-atualizar]").forEach((b) =>
    b.addEventListener("click", () => py("atualizar_paineis", b.dataset.atualizar)));
  $("#emails").addEventListener("click", () => py("enviar_texto", $("#emails").dataset.cmd));

  // ---------------- desenho do núcleo ----------------
  const canvas = $("#anel");
  const ctx = canvas.getContext("2d");
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let L = 0, dpr = 1, t0 = performance.now();
  const rot = { a: 0, b: 0, c: 0, varre: 0 };
  const ruido = Array.from({ length: 96 }, () => Math.random() * Math.PI * 2);

  function redimensionar() {
    dpr = window.devicePixelRatio || 1;
    L = canvas.clientWidth;
    canvas.width = L * dpr;
    canvas.height = L * dpr;
  }
  new ResizeObserver(redimensionar).observe(canvas);
  redimensionar();

  function cor(nome, alfa = 1) {
    const base = {
      ciano: [79, 216, 255], ambar: [255, 181, 71], vermelho: [255, 84, 112], cinza: [90, 130, 150],
    }[nome];
    return `rgba(${base[0]},${base[1]},${base[2]},${alfa})`;
  }

  function corEstado() {
    if (s.estado === "pensando" || s.estado === "transcrevendo") return "ambar";
    if (s.estado === "erro") return "vermelho";
    if (s.estado === "iniciando") return "cinza";
    return "ciano";
  }

  function quadro(agora) {
    const dt = Math.min(0.05, (agora - t0) / 1000);
    t0 = agora;
    const t = agora / 1000;
    const c = corEstado();
    const R = L / 2;

    // nível: microfone real ao ouvir, simulado ao falar
    if (s.estado === "ouvindo") s.alvo = s.nivelMic;
    else if (s.estado === "falando") s.alvo = 0.35 + 0.35 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1));
    else s.alvo = 0;
    s.nivel += (s.alvo - s.nivel) * Math.min(1, dt * 12);

    const vel = { ocioso: 0.15, iniciando: 0.08, ouvindo: 0.35, transcrevendo: 1.4, pensando: 1.8, falando: 0.45, erro: 0.05 }[s.estado] || 0.2;
    const m = reduzir ? 0.15 : 1;
    rot.a += dt * vel * 0.25 * m;
    rot.b -= dt * vel * 0.6 * m;
    rot.c += dt * vel * 1.1 * m;
    rot.varre += dt * vel * 2.2 * m;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, L);
    ctx.save();
    ctx.translate(R, R);
    ctx.lineCap = "round";

    // brilho central
    const pulso = 0.5 + 0.5 * Math.sin(t * 1.6);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
    g.addColorStop(0, cor(c, 0.22 + s.nivel * 0.35 + pulso * 0.05));
    g.addColorStop(1, cor(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2); ctx.fill();

    // A — régua externa com marcações
    ctx.save();
    ctx.rotate(rot.a);
    for (let i = 0; i < 144; i++) {
      const ang = (i / 144) * Math.PI * 2;
      const longa = i % 12 === 0;
      const r1 = R * 0.93, r2 = R * (longa ? 0.87 : 0.9);
      ctx.strokeStyle = cor(c, longa ? 0.75 : 0.3);
      ctx.lineWidth = longa ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // B — arcos segmentados girando ao contrário
    ctx.save();
    ctx.rotate(rot.b);
    ctx.lineWidth = Math.max(3, R * 0.03);
    const arcos = [[0, 0.62], [0.78, 1.35], [1.5, 1.62], [2.2, 3.0], [3.3, 3.42], [3.6, 4.6], [4.9, 5.7]];
    for (const [i0, i1] of arcos) {
      ctx.strokeStyle = cor(c, 0.55);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.8, i0, i1); ctx.stroke();
    }
    ctx.restore();

    // C — anel fino tracejado
    ctx.save();
    ctx.rotate(rot.c);
    ctx.setLineDash([2, 8]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = cor(c, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // varredura ao pensar
    if (s.estado === "pensando" || s.estado === "transcrevendo") {
      ctx.save();
      ctx.rotate(rot.varre);
      const gv = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
      if (gv) {
        gv.addColorStop(0, cor(c, 0.35));
        gv.addColorStop(0.12, cor(c, 0));
        gv.addColorStop(1, cor(c, 0));
        ctx.fillStyle = gv;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // D — onda de voz em volta do centro
    const base = R * 0.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = cor(c, 0.9);
    ctx.shadowColor = cor(c, 0.9);
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const n = ruido.length;
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const ang = (k / n) * Math.PI * 2;
      const onda = Math.sin(t * 6 + ruido[k]) * 0.5 + Math.sin(t * 2.3 + k * 0.7) * 0.5;
      const r = base + onda * s.nivel * R * 0.09 + pulso * R * 0.004;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // anel interno estático
    ctx.lineWidth = 1;
    ctx.strokeStyle = cor(c, 0.25);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
})();
