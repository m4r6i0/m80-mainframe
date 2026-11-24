// M80 Console: draws the screens. Receives 'dados' (data) from the extension every second
// and animates locally (spinner, timers, needle) every 250 ms.
(function () {
  const vs = acquireVsCodeApi();
  const salvo = vs.getState() || {};
  const ui = {
    aba: salvo.aba || 'mapa',
    selNo: null,
    selJob: 0,
    script: salvo.script || null,
    exec: null,
    recuo: 0,      // seconds back in the recorder (0 = live)
    janela: 120,   // seconds visible in the recorder
  };
  let d = null;
  let ultimoLogMapa = '';
  let quadro = 0;
  const errosTela = [];
  const GIRO = ['|', '/', '-', '\\'];
  // names and keys from the glossary (.code/glossario-en.md); the internal id of each tab does not change
  const ABAS = [['mapa', 'M', 'Map'], ['jobs', 'J', 'Jobs'], ['gravador', 'R', 'Recorder'], ['scripts', 'S', 'Scripts'], ['maquina', 'Y', 'System'], ['contexto', 'C', 'Context'], ['economia', 'V', 'Savings'], ['config', 'T', 'Settings'], ['sobre', 'A', 'About ?']];
  // states written by m80-motor (values are pt-BR in the file; shown in English on screen)
  const ESTADOS = { pronto: 'done', pensando: 'thinking', ferramenta: 'tool', compactando: 'compacting', erro: 'error', aguardando: 'waiting' };
  const est = v => ESTADOS[v] || v || '';

  const app = document.getElementById('app');
  app.innerHTML = '<div class="abas" id="abas"></div><div id="conteudo"></div>';
  const elAbas = document.getElementById('abas');
  const elC = document.getElementById('conteudo');

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tempo = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const kTok = n => n == null ? '--' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  const agora = () => (d ? d.agora : Date.now()) + (Date.now() - recebidoEm);
  let recebidoEm = Date.now();
  const guardar = () => vs.setState({ aba: ui.aba, script: ui.script });

  // ---------- "?" help (variant C approved in the mockup .code/prototipos/2026-11-22-console-ingles-ajuda.html) ----------
  // Help text, in English like the rest of the screen.
  const AJUDA = {
    // Settings (mockup texts)
    look: ['VS CODE LOOK', 'Changes the colors of all of VS Code. F1 to F7 pick the look; "soft" makes the colors gentler.'],
    layout: ['MAP LAYOUT', 'Changes how the Map tab is drawn. The data is the same; only the way it is shown changes.'],
    shape: ['CONSOLE SHAPE', 'Changes borders, boxes and markers. Colors always come from the active look.'],
    arcade: ['ARCADE', 'Mini game that appears when a Claude tool finishes. "test" shows it now.'],
    anim: ['ANIMATIONS', '"follow Windows" respects the Windows reduce-motion option. "never" turns everything off.'],
    conv: ['CLAUDE CONVERSATIONS', 'How many Claude tabs stay open, and when to start a new conversation near the context limit.'],
    inside: ['INSIDE CLAUDE', 'Type these commands in the Claude chat, not here.'],
    // Map
    mapa: ['MAP', 'The live Claude session in the layout chosen in Settings: main session, subagents, tools and the most-edited project folders. When a tool finishes, the Arcade game runs in the map window.'],
    log: ['LOG', 'The tools recorded by m80-motor and the Claude log of this window, printed as continuous-form paper. The buttons filter by type; "pause" freezes the list.'],
    // Jobs
    jobs: ['JOBS', 'Everything running now: main session, subagents, open tools, scripts from this tab and the task list. ↑↓ selects; F8 stops the selected script.'],
    // Recorder
    gravador: ['RECORDER', 'Timeline of the tools: one track for the main session, one per subagent and one for scripts. ◄◄ and ►► move 30 s; the "window" button cycles between 2 min, 10 min and 30 s.'],
    mesa: ['MIXER', 'One meter per channel: it rises when the main session is working, when the tokens of a subagent grow or when a script is running.'],
    // Scripts
    scripts: ['SCRIPTS', 'The scripts in the .scripts folder; the chosen one runs right here, without opening a window, and its output appears beside it. The text field sends a reply to a script waiting for input.'],
    // System
    cpu: ['CPU', 'Usage of each processor core, measured by the extension every second.'],
    memdisco: ['MEMORY AND DISK', 'RAM in use on the computer and space used on the disk that holds the project.'],
    claude: ['CLAUDE', 'Estimated session cost, context used and plan usage limits, as recorded by m80-motor. Below: router model, effort and mode.'],
    // Context
    cadeia: ['CONVERSATION MAP', 'The open Claude tabs, oldest to active, and the last closed ones. "Rotate now" opens a new conversation with the handoff card; "Reopen" brings back the last closed one.'],
    compacta: ['UNTIL COMPACTION', 'How many tokens are left before Claude compacts the conversation by itself, and how much of the context window is already in use. Under 3% headroom the card blinks and beeps.'],
    cache: ['CACHE', 'How much of the input came from the prompt cache this turn and in the whole session. High cache makes turns cheaper and faster.'],
    ocupa: ['WHAT FILLS THE CONTEXT', 'Breakdown of the context in use by category, as recorded by m80-motor.'],
    orcamento: ['MEMORY (BUDGET)', 'Size of the files loaded into every conversation (CLAUDE.md, the global one with RTK.md, and MEMORY.md) against the limit of each. Over the limit: run /m80-faxina.'],
    abasvs: ['TABS AND VS CODE', 'Open Claude conversations, total editor tabs against the VS Code limit, and the memory of the VS Code processes.'],
    historico: ['HISTORY', 'Compactions in this conversation, time of the last handoff card and context milestones already reached. The card is in .sessions/continuidade.md.'],
    // Savings
    total: ['TOTAL SAVED', 'Estimate of what the cache, the model router and rtk saved this session, using the official prices of 2026-11-03.'],
    rtk: ['RTK', 'Tokens rtk cut from command output, summed over all sessions, and the commands that saved the most.'],
    cacheprompt: ['PROMPT CACHE', 'Tokens read from the cache this session and the hit rate. Reading from cache costs 5% of the normal input price.'],
    roteador: ['MODEL ROUTER', 'How many turns of this session went to each model. The saving is what those turns would have cost on Opus.'],
    // About
    componentes: ['COMPONENTS', 'Versions of the template, the extension, m80-motor and the extension parts, read from the installed files. [OK] checked; "—" could not be checked.'],
    hooks: ['GLOBAL HOOKS', 'The M80 hooks in ~/.claude/hooks/m80 and the event each one is registered on in settings.json. [OK] only when the file exists and is registered.'],
    terceiros: ['THIRD-PARTY', 'Plugins by other authors installed in Claude, plus rtk. Dimmed ones are installed but turned off.'],
    comandos: ['COMMANDS', 'Commands of the m80-motor plugin; type them in the Claude chat.'],
    teclas: ['KEYS', 'The VS Code shortcut that opens this console.'],
  };
  // games recreated from the originals use the original name (glossary); M80Mapa.efeitos() brings the original name as the 3rd item
  const INSPIRACAO = {};
  const q = (k, rot) => '<button class="q" data-h="' + k + '" aria-label="Help: ' + esc(rot) + '">?</button>';
  document.body.insertAdjacentHTML('beforeend', '<div class="ajuda-veu" id="ajuda-veu" hidden><div class="ajuda-pop c" id="ajuda-pop" role="dialog" aria-modal="true" aria-labelledby="ajuda-t">' +
    '<div class="t" id="ajuda-t"></div><p id="ajuda-p"></p><button class="bt" id="ajuda-x">Fechar</button></div></div>');
  const veu = document.getElementById('ajuda-veu');
  const pt = document.getElementById('ajuda-t'), pp = document.getElementById('ajuda-p'), px = document.getElementById('ajuda-x');
  let volta = null, voltaChave = null;
  function textoAjuda(k) {
    if (k !== 'jogo') return AJUDA[k];
    const sel = document.getElementById('ef-sel');
    const v = sel ? sel.value : efAtual();
    if (v === 'nenhum') return ['NONE', 'No game: nothing appears when a tool finishes.'];
    const e = EFEITOS.find(x => x[0] === v) || [v, v];
    const insp = e[2] || INSPIRACAO[v];
    return [String(e[1]).toUpperCase(), insp ? 'Recreation of the Atari 2600 game ' + insp + (/[.!?]$/.test(insp) ? '' : '.') : 'Arcade mini game.'];
  }
  function abrirAjuda(k, origem) {
    const a = textoAjuda(k); if (!a) return;
    pt.textContent = ' ' + a[0] + ' '; pp.textContent = a[1]; veu.hidden = false; volta = origem; voltaChave = k; px.focus();
  }
  function fecharAjuda() {
    veu.hidden = true;
    // the tab may have been redrawn with help open: the origin "?" is looked up again by its key
    const alvo = volta && volta.isConnected ? volta : document.querySelector('[data-h="' + voltaChave + '"]');
    if (alvo) alvo.focus();
  }
  // capture: a click on "?" does not reach the other handlers (table row, filters, etc.)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-h]'); if (b) { e.stopPropagation(); abrirAjuda(b.dataset.h, b); return; }
    if (e.target === veu || e.target === px) fecharAjuda();
  }, true);

  function mdl(m) {
    const s = String(m || '').toLowerCase();
    const k = s.includes('opus') ? 'opus' : s.includes('sonnet') ? 'sonn' : s.includes('haiku') ? 'haik' : 'outro';
    const r = k === 'opus' ? 'OPUS' : k === 'sonn' ? 'SONN' : k === 'haik' ? 'HAIK' : (s ? s.slice(0, 4).toUpperCase() : '----');
    return '<span class="mdl ' + k + '">' + r + '</span>';
  }
  const classeFerr = t => ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Grep', 'Glob', 'Agent', 'Task', 'WebFetch', 'WebSearch'].includes(t) ? 'f-' + t : 'f-outra';
  function blocos(pct, larg) {
    const n = Math.round(Math.max(0, Math.min(100, pct || 0)) / 100 * larg);
    let s = '';
    for (let i = 0; i < larg; i++) {
      const c = i / larg < 0.5 ? '#55FF55' : i / larg < 0.8 ? '#FFFF55' : '#FF5555';
      s += i < n ? '<span style="color:' + c + '">█</span>' : '<span style="color:#444">░</span>';
    }
    return s;
  }
  const giro = () => '<span class="giro" data-giro>' + GIRO[quadro % 4] + '</span>';
  const vivo = () => (d && d.vivo) || null;
  const sessao = () => (vivo() && vivo().sessao) || null;

  // ---------- tabs ----------
  function desenharAbas() {
    const s = sessao();
    const info = s ? est(s.estado) + ' · ctx ' + (s.ctx == null ? '--' : s.ctx + '%') : 'no session recorded';
    const fg = folga();
    const alarme = fg != null && fg < 0.1;
    elAbas.innerHTML = ABAS.map(([id, k, nome]) => {
      // the key may be lowercase in the name (S-y-stem, Sa-v-ings, Se-t-tings)
      const i = nome.toUpperCase().indexOf(k);
      const rot = i >= 0 ? esc(nome.slice(0, i)) + '<span class="k">' + nome[i] + '</span>' + esc(nome.slice(i + 1)) : esc(nome);
      const al = id === 'contexto' && alarme;
      return '<button data-aba="' + id + '" class="' + (ui.aba === id ? 'on' : '') + (al ? ' alerta' : '') + '"' + (al ? ' style="background:#AA0000;color:#fff"' : '') + '>' + (al ? '● ' : '') + rot + '</button>';
    }).join('') + '<span class="info">' + esc((d && d.projeto) || '') + ' · ' + esc(info) + '</span>' + marcaVersao();
  }
  elAbas.addEventListener('click', e => {
    const b = e.target.closest('[data-aba]');
    if (b) { ui.aba = b.dataset.aba; guardar(); desenhar(true); }
  });

  // ---------- 1 map ----------
  function telaMapa() {
    const v = vivo();
    if (!v) return '<div class="vazio">No session recorded yet. The m80-motor plugin writes .sessions/m80-ao-vivo.json when Claude works in this project.</div>';
    const s = v.sessao || {};
    const ocupado = s.estado && s.estado !== 'pronto';
    const evs = v.eventos || [];
    const daPrincipal = evs.filter(e => e.agente === 'principal').slice(-10);
    const ultimaDe = id => { const l = evs.filter(e => e.agente === id); return l[l.length - 1]; };
    let h = '<div class="mapa">';
    h += '<div class="no principal' + (ui.selNo === 'principal' ? ' sel' : '') + '" data-no="principal"><div class="t">' + (ocupado ? giro() + ' ' : '■ ') + 'Main session</div>' +
      '<div class="m">' + mdl(s.modelo) + ' ' + esc(String(s.effort || '').toUpperCase()) + ' · ctx ' + (s.ctx == null ? '--' : s.ctx + '%') + ' · ' + (s.inicio ? '<span data-desde="' + s.inicio + '">' + tempo(agora() - s.inicio) + '</span>' : '--:--') + '</div>' +
      '<div class="a">' + esc(s.estado === 'ferramenta' ? s.ferramenta + ': ' + s.detalhe : est(s.estado)) + '</div></div>';
    h += '<div class="fio"></div><div class="filhos">';
    const agentes = v.agentes || [];
    for (const a of agentes) {
      const roda = a.status === 'running' || a.status === 'pending';
      const cls = a.status === 'completed' ? ' feito' : a.status === 'failed' || a.status === 'killed' ? ' falhou' : '';
      const ult = ultimaDe(a.id);
      h += '<div class="filho"><div class="no' + cls + (ui.selNo === a.id ? ' sel' : '') + '" data-no="' + esc(a.id) + '"><div class="t">' + (roda ? giro() : a.status === 'completed' ? '✓' : '✗') + ' ' + esc(a.nome) + '</div>' +
        '<div class="m">' + mdl(a.modelo) + ' ' + kTok(a.tokens) + ' tok · ' + (roda ? '<span data-desde="' + a.inicio + '">' + tempo(agora() - a.inicio) + '</span>' : esc(a.status)) + '</div>' +
        (ult ? '<div class="a">▸ ' + esc(ult.tool) + (ult.detalhe ? ': ' + esc(ult.detalhe) : '') + '</div>' : '') + '</div></div>';
    }
    h += '<div class="filho">' + (daPrincipal.length ? daPrincipal.map((e, i) => {
      const ativa = e.fim == null;
      const velha = !ativa && i < daPrincipal.length - 3;
      return '<span class="ferr ' + classeFerr(e.tool) + (ativa ? ' ativa' : '') + (velha ? ' velha' : '') + (e.ok === false ? ' erro' : '') + '" title="' + esc(e.detalhe) + '">' + (ativa ? giro() + ' ' : '') + esc(e.tool) + '</span>';
    }).join('') : '<span class="vazio">no tools used yet</span>') + '</div>';
    h += '</div></div>';
    if (ui.selNo) {
      if (ui.selNo === 'principal') {
        h += '<div class="detalhe">Main session\nmode ' + esc(s.modo) + ' · model ' + esc(s.modelo) + ' · effort ' + esc(s.effort) + '\ncontext ' + (s.ctx == null ? '--' : s.ctx + '%') + ' · cost $' + (s.custo == null ? '--' : Number(s.custo).toFixed(2)) + ' (estimate)\nlast actions:\n' +
          daPrincipal.slice(-6).map(e => '  ' + e.tool + (e.detalhe ? ': ' + e.detalhe : '') + (e.fim ? ' (' + tempo(e.fim - e.ini) + ')' : ' (running)')).map(esc).join('\n') + '</div>';
      } else {
        const a = agentes.find(x => x.id === ui.selNo);
        if (a) h += '<div class="detalhe">' + esc(a.nome) + '\ntype ' + esc(a.tipo) + ' · status ' + esc(a.status) + ' · model ' + esc(a.modelo) + ' · ' + kTok(a.tokens) + ' tokens\nactions:\n' +
          evs.filter(e => e.agente === a.id).slice(-8).map(e => '  ' + e.tool + (e.detalhe ? ': ' + e.detalhe : '')).map(esc).join('\n') + '</div>';
      }
    }
    return h;
  }

  // ---------- 2 jobs ----------
  function linhasJobs() {
    const L = [];
    const v = vivo();
    if (v) {
      const s = v.sessao || {};
      const ocup = s.estado && s.estado !== 'pronto';
      L.push({ job: 'Main session', tipo: 'conversation', modelo: s.modelo ? mdl(s.modelo) + ' ' + esc(String(s.effort || '').toUpperCase()) : '--', tok: s.ctx == null ? '--' : 'ctx ' + s.ctx + '%', tempo: s.inicio && ocup ? '<span data-desde="' + s.inicio + '">' + tempo(agora() - s.inicio) + '</span>' : '--', st: ocup ? '<span class="s-run">' + giro() + ' ' + esc(est(s.estado)) + '</span>' : '<span class="s-ok">done</span>' });
      for (const a of v.agentes || []) {
        const roda = a.status === 'running' || a.status === 'pending';
        L.push({ job: a.nome, tipo: 'subagent', modelo: mdl(a.modelo), tok: kTok(a.tokens), tempo: roda ? '<span data-desde="' + a.inicio + '">' + tempo(agora() - a.inicio) + '</span>' : '--', st: roda ? '<span class="s-run">' + giro() + ' running</span>' : a.status === 'completed' ? '<span class="s-ok">✓ completed</span>' : '<span class="s-err">✗ ' + esc(a.status) + '</span>' });
      }
      for (const e of (v.eventos || []).filter(e => e.fim == null)) {
        L.push({ job: e.tool + (e.detalhe ? ': ' + e.detalhe : ''), tipo: 'tool', modelo: '--', tok: '--', tempo: '<span data-desde="' + e.ini + '">' + tempo(agora() - e.ini) + '</span>', st: '<span class="s-run">' + giro() + ' running</span>' });
      }
    }
    for (const x of ((d && d.execucoes) || []).slice().reverse()) {
      L.push({ job: x.nome, tipo: 'script', modelo: '--', tok: '--', tempo: x.fim ? tempo(x.fim - x.inicio) : '<span data-desde="' + x.inicio + '">' + tempo(agora() - x.inicio) + '</span>', st: x.fim == null ? '<span class="s-run">' + giro() + ' running</span>' : x.codigo === 0 ? '<span class="s-ok">✓ exit 0</span>' : '<span class="s-err">✗ exit ' + x.codigo + '</span>', exec: x.id });
    }
    for (const t of (d && d.tarefas) || []) {
      const st = t.status === 'completed' ? '<span class="s-ok">✓ done</span>' : t.status === 'in_progress' ? '<span class="s-run">' + giro() + ' in progress</span>' : '<span class="s-off">pending</span>';
      L.push({ job: 'T-' + t.id + ' ' + t.assunto, tipo: 'task', modelo: '--', tok: '--', tempo: '--', st });
    }
    return L;
  }
  function telaJobs() {
    const L = linhasJobs();
    if (!L.length) return '<div class="vazio">Nothing running and no tasks in the list. ' + q('jobs', 'Jobs') + '</div>';
    ui.selJob = Math.min(ui.selJob, L.length - 1);
    return '<table class="jobs"><thead><tr><th>JOB ' + q('jobs', 'Jobs') + '</th><th>TYPE</th><th>MODEL</th><th>TOKENS</th><th>TIME</th><th>STATUS</th></tr></thead><tbody>' +
      L.map((l, i) => '<tr data-job="' + i + '" class="' + (i === ui.selJob ? 'sel' : '') + '"><td title="' + esc(l.job) + '">' + esc(l.job) + '</td><td>' + l.tipo + '</td><td>' + l.modelo + '</td><td>' + l.tok + '</td><td>' + l.tempo + '</td><td>' + l.st + '</td></tr>').join('') +
      '</tbody></table><div class="teclas"><b>↑↓</b> Select  <b>F8</b> Stop script  <b>M</b> Map  <b>S</b> Scripts</div>';
  }

  // ---------- 3 recorder ----------
  function telaGravador() {
    const v = vivo();
    const fim = agora() - ui.recuo * 1000;
    const ini = fim - ui.janela * 1000;
    const pos = t => Math.max(0, Math.min(100, (t - ini) / (fim - ini) * 100));
    const pistas = [['principal', 'MAIN']];
    for (const a of (v && v.agentes) || []) pistas.push([a.id, a.nome]);
    const evs = (v && v.eventos) || [];
    const execs = (d && d.execucoes) || [];
    let h = '<div class="regua"><span>' + q('gravador', 'Recorder') + '</span><div class="ticks">' + [4, 3, 2, 1, 0].map(k => '<span>-' + tempo((k * ui.janela / 4 + ui.recuo) * 1000) + '</span>').join('') + '</div></div>';
    const clip = (a, b, rot, cls) => {
      if (b < ini || a > fim) return '';
      const l = pos(a), w = Math.max(0.8, pos(b) - l);
      return '<div class="clip ' + cls + '" style="left:' + l + '%;width:' + w + '%" title="' + esc(rot) + '">' + esc(rot) + '</div>';
    };
    const agulha = ui.recuo === 0 ? '<div class="agulha" style="left:calc(100% - 2px)"></div>' : '';
    for (const [id, nome] of pistas) {
      h += '<div class="pista"><span class="lbl" title="' + esc(nome) + '">' + esc(nome) + '</span><div class="faixa">' +
        evs.filter(e => e.agente === id).map(e => clip(e.ini, e.fim || agora(), e.tool + (e.detalhe ? ' ' + e.detalhe : ''), classeFerr(e.tool))).join('') + agulha + '</div></div>';
    }
    h += '<div class="pista"><span class="lbl">SCRIPTS</span><div class="faixa">' + execs.map(x => clip(x.inicio, x.fim || agora(), x.nome, x.fim && x.codigo !== 0 ? 'f-Agent' : 'f-Edit')).join('') + agulha + '</div></div>';
    h += '<div class="transporte"><button data-g="volta">◄◄ 30s</button><button data-g="frente">30s ►►</button>' +
      (ui.recuo ? '<button data-g="vivo" class="aovivo">► Live</button><span>rewound ' + tempo(ui.recuo * 1000) + '</span>' : '<button class="rec">● Recording</button>') +
      '<button data-g="zoom">window ' + tempo(ui.janela * 1000) + '</button>' + q('mesa', 'Mixer') + '</div>';
    // mixer: one VU per channel, from the recent token change (agents) or active tools (main)
    const canais = [['MAIN', ((v && v.sessao && v.sessao.estado) || 'pronto') !== 'pronto' ? 6 + (quadro % 3) : 1]];
    for (const a of (v && v.agentes) || []) {
      const am = a.amostras || [];
      const delta = am.length > 1 ? Math.max(0, am[am.length - 1] - am[am.length - 2]) : 0;
      const roda = a.status === 'running';
      canais.push([a.nome, roda ? Math.min(11, 3 + Math.round(Math.log10(1 + delta) * 2) + (quadro % 2)) : 0]);
    }
    canais.push(['SCRIPT', execs.some(x => x.fim == null) ? 5 + (quadro % 4) : 0]);
    h += '<div class="mesa">' + canais.map(([n, nivel]) => {
      let m = '';
      for (let i = 0; i < 11; i++) m += '<i style="background:' + (i < nivel ? (i < 6 ? '#55FF55' : i < 9 ? '#FFFF55' : '#FF5555') : '#222') + '"></i>';
      return '<div class="canal"><div class="vu">' + m + '</div><small title="' + esc(n) + '">' + esc(n) + '</small></div>';
    }).join('') + '</div>';
    return h;
  }
  elC.addEventListener('click', e => {
    const g = e.target.closest('[data-g]');
    if (g) {
      if (g.dataset.g === 'volta') ui.recuo += 30;
      if (g.dataset.g === 'frente') ui.recuo = Math.max(0, ui.recuo - 30);
      if (g.dataset.g === 'vivo') ui.recuo = 0;
      if (g.dataset.g === 'zoom') ui.janela = ui.janela === 120 ? 600 : ui.janela === 600 ? 30 : 120;
      desenhar(true); return;
    }
    const no = e.target.closest('[data-no]');
    if (no) { ui.selNo = ui.selNo === no.dataset.no ? null : no.dataset.no; desenhar(true); return; }
    const tr = e.target.closest('[data-job]');
    if (tr) { ui.selJob = Number(tr.dataset.job); desenhar(true); return; }
    const sc = e.target.closest('[data-script]');
    if (sc) { ui.script = sc.dataset.script; ui.exec = null; guardar(); desenhar(true); return; }
    const ex = e.target.closest('[data-exec]');
    if (ex) { ui.exec = Number(ex.dataset.exec); desenhar(true); return; }
    const ac = e.target.closest('[data-acao]');
    if (ac) acaoScript(ac.dataset.acao);
  });

  // ---------- 4 scripts ----------
  function execAtual() {
    const ex = (d && d.execucoes) || [];
    if (ui.exec != null) return ex.find(x => x.id === ui.exec) || null;
    const doScript = ex.filter(x => x.nome === ui.script);
    return doScript[doScript.length - 1] || null;
  }
  function colorir(texto) {
    return esc(texto.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')).split('\n').map(l => {
      if (/^\s*\[\d+\/\d+\]/.test(l)) return '<span class="etapa">' + l + '</span>';
      if (/^&gt; /.test(l)) return '<span class="eu">' + l + '</span>';
      if (/(erro|error|falh|fail|FALHA)/i.test(l) && !/0 falha|0 fail/i.test(l)) return '<span class="ruim">' + l + '</span>';
      if (/(\bok\b|\[ OK \]|pass|passed|sucesso|✔)/i.test(l)) return '<span class="bom">' + l + '</span>';
      return l;
    }).join('\n');
  }
  function etapas(texto) {
    const m = [...texto.matchAll(/\[(\d+)\/(\d+)\]/g)].pop();
    const p = [...texto.matchAll(/(\d{1,3})%/g)].pop();
    if (m) return { feito: Number(m[1]), total: Number(m[2]) };
    if (p) return { feito: Number(p[1]), total: 100 };
    return null;
  }
  function montarScripts() {
    elC.innerHTML = '<div class="scr"><div class="lista" id="sl"></div><div><div class="saida" id="so"></div><div class="regua-scr" id="sg"></div>' +
      '<div class="acoes"><button class="b-rodar" data-acao="rodar">► Run</button><button class="b-parar" data-acao="parar">■ Stop</button>' +
      '<input id="si" placeholder="reply to the script, Enter sends"><button class="b-enviar" data-acao="enviar">Send</button><button class="b-limpar" data-acao="limpar">Clear</button>' + q('scripts', 'Scripts') + '</div>' +
      '<div class="estado-scr" id="se"></div></div></div>';
    document.getElementById('si').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); acaoScript('enviar'); } e.stopPropagation(); });
    atualizarScripts();
  }
  function atualizarScripts() {
    const sl = document.getElementById('sl'); if (!sl) return;
    const lista = (d && d.scripts) || [];
    if (!ui.script && lista.length) ui.script = lista[0];
    const execs = (d && d.execucoes) || [];
    sl.innerHTML = (lista.length ? lista.map(n => {
      const roda = execs.some(x => x.nome === n && x.fim == null);
      return '<button data-script="' + esc(n) + '" class="' + (n === ui.script ? 'sel' : '') + '">' + esc(n) + (roda ? '<span class="r">' + GIRO[quadro % 4] + '</span>' : '') + '</button>';
    }).join('') : '<div>No scripts in .scripts</div>') +
      (execs.length ? '<div class="hist">Runs:</div>' + execs.slice().reverse().slice(0, 8).map(x => '<button data-exec="' + x.id + '">' + esc(x.nome) + ' ' + (x.fim == null ? '…' : x.codigo === 0 ? '✓' : '✗') + '</button>').join('') : '');
    const ex = execAtual();
    const so = document.getElementById('so');
    const noFim = so.scrollTop + so.clientHeight >= so.scrollHeight - 20;
    so.innerHTML = ex ? colorir(ex.saida || '') : '<span style="opacity:.6">Pick a script and press Run. The output shows up here, without opening a window.</span>';
    if (noFim) so.scrollTop = so.scrollHeight;
    const et = ex && etapas(ex.saida || '');
    document.getElementById('sg').innerHTML = et ? '[' + blocos(et.feito / et.total * 100, 24) + '] ' + et.feito + '/' + et.total : '';
    document.getElementById('se').textContent = ex ? (ex.fim == null ? 'running for ' + tempo(agora() - ex.inicio) : 'finished in ' + tempo(ex.fim - ex.inicio) + ', exit code ' + ex.codigo) : '';
  }
  function acaoScript(a) {
    const ex = execAtual();
    if (a === 'rodar' && ui.script) { ui.exec = null; vs.postMessage({ tipo: 'rodar', nome: ui.script }); }
    if (a === 'parar' && ex && ex.fim == null) vs.postMessage({ tipo: 'parar', id: ex.id });
    if (a === 'limpar') { ui.exec = null; vs.postMessage({ tipo: 'limpar' }); }
    if (a === 'enviar') {
      const i = document.getElementById('si');
      if (ex && ex.fim == null && i.value) { vs.postMessage({ tipo: 'responder', id: ex.id, texto: i.value }); i.value = ''; }
    }
  }

  // ---------- 5 system ----------
  function telaMaquina() {
    const m = (d && d.maquina) || { nucleos: [], mem: 0 };
    const s = sessao();
    const lin = (r, pct, txt, alerta) => '<div class="lin' + (alerta ? ' alerta' : '') + '"><span>' + r + '</span><span class="barra">' + blocos(pct, 16) + '</span><span>' + (txt == null ? pct + '%' : txt) + '</span></div>';
    let h = '<div class="cartoes"><div class="cartao"><h4> CPU (' + m.nucleos.length + ' cores) ' + q('cpu', 'CPU') + '</h4>' + m.nucleos.map((p, i) => lin('core ' + i, p)).join('') + '</div>';
    h += '<div class="cartao"><h4> MEMORY AND DISK ' + q('memdisco', 'Memory and disk') + '</h4>' + lin('RAM', m.mem, m.mem + '%', m.mem >= 90) + '<div style="opacity:.8">' + m.memTotalGb + ' GB total</div>' +
      (m.disco ? lin('disk', m.disco.pct, m.disco.pct + '%', m.disco.pct >= 90) + '<div style="opacity:.8">' + m.disco.livreGb + ' GB free</div>' : '') + '</div>';
    if (s) {
      const nomes = { five_hour: '5 hours', seven_day: '7 days', seven_day_opus: '7 days Opus', spend_limit: 'spend' };
      h += '<div class="cartao"><h4> CLAUDE ' + q('claude', 'Claude') + '</h4><div class="grande">' + (s.custo == null ? '--' : Number(s.custo).toFixed(2)) + ' <small style="font-size:.5em;color:#ccc">USD est.</small></div>' +
        lin('context', s.ctx || 0, s.ctx == null ? '--' : s.ctx + '%', (s.ctx || 0) >= 80) +
        (s.limites || []).map(l => lin(nomes[l.nome] || l.nome, Math.round(l.pct), Math.round(l.pct) + '%', l.pct >= 80)).join('') +
        '<div style="opacity:.8">' + mdl(s.modelo) + ' ' + esc(String(s.effort || '').toUpperCase()) + ' · mode ' + esc(s.modo || '') + '</div></div>';
    } else {
      h += '<div class="cartao"><h4> CLAUDE ' + q('claude', 'Claude') + '</h4><div>No session recorded in this project.</div></div>';
    }
    return h + '</div>';
  }

  // ---------- 6 context ----------
  const cont = () => (vivo() && vivo().continuidade) || null;
  // fraction of the context still left until automatic compaction (0 to 1), or null
  function folga() {
    const c = cont();
    if (!c || c.livre == null || !c.janela) return null;
    return c.livre / c.janela;
  }
  let bipou = false;
  function bipe() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach(t => {
        const o = a.createOscillator(); const g = a.createGain();
        o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.05;
        o.connect(g); g.connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.1);
      });
    } catch { /* no audio */ }
  }
  function telaContexto() {
    const c = cont();
    const s = sessao();
    const conv = (d && d.conversas) || { abertas: [], arquivadas: [] };
    const nf = n => n == null ? '--' : Number(n).toLocaleString('en-US');
    const lin = (r, pct, txt, alerta, larg) => '<div class="lin' + (alerta ? ' alerta' : '') + '"><span>' + r + '</span><span class="barra">' + blocos(pct, larg || 16) + '</span><span>' + txt + '</span></div>';
    let h = '<div class="cartoes">';

    // conversation map
    const caixas = [];
    for (const a of conv.arquivadas) caixas.push('<div class="no feito" title="closed at ' + new Date(a.fechada).toLocaleTimeString('en-GB') + '"><div class="t">' + esc(a.rotulo) + '</div><div class="m">archived</div></div>');
    conv.abertas.forEach((a, i) => {
      const ultima = i === conv.abertas.length - 1;
      caixas.push('<div class="no' + (a.ativa ? ' principal' : '') + '"><div class="t">' + esc(a.rotulo) + (a.ativa ? ' ●' : '') + '</div><div class="m">' + (a.ativa ? 'active' : 'open') + (ultima && s ? ' · ctx ' + (s.ctx == null ? '--' : s.ctx + '%') : '') + '</div></div>');
    });
    const ROT = { automatica: 'automatic', botao: 'button only' };
    h += '<div class="cartao" style="grid-column:1/-1"><h4> CONVERSATION MAP (' + conv.abertas.length + ' of ' + 3 + ' open) ' + q('cadeia', 'Conversation map') + '</h4>' +
      (caixas.length ? '<div class="cadeia">' + caixas.join('<span class="elo">─ handoff ─►</span>') + '</div>' : '<div>No Claude conversation open in a tab.</div>') +
      '<div class="acoes"><button class="b-rodar" data-r="rotacionar">► Rotate now to a new tab</button><button class="b-limpar" data-r="reabrir">Reopen closed conversation</button>' +
      '<span>' + (d && d.fichaPendente ? '<span style="color:#FFFF55">handoff card pending: goes into the next conversation</span>' : 'rotation ' + esc(ROT[d && d.rotacao] || (d && d.rotacao) || '')) + '</span></div></div>';

    // until compaction
    const f = folga();
    const pctUso = s && s.ctx != null ? s.ctx : (c && c.janela && c.usados != null ? Math.round(100 * c.usados / c.janela) : null);
    const critico = f != null && f < 0.03;
    if (critico && !bipou) { bipou = true; bipe(); }
    if (!critico) bipou = false;
    h += '<div class="cartao' + (critico ? ' alerta' : '') + '"><h4> UNTIL COMPACTION ' + q('compacta', 'Until compaction') + '</h4>' +
      '<div class="grande">' + nf(c && c.livre) + ' <small style="font-size:.5em;color:#ccc">tokens</small></div>' +
      lin('window', pctUso || 0, pctUso == null ? '--' : pctUso + '%', (pctUso || 0) >= 85) +
      (c && c.janela ? lin('reserve', 100 * (c.reserva || 0) / c.janela, Math.round(100 * (c.reserva || 0) / c.janela) + '%') : '') +
      '<div style="color:' + (critico ? '#FF5555' : (pctUso || 0) >= 75 ? '#FFAA00' : '#ccc') + '">' +
      (critico ? 'Less than 3% left: rotate to a new tab now.' : (pctUso || 0) >= 85 ? 'Final handoff card written; rotation at the next pause.' : (pctUso || 0) >= 60 ? 'Handoff card already written.' : 'Comfortable headroom.') + '</div></div>';

    // cache
    h += '<div class="cartao"><h4> CACHE ' + q('cache', 'Cache') + '</h4>' +
      (c && c.cacheRodada != null ? lin('this turn', c.cacheRodada, c.cacheRodada + '%') + lin('session', c.cacheSessao || 0, (c.cacheSessao || 0) + '%') : '<div>Waiting for the first turn.</div>') +
      '<div style="opacity:.85">High cache: cheaper and faster turns.</div></div>';

    // what fills the context
    const cats = (c && c.categorias) || [];
    const totalUsado = cats.reduce((n, x) => n + x.tokens, 0) || 1;
    h += '<div class="cartao"><h4> WHAT FILLS THE CONTEXT ' + q('ocupa', 'What fills the context') + '</h4>' +
      (cats.length ? cats.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 7).map(x => lin(esc(x.nome).slice(0, 14), 100 * x.tokens / totalUsado, Math.round(100 * x.tokens / totalUsado) + '%', false, 12)).join('') : '<div>Waiting for the first turn.</div>') + '</div>';

    // memory budget
    h += '<div class="cartao"><h4> MEMORY (BUDGET) ' + q('orcamento', 'Memory budget') + '</h4>' + ((d && d.orcamento) || []).map(o => {
      if (o.valor == null) return lin(o.nome, 0, '--');
      const pct = Math.round(100 * o.valor / o.teto);
      const txt = o.unidade === 'bytes' ? (o.valor / 1024).toFixed(1) + ' KB' : o.valor + ' lines';
      return lin(o.nome, Math.min(100, pct), txt, pct > 100);
    }).join('') + (((d && d.orcamento) || []).some(o => o.valor != null && o.valor > o.teto) ? '<div style="color:#FFAA00">Over the limit: ask for /m80-faxina.</div>' : '<div style="opacity:.85">Within budget.</div>') + '</div>';

    // tabs and VS Code
    const lim = conv.limiteAbas || 10;
    const maxC = Number((d && d.config && d.config.maxConversas) || 3);
    h += '<div class="cartao"><h4> TABS AND VS CODE ' + q('abasvs', 'Tabs and VS Code') + '</h4>' +
      lin('conversations', 100 * conv.abertas.length / maxC, conv.abertas.length + ' of ' + maxC, conv.abertas.length > maxC) +
      lin('tabs', 100 * (conv.totalAbas || 0) / lim, (conv.totalAbas || 0) + ' of ' + lim, (conv.totalAbas || 0) > lim) +
      (d && d.memoriaCode != null ? lin('memory', Math.min(100, 100 * d.memoriaCode / 8), String(d.memoriaCode) + ' GB', d.memoriaCode > 6) : '') + '</div>';

    // history
    h += '<div class="cartao"><h4> HISTORY ' + q('historico', 'History') + '</h4>' +
      '<div>Compactions in this conversation: <span style="color:#FFFF55">' + ((c && c.compactacoes) || 0) + '</span></div>' +
      '<div>Last handoff card: <span style="color:#FFFF55">' + (c && c.ultimaFicha ? new Date(c.ultimaFicha).toLocaleTimeString('en-GB') : 'none') + '</span></div>' +
      '<div>Milestones reached: ' + (c && c.marcos && c.marcos.length ? c.marcos.map(m => m + '%').join(', ') : 'none') + '</div>' +
      '<div style="opacity:.85">Handoff card in .sessions/continuidade.md</div></div>';
    return h + '</div>';
  }
  elC.addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (b) vs.postMessage({ tipo: b.dataset.r });
  });

  // ---------- animation: respects "reduce motion", but the user can turn it on ----------
  function podeAnimar() {
    const a = (d && d.animar) || 'sistema';
    if (a === 'sempre') return true;
    if (a === 'nunca') return false;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- map with log console and effect menu ----------
  const EFEITOS = [['nenhum', 'None']].concat(window.M80Mapa.efeitos());
  // the printer stopped being an effect: it became the fixed look of the console; anyone who had it saved falls back to the trash
  const efAtual = () => { const v = (d && d.efeito) || 'lixeira'; return EFEITOS.some(x => x[0] === v) ? v : 'lixeira'; };
  ui.filtro = ui.filtro || 'tudo';
  ui.pausa = false;
  let congelado = null;
  const impressas = new Set();
  let primeiraImpressao = true, ultimaAssinatura = '';
  function linhasConsole() {
    const L = [];
    const v = vivo();
    for (const e of ((v && v.eventos) || []).slice(-40)) {
      const h = new Date(e.ini).toLocaleTimeString('en-GB');
      const quem = (e.agente === 'principal' ? '' : '(' + e.agente.slice(0, 6) + ')') + e.tool;
      L.push({ t: e.ini, tipo: 'ferr', tool: e.tool,
        cols: [quem, e.detalhe || '', e.fim == null ? '--:--' : tempo(e.fim - e.ini), e.fim == null ? '...' : e.ok === false ? 'ERROR' : 'OK'], txt: h + ' [motor] ' + (e.agente === 'principal' ? '' : '(' + e.agente.slice(0, 6) + ') ') + e.tool + (e.detalhe ? ' ▸ ' + e.detalhe : '') + (e.fim == null ? ' …' : e.ok === false ? ' ✗' : ' ✓') });
    }
    for (const l of (d && d.logs) || []) {
      // internal noise from the Claude panel: render measurements and webview message echo
      if (/\[DEBUG\]|Received message from webview/.test(l)) continue;
      const m =l.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)\.\d+ \[(\w+)\] (.*)$/);
      const nivel = m ? m[3].toLowerCase() : 'info';
      const corpo = m ? m[4].replace(/^From claude: \S+ /, '') : l;
      const aviso = /warn|error/i.test(nivel) || /\[(WARN|ERROR)\]/.test(corpo);
      const quando = m ? Date.parse(m[1] + 'T' + m[2]) : 0;
      L.push({ t: quando, tipo: aviso ? 'aviso' : 'claude', cols: [aviso ? 'WARNING' : 'CLAUDE', corpo, m ? m[2].slice(0, 5) : '', ''], txt: (m ? m[2] : '') + ' [claude] ' + corpo });
    }
    for (const x of errosTela) L.push({ t: Date.now(), tipo: 'aviso', cols: ['WARNING', x, '', ''], txt: x });
    L.sort((a, b) => a.t - b.t);
    return L.filter(x => ui.filtro === 'tudo' || (ui.filtro === 'ferr' && x.tipo === 'ferr') || (ui.filtro === 'claude' && x.tipo === 'claude') || (ui.filtro === 'aviso' && x.tipo === 'aviso')).slice(-120);
  }
  // The frame (effect menu, button, console bar) is mounted once; the 1 s cycle only swaps
  // the map body and the console lines. Remounting everything closed the open <select> and swallowed clicks.
  function montarMapa() {
    // v3: territorial Map, arcade window and themes come from the monitor-mapa.js module (ported from the prototype)
    // effect, shape and animations live in the Settings tab; here only the notice when animations are off
    elC.innerHTML = '<div class="mapa-cons"><div class="mapa-area" id="mapa-area">' +
      '<div class="ef-menu" id="b-anim-aviso" hidden>Animations turned off by Windows. <button data-anim="sempre" class="b-rodar">▶ turn animations on</button></div>' +
      '<div id="mapa-v3"></div>' + q('mapa', 'Map').replace('class="q"', 'class="q q-mapa"') + '</div>' +
      // console in dot-matrix printer format: head bar + striped continuous form
      '<div class="cons"><div class="cons-barra" id="cons-barra"></div><div class="cabeca" id="cabeca"><span class="agulha"></span></div><div class="cons-linhas formulario" id="cl"></div></div></div>';
    window.M80Mapa.montar(document.getElementById('mapa-v3'), layoutMontado || 'sinotico');
  }
  function atualizarMapa() {
    const ligado = podeAnimar();
    document.getElementById('b-anim-aviso').hidden = ligado;
    window.M80Mapa.animar(ligado);
    window.M80Mapa.escolherEfeito(efAtual());
    window.M80Mapa.atualizar(d);
    // validation log: on every change, what the motor recorded and what the view shows (.sessions/m80-mapa.log)
    try {
      const vivo = d.vivo || {}, evs = vivo.eventos || [];
      const linha = { motor: { estado: (vivo.sessao || {}).estado || '', eventos: evs.length, semFim: evs.filter(e => e.fim == null).map(e => e.tool + '#' + e.id) }, painel: window.M80Mapa.resumo() };
      const chave = JSON.stringify(linha);
      if (chave !== ultimoLogMapa) { ultimoLogMapa = chave; vs.postMessage({ tipo: 'logMapa', linha }); }
    } catch (e) { /* the log never takes the tab down */ }
    // the Log "?" stays out of the innerHTML redone every second (otherwise it would lose focus)
    const barra = document.getElementById('cons-barra');
    if (!barra.querySelector('[data-h]')) barra.innerHTML = '<span id="cons-filtros" style="display:contents"></span>' + q('log', 'Log');
    document.getElementById('cons-filtros').innerHTML = [['tudo', 'All'], ['ferr', 'Tools'], ['claude', 'Claude'], ['aviso', 'Warnings']].map(([k, n]) => '<button data-filtro="' + k + '" class="' + (ui.filtro === k ? 'on' : '') + '">' + n + '</button>').join('') +
      '<button data-filtro="pausa" class="' + (ui.pausa ? 'on' : '') + '">' + (ui.pausa ? '▶ resume' : '⏸ pause') + '</button>';
    const L = ui.pausa && congelado ? congelado : linhasConsole();
    if (!ui.pausa) congelado = L;
    const cl = document.getElementById('cl');
    // only reprints when some line changes; redrawing every second would cut the typing in the middle
    const s0 = sessao();
    const assinatura = L.map(x => x.t + '|' + x.txt).join('\n') + '|' + (s0 && s0.estado);
    if (assinatura === ultimaAssinatura && cl.childElementCount) return;
    ultimaAssinatura = assinatura;
    // Data-center report as fixed-width running text: no. · tool · detail · duration · status.
    // New lines do not appear ready: they join the queue and the head prints letter by letter (imprimir()).
    // Same as the prototype: running text with "by hand" spacing. Tool in 7 columns (a longer name pushes the rest),
    // detail width varies a little from line to line; so duration and OK come out slightly crooked.
    // Dark ink everywhere; only the tool name, ERROR and WARNING come out in color.
    const larg = colunasPapel(cl);
    const dW = Math.max(14, Math.min(30, larg - 30));
    const minimo = (v, n) => String(v) + ' '.repeat(Math.max(1, n - String(v).length));
    let num = 0;
    const papel = L.filter(x => !(x.cols && x.cols[3] === '...')).map(x => {
      const c = x.cols || ['', x.txt, '', ''];
      const n = x.tipo === 'ferr' ? String(++num).padStart(4, '0') : '    ';
      const det = String(c[1]).slice(0, dW);
      const folga = (det.length + c[0].length) % 3; // 0 to 2 extra spaces: the slight misalignment of the prototype
      const inicio = n + '  ' + minimo(c[0], 7) + ' ';
      const txt = inicio + minimo(det, dW + folga) + (c[2] ? '  ' + c[2] : '') + (c[3] ? '  ' + c[3] : '');
      const segs = [];
      if (x.tipo === 'ferr') segs.push([n.length + 2, n.length + 2 + c[0].length, 'tk-' + classeFerr(x.tool).slice(2)]);
      if (c[3] === 'ERROR') segs.push([txt.length - 5, txt.length, 'tk-erro']);
      return { k: x.t + '|' + x.txt, cls: 'c-' + x.tipo, title: x.txt, txt, segs };
    });
    // end of turn: cut line with the total, as in the prototype
    const s = sessao();
    const nFerr = L.filter(x => x.tipo === 'ferr').length;
    if (s && s.estado === 'pronto' && nFerr)
      papel.push({ k: 'corte|' + nFerr + '|' + (L.length ? L[L.length - 1].t : 0), cls: 'corte', title: '', segs: [], txt: '- '.repeat(20) + ' TOTAL ' + nFerr + ' ACTIONS' });
    // on the first read, with animation off or when switching filter, the paper comes out ready, with no queue
    const semFila = primeiraImpressao || !podeAnimar() || ui.filtro !== filtroImpresso;
    filtroImpresso = ui.filtro;
    if (d) primeiraImpressao = false; // before data arrives it does not count: the opening history comes out ready
    for (const p of papel) {
      if (impressas.has(p.k) || (digitando && digitando.k === p.k) || filaPapel.some(q => q.k === p.k)) continue;
      if (semFila) impressas.add(p.k); else filaPapel.push(p);
    }
    linhasPapel = papel;
    montarPapel();
  }
  // paper width in characters, measured with the font itself
  let larguraCar = 0;
  function colunasPapel(cl) {
    if (!larguraCar) { const s = document.createElement('span'); s.className = 'cln'; s.style.position = 'absolute'; s.style.visibility = 'hidden'; s.textContent = 'M'.repeat(40); cl.appendChild(s); larguraCar = s.getBoundingClientRect().width / 40 || 9; s.remove(); }
    return Math.max(40, Math.floor((cl.clientWidth - 24) / larguraCar));
  }
  let filaPapel = [], digitando = null, linhasPapel = [], filtroImpresso = null;
  // line text up to 'ate' characters, colored only on the marked spans (tool name, ERROR)
  function pintar(p, ate) {
    let h = '', i = 0;
    for (const [a, b, cls] of (p.segs || []).slice().sort((x, y) => x[0] - y[0])) {
      if (a >= ate) break;
      h += esc(p.txt.slice(i, a)) + '<span class="' + cls + '">' + esc(p.txt.slice(a, Math.min(b, ate))) + '</span>';
      i = Math.min(b, ate);
    }
    return h + esc(p.txt.slice(i, ate));
  }
  function montarPapel() {
    const cl = document.getElementById('cl'); if (!cl) return;
    const prontas = linhasPapel.filter(p => impressas.has(p.k));
    let h = prontas.map(p => '<div class="cln ' + p.cls + '" title="' + esc(p.title) + '">' + pintar(p, p.txt.length) + '</div>').join('');
    if (digitando) h += '<div class="cln ' + digitando.cls + '" id="dig">' + pintar(digitando, digitando.pos) + '<span class="cursor">▌</span></div>';
    else if (!prontas.length) h = '<div class="cln c-claude">No lines yet.<span class="cursor">▌</span></div>';
    else h = h.replace(/<\/div>$/, '<span class="cursor">▌</span></div>');
    cl.innerHTML = h;
    if (!ui.pausa) cl.scrollTop = cl.scrollHeight;
    if (impressas.size > 600) { impressas.clear(); linhasPapel.forEach(p => impressas.add(p.k)); }
  }
  // the print head: one character every 30 ms (several at once if the queue grows); the paper moves up on each line
  setInterval(() => {
    if (ui.aba !== 'mapa') return;
    const cab = document.querySelector('#cabeca .agulha');
    if (!digitando) {
      if (!filaPapel.length) return;
      digitando = Object.assign({ pos: 0 }, filaPapel.shift());
      montarPapel();
    }
    const passo = filaPapel.length > 6 ? 6 : filaPapel.length > 2 ? 3 : 1;
    digitando.pos = Math.min(digitando.txt.length, digitando.pos + passo);
    const el = document.getElementById('dig');
    if (el) el.innerHTML = pintar(digitando, digitando.pos) + '<span class="cursor">▌</span>';
    if (cab) cab.style.left = 'calc(' + (digitando.pos / Math.max(1, digitando.txt.length) * 100) + '% - ' + (digitando.pos / Math.max(1, digitando.txt.length) * 30) + 'px)';
    if (digitando.pos >= digitando.txt.length) { impressas.add(digitando.k); digitando = null; montarPapel(); }
  }, 30);
  elC.addEventListener('click', e => {
    const f = e.target.closest('[data-filtro]');
    if (f) { if (f.dataset.filtro === 'pausa') ui.pausa = !ui.pausa; else ui.filtro = f.dataset.filtro; desenhar(true); return; }
    const a = e.target.closest('[data-anim]');
    if (a) vs.postMessage({ tipo: 'animar', valor: a.dataset.anim });
  });
  // switching the effect immediately shows a preview with three sample blocks, without waiting for a tool to finish
  elC.addEventListener('change', e => {
    if (!(e.target && e.target.id === 'ef-sel')) return;
    const v = e.target.value;
    vs.postMessage({ tipo: 'efeito', valor: v });
    if (d) d.efeito = v;
    previa(v);
  });
  function previa(v) {
    if (!podeAnimar() || v === 'nenhum') return;
    window.M80Mapa.previa(v);
  }

  // ---------- effects when a tool finishes ----------
  const vistosFim = new Set();
  let primeiraLeitura = true;
  function detectarFins() {
    const v = vivo();
    const evs = ((v && v.eventos) || []).filter(e => e.agente === 'principal' && e.fim != null);
    // the motor restarts the event numbering every turn: the key needs the start time
    const chave = e => e.id + '@' + e.ini;
    const novos = evs.filter(e => !vistosFim.has(chave(e)));
    novos.forEach(e => vistosFim.add(chave(e)));
    const ef = efAtual();
    if (primeiraLeitura) { primeiraLeitura = false; return; }
    if (ui.aba !== 'mapa' || !podeAnimar()) return;
    novos.slice(-3).forEach(e => window.M80Mapa.fim(e, ef));
  }
  // ---------- pop-up for the task in progress ----------
  let statusAntes = null;
  const fila = [];
  function detectarTarefas() {
    const ts = (d && d.tarefas) || [];
    const agora = {}; ts.forEach(t => { agora[t.id] = t.status; });
    if (statusAntes) {
      for (const t of ts) {
        const antes = statusAntes[t.id];
        if (t.status === 'in_progress' && antes !== 'in_progress') popup(t, false);
        else if (t.status === 'completed' && antes && antes !== 'completed') popup(t, true);
      }
    }
    statusAntes = agora;
  }
  function popup(t, feita) {
    let j = document.getElementById('pop');
    if (!j) { document.body.insertAdjacentHTML('beforeend', '<div id="pop" class="pop"></div><div id="filapop" class="filapop"></div>'); j = document.getElementById('pop'); }
    const ts = (d && d.tarefas) || [];
    const feitas = ts.filter(x => x.status === 'completed').length;
    j.innerHTML = '<div class="pop-t"><span>TASK #' + esc(t.id) + (feita ? ' · DONE' : ' · IN PROGRESS') + '</span><span>■</span></div>' +
      '<div class="pop-c"><div class="pop-a">' + esc(feita ? t.assunto : (t.ativo || t.assunto)) + '</div>' + (feita ? '' : '<div class="pop-d">' + esc(t.assunto) + '</div>') +
      '<div>list [' + blocos(100 * feitas / Math.max(1, ts.length), 16) + '] ' + feitas + '/' + ts.length + '</div></div>' + (feita ? '<div class="carimbo">DONE</div>' : '');
    j.classList.remove('aberta'); void j.offsetWidth; j.classList.add('aberta');
    clearTimeout(j._t);
    j._t = setTimeout(() => {
      j.classList.remove('aberta');
      fila.push((feita ? '✓ #' : '… #') + t.id);
      while (fila.length > 5) fila.shift();
      document.getElementById('filapop').innerHTML = fila.map(x => '<div class="' + (x[0] === '✓' ? 'feito' : '') + '">' + esc(x) + '</div>').join('');
    }, feita ? 3500 : 6000);
  }

  // ---------- Savings ----------
  // prices per million tokens (official claude-api reference, table of 2026-11-03)
  // Haiku 5.5: the reference has no cache-read price, so it stays out of the cache calculation
  const PRECO = { opus: { e: 4, s: 20, c: 0.2 }, sonnet: { e: 2, s: 10, c: 0.1 }, haiku: { e: 0.1, s: 0.5, c: null } };
  function telaEconomia() {
    const c = cont() || {};
    const pm = c.porModelo || {};
    const r = d && d.rtk;
    const usd = n => '$' + n.toFixed(2);
    const lin = (rot, pct, txt) => '<div class="lin"><span>' + rot + '</span><span class="barra">' + blocos(pct, 14) + '</span><span>' + txt + '</span></div>';
    // cache: each token read from the cache cost the read price instead of the input price
    let cacheTok = 0, cacheUsd = 0, rotUsd = 0, rodadas = 0;
    const porRod = {};
    for (const [m, t] of Object.entries(pm)) {
      const p = PRECO[m]; if (!p) continue;
      cacheTok += t.cacheLido;
      if (p.c != null) cacheUsd += t.cacheLido * (p.e - p.c) / 1e6;
      rodadas += t.rodadas; porRod[m] = t.rodadas;
      if (m !== 'opus') rotUsd += (t.entrada * (PRECO.opus.e - p.e) + t.saida * (PRECO.opus.s - p.s) + (p.c != null ? t.cacheLido * (PRECO.opus.c - p.c) : 0)) / 1e6;
    }
    const rtkUsd = r && r.poupados ? r.poupados * PRECO.opus.e / 1e6 : 0;
    const total = cacheUsd + rotUsd + rtkUsd;
    const s = sessao();
    let h = '<div class="cartoes">';
    h += '<div class="cartao"><h4> TOTAL SAVED THIS SESSION ' + q('total', 'Total saved') + '</h4><div class="grande">' + usd(total) + '</div><div>cache ' + usd(cacheUsd) + ' · router ' + usd(rotUsd) + ' · rtk ' + usd(rtkUsd) + '</div>' +
      (s && s.custo != null ? '<div>session cost: ' + usd(Number(s.custo)) + ' (Claude estimate)</div>' : '') + '<div style="opacity:.75">estimate with the official prices of 2026-11-03</div></div>';
    h += '<div class="cartao"><h4> RTK: COMMAND OUTPUT ' + q('rtk', 'RTK') + '</h4>' + (r ? '<div class="grande">' + Number(r.poupados || 0).toLocaleString('en-US') + ' <small style="font-size:.5em">tokens</small></div>' + lin('savings', r.pct || 0, String(r.pct) + '%') + '<div>' + r.comandos + ' commands (all sessions)</div>' + (r.top || []).slice(0, 4).map(t => '<div style="opacity:.85">' + esc(t.cmd.slice(0, 22)) + ' · ' + t.poupados + ' tok</div>').join('') : '<div>No rtk reading yet.</div>') + '</div>';
    h += '<div class="cartao"><h4> PROMPT CACHE ' + q('cacheprompt', 'Prompt cache') + '</h4><div class="grande">' + (cacheTok / 1000).toFixed(0) + 'k <small style="font-size:.5em">read from cache</small></div>' + lin('hit rate', c.cacheSessao || 0, (c.cacheSessao || 0) + '%') + '<div>cache reads cost 5% of normal input</div></div>';
    h += '<div class="cartao"><h4> MODEL ROUTER ' + q('roteador', 'Model router') + '</h4>' + (rodadas ? Object.entries(porRod).map(([m, n]) => lin(m, 100 * n / rodadas, Math.round(100 * n / rodadas) + '%')).join('') + '<div>' + rodadas + ' turns measured this session</div>' : '<div>Waiting for measured turns.</div>') + '</div>';
    return h + '</div>';
  }

  // ---------- About: BIOS SYSTEM INFO (proposal C approved in the mockup 2026-11-22-aba-sobre.html) ----------
  // Versions and states come from d.sobre (read by the extension from the installed files); what could not be checked shows "—".
  const HOOKS_DESC = { 'iniciar-projeto': 'sets up the new project', 'continuidade': 'injects the handoff card', 'verificar-afirmacoes': 'blocks claims without proof', 'portao-tarefa': 'task only closes with a test', 'guardiao-regras': 'commit, push and delete only on request' };
  // the values of /m80-modo and /m80-barra are command arguments: they do not change
  const CMDS = [['/m80-modo', 'auto · economico · normal · maximo · fixo'], ['/m80-status', 'the router decision'], ['/m80-barra', 'dbase · scoreboard · lotus · turbo · medidor'], ['/m80-ficha', 'writes the handoff card now'], ['/m80-continuar', 'moves to a new conversation'], ['/m80-faxina', 'cleans up the memory budget']];
  const vers = () => { const s = (d && d.sobre) || {}; return { tpl: s.tpl || '—', ext: s.ext || '—', motor: s.motor || '—' }; };
  function kv(k, v, e) { return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="pt"></span><span class="v">' + esc(v) + '</span>' + (e !== undefined ? '<span class="e ' + (e === true ? 'ok' : 'av') + '">' + (e === true ? '[OK]' : e === false ? '[--]' : '—') + '</span>' : '') + '</div>'; }
  function telaSobre() {
    const s = (d && d.sobre) || {};
    const V = vers();
    const hooks = s.hooks || [];
    const ag = s.agentes;
    const curto = n => n.length > 7 ? n.slice(0, 5) : n;
    const nEf = window.M80Mapa ? window.M80Mapa.efeitos().length : 0;
    const nLay = window.M80Mapa ? window.M80Mapa.layouts().length : 0;
    const docs = s.docs || {};
    const tecla = (k, f, rot) => '<span data-doc="' + k + '"' + (docs[k] ? '' : ' class="apag" title="file not found"') + '><b>' + f + '</b> ' + rot + '</span>';
    const hOk = hooks.filter(h => h.ok).length;
    return '<div class="pc">' +
      '<div class="bios-cab">M80 SYSTEM INFO  ·  TEMPLATE ' + esc(V.tpl.toUpperCase()) + '  <small>(C) 1987-2026 M80 Software · M80 Mainframe extension console</small></div>' +
      '<div class="bios">' +
        '<div><h3>COMPONENTS ' + q('componentes', 'Components') + '</h3>' + kv('M80 Template', V.tpl, s.tplOk === true ? true : null) + kv('M80 Mainframe (extension)', V.ext, s.extOk === true ? true : null) +
          kv('m80-motor (plugin)', V.motor, s.motorOk == null ? null : s.motorOk) +
          kv('Looks', s.visuais ? 'F1–F' + s.visuais + ' · ' + s.visuais : '—', s.visuaisOk == null ? null : s.visuaisOk) +
          kv('Arcade 2600', nEf ? nEf + ' games' : '—', nEf ? true : null) + kv('Map views', nLay ? String(nLay) : '—', nLay ? true : null) +
          kv('Agents', ag && ag.length ? ag.map(curto).join(' · ') : '—', ag && ag.length ? true : null) + '</div>' +
        '<div class="c2"><h3>GLOBAL HOOKS  ·  ~/.claude/hooks/m80 ' + q('hooks', 'Global hooks') + '</h3>' + hooks.map(h => kv(h.nome, h.evento || '—', h.ok ? true : null)).join('') +
          '<h3 style="margin-top:4px">THIRD-PARTY ' + q('terceiros', 'Third-party') + '</h3><div class="linha">' + ((s.terceiros || []).length ? s.terceiros.map(t => '<span class="' + (t.ok ? '' : 'apag') + '">' + esc(t.nome) + '</span>').join(' · ') : '—') + '</div></div>' +
        '<div class="c3"><h3>COMMANDS ' + q('comandos', 'Commands') + '</h3>' + CMDS.map(c => kv(c[0], c[1].split(' · ')[0])).join('') +
          '<h3 style="margin-top:4px">KEYS ' + q('teclas', 'Keys') + '</h3>' + kv('Console', 'Ctrl+Alt+O') + '</div>' +
      '</div>' +
      '<div class="bios-pe">' + tecla('readme', 'F1', 'README') + tecla('changelog', 'F2', 'CHANGELOG') + tecla('motor', 'F3', 'motor/README') + '<span data-f10><b>F10</b> Settings</span>' +
        '<span class="sum dir">Template ' + esc(V.tpl) + ' · M80 Mainframe ' + esc(V.ext) + ' · m80-motor ' + esc(V.motor) + ' · ' + hOk + ' hooks · ' + (ag ? ag.length : '—') + ' agents</span></div>' +
    '</div>';
  }
  function marcaVersao() {
    const V = vers();
    return '<span class="marca"><span class="longo">M80 <b>' + esc(V.tpl) + '</b> · ext ' + esc(V.ext) + ' · motor ' + esc(V.motor) + '</span><span class="curto">' + esc(V.tpl) + '·' + esc(V.ext) + '·' + esc(V.motor) + '</span></span>';
  }
  const DOC_TECLA = { F1: 'readme', F2: 'changelog', F3: 'motor' };
  function irConfig() { ui.aba = 'config'; guardar(); desenhar(true); }

  // ---------- Settings: mounted once (selects are never recreated while open) ----------
  const VISUAIS = [['clipper', 'F1', 'Clipper Summer 87'], ['turbo', 'F2', 'Turbo Pascal 7'], ['norton', 'F3', 'Norton Commander 5'], ['fosforo', 'F4', 'Green Phosphor'], ['ambar', 'F5', 'dBase Amber'], ['laplink', 'F6', 'LapLink'], ['manifest', 'F7', 'Quarterdeck Manifest'], ['graphite', '', 'Graphite'], ['midnight', '', 'Midnight'], ['daylight', '', 'Daylight'], ['porcelain', '', 'Porcelain'], ['forest', '', 'Forest'], ['dusk', '', 'Dusk'], ['ember', '', 'Ember'], ['ocean', '', 'Ocean'], ['contrast', '', 'Contrast'], ['mist', '', 'Mist']];
  // the theme name in VS Code is an identifier (workbench.colorTheme) and stays pt-BR; on screen, English
  const NOME_TEMA = [[/Fosforo Verde/, 'Green Phosphor'], [/Ambar dBase III/, 'dBase III Amber'], [/LapLink Papel Branco/, 'LapLink White Paper'], [/ Suave$/, ' Soft']];
  const nomeTema = n => NOME_TEMA.reduce((s, [re, en]) => s.replace(re, en), String(n || ''));
  const opcoes = lista => lista.map(([k, n]) => '<option value="' + esc(k) + '">' + esc(n) + '</option>').join('');
  function montarConfig() {
    elC.innerHTML = '<div class="cfg">' +
      '<div class="cartao"><h4> VS CODE LOOK ' + q('look', 'VS Code look') + '</h4><div class="cfg-vis">' +
        VISUAIS.map(([k, t, n]) => '<button class="vis" data-cmd="m80.visual.' + k + '" data-v="' + k + '"><span class="k">' + t + '</span> ' + n + '</button>').join('') +
        '</div><div class="cfg-linha"><button data-cmd="m80.alternarSuave">◐ toggle original / soft</button></div><div class="cfg-nota" id="cfg-tema"></div></div>' +
      '<div class="cartao"><h4> MAP LAYOUT ' + q('layout', 'Map layout') + '</h4><select id="cfg-layout" data-cfg="monitor.layout">' + opcoes(window.M80Mapa.layouts()) + '</select>' +
        '<div class="cfg-nota">The game always has its own area; nothing covers the map. Default: Signal box panel.</div></div>' +
      '<div class="cartao"><h4> CONSOLE SHAPE ' + q('shape', 'Console shape') + '</h4><select id="cfg-forma" data-cfg="monitor.forma">' + opcoes(window.M80Mapa.formas()) + '</select>' +
        '<div class="cfg-nota">Colors always come from the active theme. The shape changes borders, map, session marker, paper and effects. On Automatic, each M80 look uses its own.</div></div>' +
      '<div class="cartao"><h4> ARCADE ' + q('arcade', 'Arcade') + '</h4><div class="cfg-linha">Effect <select id="ef-sel">' + opcoes(EFEITOS) + '</select> <button data-testar class="b-rodar">▶ test</button> ' + q('jogo', 'selected game') + '</div>' +
        '<div class="cfg-linha">Arcade window in the Map <span id="cfg-arc">' + [['shown', 'Shown'], ['hidden', 'Hidden']].map(([k, n]) => '<button data-cfgv="monitor.arcade" data-valor="' + k + '">' + n + '</button>').join('') + '</span></div>' +
        '<div class="cfg-nota">Hidden: the Map takes the space of the game window. The preview below stays here so you can still test the games.</div>' +
        '<div class="cfg-janela">' + window.M80Mapa.janela() + '</div></div>' +
      '<div class="cartao"><h4> ANIMATIONS ' + q('anim', 'Animations') + '</h4><div class="cfg-linha" id="cfg-anim">' +
        [['sistema', 'follow Windows'], ['sempre', 'always'], ['nunca', 'never']].map(([k, n]) => '<button data-cfgv="efeitos.animar" data-valor="' + k + '">' + n + '</button>').join('') +
        '</div><div class="cfg-nota" id="cfg-anim-nota"></div></div>' +
      '<div class="cartao"><h4> CLAUDE CONVERSATIONS ' + q('conv', 'Claude conversations') + '</h4><div class="cfg-linha">Rotation <select id="cfg-rot" data-cfg="rotacao">' + opcoes([['automatica', 'automatic (at 85%)'], ['botao', 'button only']]) + '</select></div>' +
        '<div class="cfg-linha">Open tabs <select id="cfg-max" data-cfg="maxConversas" data-num>' + opcoes([2, 3, 4, 5, 6, 7, 8].map(n => [String(n), n + ' conversations'])) + '</select></div>' +
        '<div class="cfg-linha"><button data-cmd="m80.rotacionar" class="b-rodar">► rotate to a new conversation now</button></div></div>' +
      '<div class="cartao"><h4> INSIDE CLAUDE ' + q('inside', 'Inside Claude') + '</h4><div class="cfg-nota">These live in the Claude plugin; type them in the chat:</div>' +
        '<div class="cfg-cmd"><b>/m80-barra</b> dbase · scoreboard · lotus · turbo · medidor<br><b>/m80-modo</b> model and effort per turn<br><b>/m80-faxina</b> memory budget cleanup</div></div>' +
      '</div>';
  }
  function atualizarConfig() {
    const c = (d && d.config) || {};
    window.M80Mapa.aplicar(d); window.M80Mapa.animar(podeAnimar()); window.M80Mapa.escolherEfeito(efAtual());
    const marcar = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el && v != null && el.value !== String(v)) el.value = String(v); };
    marcar('cfg-forma', c.forma); marcar('cfg-layout', c.layout || 'sinotico'); marcar('ef-sel', efAtual()); marcar('cfg-rot', c.rotacao); marcar('cfg-max', c.maxConversas);
    const base = String(c.visual || '').replace(/-suave$/, '');
    document.querySelectorAll('.cfg-vis .vis').forEach(b => b.classList.toggle('on', b.dataset.v === base));
    document.querySelectorAll('#cfg-anim button').forEach(b => b.classList.toggle('on', b.dataset.valor === (c.animar || 'sistema')));
    document.querySelectorAll('#cfg-arc button').forEach(b => b.classList.toggle('on', b.dataset.valor === (c.arcade || 'shown')));
    const t = window.M80Mapa.tema();
    document.getElementById('cfg-tema').textContent = 'Active: ' + (nomeTema(c.temaVSCode) || '—') + (/-suave$/.test(c.visual || '') ? ' (soft)' : '') + ' · shape in use: ' + t.forma;
    document.getElementById('cfg-anim-nota').textContent = podeAnimar() ? 'Animating now.' : 'Stopped now: Windows asks for less motion. Choose "always" to turn it on.';
  }
  elC.addEventListener('click', e => {
    const cmd = e.target.closest('[data-cmd]'); if (cmd) { vs.postMessage({ tipo: 'comando', id: cmd.dataset.cmd }); return; }
    const cv = e.target.closest('[data-cfgv]'); if (cv) { vs.postMessage({ tipo: 'config', chave: cv.dataset.cfgv, valor: cv.dataset.valor }); return; }
    const doc = e.target.closest('[data-doc]'); if (doc) { vs.postMessage({ tipo: 'abrirDoc', qual: doc.dataset.doc }); return; }
    if (e.target.closest('[data-f10]')) { irConfig(); return; }
    if (e.target.closest('[data-testar]')) { const s = document.getElementById('ef-sel'); if (s) window.M80Mapa.previa(s.value); }
  });
  elC.addEventListener('change', e => {
    const s = e.target.closest('[data-cfg]'); if (!s) return;
    vs.postMessage({ tipo: 'config', chave: s.dataset.cfg, valor: s.hasAttribute('data-num') ? Number(s.value) : s.value });
  });

  // ---------- cycle ----------
  let abaMontada = null, layoutMontado = null;
  function desenhar(forcar) {
    desenharAbas();
    if (ui.aba === 'scripts') {
      if (abaMontada !== 'scripts' || forcar === 'remontar') montarScripts();
      else atualizarScripts();
      abaMontada = 'scripts';
      return;
    }
    if (ui.aba === 'config') {
      if (abaMontada !== 'config' || !document.getElementById('cfg-forma')) montarConfig();
      abaMontada = 'config';
      atualizarConfig();
      return;
    }
    if (ui.aba === 'mapa') {
      const lay = (d && d.config && d.config.layout) || 'sinotico';
      if (abaMontada !== 'mapa' || !document.getElementById('mapa-v3') || layoutMontado !== lay) { layoutMontado = lay; montarMapa(); }
      abaMontada = 'mapa';
      atualizarMapa();
      return;
    }
    abaMontada = ui.aba;
    const rolagem = elC.scrollTop;
    // these tabs are redrawn every second: a focused "?" regains focus after the redraw
    const focoAjuda = document.activeElement && elC.contains(document.activeElement) && document.activeElement.dataset.h;
    elC.innerHTML = ui.aba === 'jobs' ? telaJobs() : ui.aba === 'gravador' ? telaGravador() : ui.aba === 'contexto' ? telaContexto() : ui.aba === 'economia' ? telaEconomia() : ui.aba === 'sobre' ? telaSobre() : telaMaquina();
    if (focoAjuda) { const b = elC.querySelector('[data-h="' + focoAjuda + '"]'); if (b) b.focus(); }
    elC.scrollTop = rolagem;
  }

  window.addEventListener('message', e => {
    if (!(e.data && e.data.tipo === 'dados')) return;
    d = e.data; recebidoEm = Date.now();
    document.body.dataset.arcade = (d.config && d.config.arcade) === 'hidden' ? 'hidden' : 'shown';
    // M80 looks with the CGA palette: the "?" help keeps the mockup colors (see monitor-tela.css)
    document.body.dataset.cga = /^M80 (Clipper|Turbo|Norton|LapLink|Quarterdeck)/.test((d.tema && d.tema.nome) || '') ? '1' : '';
    // current themes (Graphite, Midnight...): the console skin follows the theme colors (see monitor-tela.css)
    document.body.dataset.moderno = /^M80 (Graphite|Midnight|Daylight|Porcelain|Forest|Dusk|Ember|Ocean|Contrast|Mist)/i.test((d.tema && d.tema.nome) || '') ? '1' : '';
    // each step isolated: an error in one does not stop the others, and shows up in the Map console
    for (const [nome, f] of [['tasks', detectarTarefas], ['drawing', desenhar], ['effects', detectarFins]]) {
      try { f(); } catch (err) { anotarErro(nome, err); }
    }
  });
  window.addEventListener('error', ev => anotarErro('window', ev.error || ev.message));
  function anotarErro(onde, err) {
    const txt = new Date().toLocaleTimeString('en-GB') + ' [console] ERROR in ' + onde + ': ' + (err && err.message || err) + (err && err.stack ? ' ' + String(err.stack).split('\n')[1] : '');
    if (errosTela[errosTela.length - 1] !== txt) errosTela.push(txt);
    if (errosTela.length > 10) errosTela.shift();
  }

  document.addEventListener('keydown', e => {
    // help open: Esc and Enter close it (as in the mockup); other keys do not touch the screen behind
    if (!veu.hidden) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); fecharAjuda(); } return; }
    if (e.target && e.target.id === 'si') return;
    const k = e.key.toUpperCase();
    const atalho = ABAS.find(a => a[1] === k);
    if (atalho && !e.ctrlKey && !e.altKey) { ui.aba = atalho[0]; guardar(); desenhar(true); return; }
    if (ui.aba === 'sobre' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (DOC_TECLA[e.key]) { e.preventDefault(); e.stopPropagation(); vs.postMessage({ tipo: 'abrirDoc', qual: DOC_TECLA[e.key] }); return; }
      if (e.key === 'F10') { e.preventDefault(); e.stopPropagation(); irConfig(); return; }
    }
    if (ui.aba === 'jobs') {
      const n = linhasJobs().length;
      if (e.key === 'ArrowDown') { ui.selJob = Math.min(n - 1, ui.selJob + 1); desenhar(true); }
      if (e.key === 'ArrowUp') { ui.selJob = Math.max(0, ui.selJob - 1); desenhar(true); }
      if (e.key === 'F8') {
        e.preventDefault();
        const l = linhasJobs()[ui.selJob];
        if (l && l.exec) vs.postMessage({ tipo: 'parar', id: l.exec });
        else vs.postMessage({ tipo: 'parar', id: -1 });
      }
    }
  });

  // local animation: spinner and timers every 250 ms; the recorder moves along
  setInterval(() => {
    quadro++;
    document.querySelectorAll('[data-giro]').forEach(el => { el.textContent = GIRO[quadro % 4]; });
    const boca = document.getElementById('boca');
    if (boca && podeAnimar()) boca.textContent = quadro % 2 ? '◄' : '■';
    document.querySelectorAll('[data-desde]').forEach(el => { el.textContent = tempo(agora() - Number(el.dataset.desde)); });
    if (ui.aba === 'gravador' && quadro % 2 === 0) desenhar();
    if (ui.aba === 'scripts' && quadro % 4 === 0) atualizarScripts();
  }, 250);

  desenhar();
})();
