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
    if (e.key === "F2" || (e.ctrlKey && e.code === "Space")) { e.preventDefault(); py("ouvir"); }
    if (e.key === "Escape") py("silenciar");
  });

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
