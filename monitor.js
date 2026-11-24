// M80 Monitor: tab in the bottom panel (next to Ports).
// Extension side: reads .sessions/m80-ao-vivo.json (written by the m80-motor plugin),
// the shared task list, measures the machine and runs the project scripts
// without a stray window. The screen (media/monitor-tela.js) only draws.
const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

function raiz() {
  const f = vscode.workspace.workspaceFolders;
  return f && f.length ? f[0].uri.fsPath : undefined;
}

function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

function idDaLista(r) {
  const s = r && lerJson(path.join(r, '.claude', 'settings.json'));
  const id = s && s.env && s.env.CLAUDE_CODE_TASK_LIST_ID;
  return id || (r ? path.basename(r).toLowerCase() : '');
}

function tarefas(r) {
  const id = idDaLista(r);
  if (!id) return [];
  const dir = path.join(os.homedir(), '.claude', 'tasks', id);
  let nomes = [];
  try { nomes = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; }
  return nomes.map(f => lerJson(path.join(dir, f))).filter(Boolean)
    .map(t => ({ id: String(t.id), assunto: t.subject || '', status: t.status || 'pending', ativo: t.activeForm || '' }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

// ---------- machine ----------
let cpuAntes = os.cpus().map(c => c.times);
function maquina(r) {
  const agora = os.cpus().map(c => c.times);
  const nucleos = agora.map((t, i) => {
    const a = cpuAntes[i] || t;
    const total = (t.user + t.nice + t.sys + t.idle + t.irq) - (a.user + a.nice + a.sys + a.idle + a.irq);
    const ocioso = t.idle - a.idle;
    return total > 0 ? Math.round(100 * (1 - ocioso / total)) : 0;
  });
  cpuAntes = agora;
  const mem = Math.round(100 * (1 - os.freemem() / os.totalmem()));
  let disco = null;
  try {
    const st = fs.statfsSync(r || os.homedir());
    disco = { pct: Math.round(100 * (1 - st.bavail / st.blocks)), livreGb: Math.round(st.bavail * st.bsize / 1e9) };
  } catch { /* no statfs */ }
  return { nucleos, mem, memTotalGb: Math.round(os.totalmem() / 1e9), disco };
}

// ---------- scripts ----------
const execucoes = []; // { id, nome, inicio, fim, codigo, saida, proc }
let seq = 0;

function bashDoGit() {
  const cands = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files (x86)/Git/bin/bash.exe'];
  return cands.find(c => fs.existsSync(c)) || 'bash';
}

function listaScripts(r) {
  if (!r) return [];
  try { return fs.readdirSync(path.join(r, '.scripts')).filter(f => /\.(js|sh|ps1)$/.test(f)).sort(); } catch { return []; }
}

function rodar(nome, enviar) {
  const r = raiz(); if (!r) return;
  const arq = path.join(r, '.scripts', nome);
  let cmd, args;
  if (nome.endsWith('.js')) { cmd = 'node'; args = [arq]; }
  else if (nome.endsWith('.sh')) { cmd = bashDoGit(); args = [arq]; }
  else { cmd = 'powershell'; args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', arq]; }
  const ex = { id: ++seq, nome, inicio: Date.now(), fim: null, codigo: null, saida: '', proc: null };
  let proc;
  try {
    proc = spawn(cmd, args, { cwd: r, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
  } catch (err) {
    ex.fim = Date.now(); ex.codigo = -1; ex.saida = `could not start: ${err.message}\n`;
    execucoes.push(ex); enviar(); return;
  }
  ex.proc = proc;
  execucoes.push(ex);
  if (execucoes.length > 20) execucoes.shift();
  const anexar = (b) => { ex.saida += b.toString(); if (ex.saida.length > 200000) ex.saida = ex.saida.slice(-150000); enviar(); };
  proc.stdout.on('data', anexar);
  proc.stderr.on('data', anexar);
  proc.on('error', (err) => { ex.saida += `\nerror: ${err.message}\n`; });
  proc.on('close', (codigo) => { ex.fim = Date.now(); ex.codigo = codigo; ex.proc = null; enviar(); });
  enviar();
}

function parar(id) {
  const ex = execucoes.find(e => e.id === id);
  if (!ex || !ex.proc) return false;
  // the process may have grandchildren (Git's bash is a launcher): kills the whole tree
  execFile('taskkill', ['/PID', String(ex.proc.pid), '/T', '/F'], { windowsHide: true }, () => {});
  return true;
}

function responder(id, texto) {
  const ex = execucoes.find(e => e.id === id);
  if (ex && ex.proc && ex.proc.stdin.writable) { ex.proc.stdin.write(texto + '\n'); ex.saida += `> ${texto}\n`; }
}

// ---------- Claude conversations (tabs) ----------
const vistas = new Map(); // tab -> { desde, rotulo }
function abasDoClaude() {
  const lista = [];
  for (const g of vscode.window.tabGroups.all) {
    for (const t of g.tabs) {
      const tipo = t.input && t.input.viewType ? String(t.input.viewType) : '';
      if (tipo.includes('claudeVSCodePanel')) lista.push(t);
    }
  }
  return lista;
}
function conversas(context) {
  const agora = abasDoClaude();
  for (const t of agora) if (!vistas.has(t)) vistas.set(t, { desde: Date.now(), rotulo: t.label });
  const arquivo = context.workspaceState.get('m80.conversasArquivadas', []);
  for (const [t, info] of [...vistas]) {
    if (!agora.includes(t)) {
      vistas.delete(t);
      arquivo.push({ rotulo: info.rotulo, desde: info.desde, fechada: Date.now() });
    }
  }
  while (arquivo.length > 10) arquivo.shift();
  context.workspaceState.update('m80.conversasArquivadas', arquivo);
  const abertas = agora.map(t => ({ rotulo: t.label, ativa: t.isActive, desde: (vistas.get(t) || {}).desde || Date.now() }))
    .sort((a, b) => a.desde - b.desde);
  let total = 0;
  for (const g of vscode.window.tabGroups.all) total += g.tabs.length;
  return { abertas, arquivadas: arquivo.slice(-3), totalAbas: total, limiteAbas: vscode.workspace.getConfiguration('workbench.editor.limit').get('value') };
}

// memory of the VS Code processes (tasklist, every 10 s)
let memoriaCode = null;
let medidaEm = 0;
function medirMemoriaCode() {
  if (Date.now() - medidaEm < 10000) return;
  medidaEm = Date.now();
  execFile('tasklist', ['/FI', 'IMAGENAME eq Code.exe', '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, out) => {
    if (err || !out) return;
    let kb = 0;
    for (const linha of out.split(/\r?\n/)) {
      const campos = linha.split('","');
      const ult = campos[campos.length - 1] || '';
      const n = Number(ult.replace(/[^0-9]/g, ''));
      if (n) kb += n;
    }
    if (kb) memoriaCode = Math.round(kb / 1024 / 1024 * 10) / 10;
  });
}

// budget of the files loaded in every conversation
function orcamento(r) {
  const tam = f => { try { return fs.statSync(f).size; } catch { return null; } };
  const linhas = f => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).length; } catch { return null; } };
  const home = path.join(os.homedir(), '.claude');
  const pasta = r ? r.replace(/[^a-zA-Z0-9]/g, '-') : '';
  const memoria = path.join(home, 'projects', pasta, 'memory', 'MEMORY.md');
  const global = (tam(path.join(home, 'CLAUDE.md')) || 0) + (tam(path.join(home, 'RTK.md')) || 0);
  return [
    { nome: 'CLAUDE.md', valor: r ? tam(path.join(r, 'CLAUDE.md')) : null, teto: 6144, unidade: 'bytes' },
    { nome: 'global+RTK', valor: global, teto: 4096, unidade: 'bytes' },
    { nome: 'MEMORY.md', valor: linhas(memoria), teto: 50, unidade: 'linhas' },
  ];
}

// ---------- Claude log for this window (the same one as the Output panel) ----------
// VS Code writes the extension logs side by side: .../exthost/<extension>/.
function logDoClaude(context) {
  try {
    const arq = path.join(path.dirname(context.logUri.fsPath), 'Anthropic.claude-code', 'Claude VSCode.log');
    const st = fs.statSync(arq);
    const tam = Math.min(st.size, 48 * 1024);
    const fd = fs.openSync(arq, 'r');
    const buf = Buffer.alloc(tam);
    fs.readSync(fd, buf, 0, tam, st.size - tam);
    fs.closeSync(fd);
    return buf.toString('utf8').split(/\r?\n/).filter(l => l.trim()).slice(-80);
  } catch { return []; }
}

// ---------- rtk savings (rtk gain, every 30 s) ----------
let rtk = null;
let rtkEm = 0;
function medirRtk() {
  if (Date.now() - rtkEm < 30000) return;
  rtkEm = Date.now();
  execFile('rtk', ['gain'], { windowsHide: true, timeout: 15000 }, (err, out) => {
    if (!out) return;
    const num = s => { const m = String(s || '').match(/([\d.,]+)\s*([KkMm]?)/); if (!m) return null; const v = parseFloat(m[1].replace(',', '.')); return m[2] ? v * (/k/i.test(m[2]) ? 1e3 : 1e6) : v; };
    const salvos = out.match(/Tokens saved:\s+([\d.,]+[KkMm]?)\s+\(([\d.,]+)%\)/);
    const cmds = out.match(/Total commands:\s+(\d+)/);
    const top = [...out.matchAll(/^\s*\d+\.\s+(rtk [^\n]+?)\s{2,}(\d+)\s+(\d+)\s+([\d.]+)%/gm)].slice(0, 5).map(m => ({ cmd: m[1].trim(), vezes: +m[2], poupados: +m[3], pct: +m[4] }));
    rtk = { poupados: salvos ? num(salvos[1]) : null, pct: salvos ? parseFloat(salvos[2]) : null, comandos: cmds ? +cmds[1] : null, top };
  });
}

// ---------- tab rotation ----------
const esperar = ms => new Promise(res => setTimeout(res, ms));
async function rotacionar(context, motivo) {
  const max = vscode.workspace.getConfiguration('m80').get('maxConversas', 3);
  const antes = abasDoClaude().length;
  await vscode.commands.executeCommand('claude-vscode.editor.open');
  await esperar(2000);
  const depois = abasDoClaude();
  if (depois.length <= antes) {
    vscode.window.showWarningMessage('M80: rotation could not open a new conversation. Open one with Claude\'s "+"; the handoff card comes in on its own.');
    return false;
  }
  conversas(context);
  const ordem = depois.filter(t => !t.isActive).sort((a, b) => ((vistas.get(a) || {}).desde || 0) - ((vistas.get(b) || {}).desde || 0));
  const fechar = ordem.slice(0, Math.max(0, depois.length - max));
  if (fechar.length) await vscode.window.tabGroups.close(fechar);
  vscode.window.showInformationMessage(`M80: new conversation opened with the handoff card (${motivo}). ${fechar.length ? fechar.length + ' old conversation closed; it stays in the history.' : ''}`);
  return true;
}

// ---------- Map regions: the first-level folders of the project, most recently touched first ----------
const IGNORAR = new Set(['.git', 'node_modules', '.vscode', '.serena', '.idea', 'dist', 'out', '.venv', '__pycache__']);
let pastasCache = { r: null, em: 0, lista: [] };
function pastasDoProjeto(r) {
  if (!r) return [];
  if (pastasCache.r === r && Date.now() - pastasCache.em < 60000) return pastasCache.lista;
  let lista = [];
  try {
    lista = fs.readdirSync(r, { withFileTypes: true }).filter(e => e.isDirectory() && !IGNORAR.has(e.name))
      .map(e => { let m = 0; try { m = fs.statSync(path.join(r, e.name)).mtimeMs; } catch { /* no date */ } return { n: e.name, m }; })
      .sort((a, b) => b.m - a.m).slice(0, 6).map(x => x.n).sort();
  } catch { lista = []; }
  pastasCache = { r, em: Date.now(), lista };
  return lista;
}

// ---------- Settings tab: what the screen can change ----------
const umDe = lista => v => lista.includes(v);
const CONFIG_LIVRE = {
  'efeitos.mapa': umDe(['nenhum', 'lixeira', 'rio', 'enxame', 'keystone', 'kaboom', 'missil', 'selva', 'invasores', 'sapo', 'asteroides', 'pong', 'enduro', 'comilao', 'poco', 'explosao', 'fogos']),
  'efeitos.animar': umDe(['sistema', 'sempre', 'nunca']),
  'monitor.forma': umDe(['auto', 'manifest', 'fosforo', 'lotus', 'norton', 'moderna']),
  'monitor.layout': umDe(['sinotico', 'teletexto', 'circuito', 'radar']),
  'monitor.arcade': umDe(['shown', 'hidden']),
  'rotacao': umDe(['automatica', 'botao']),
  'maxConversas': v => Number.isInteger(v) && v >= 2 && v <= 8,
};
const COMANDOS_LIVRES = new Set(['m80.visual.clipper', 'm80.visual.turbo', 'm80.visual.norton', 'm80.visual.fosforo', 'm80.visual.ambar', 'm80.visual.laplink', 'm80.visual.manifest', 'm80.visual.graphite', 'm80.visual.midnight', 'm80.visual.daylight', 'm80.visual.porcelain', 'm80.visual.forest', 'm80.visual.dusk', 'm80.visual.ember', 'm80.visual.ocean', 'm80.visual.contrast', 'm80.visual.mist', 'm80.alternarSuave', 'm80.rotacionar']);
function configAtual() {
  const c = vscode.workspace.getConfiguration('m80');
  return { visual: c.get('visual', 'clipper'), forma: c.get('monitor.forma', 'auto'), layout: ['sinotico', 'teletexto', 'circuito', 'radar'].includes(c.get('monitor.layout')) ? c.get('monitor.layout') : 'sinotico', efeito: c.get('efeitos.mapa', 'lixeira'), animar: c.get('efeitos.animar', 'sistema'), arcade: c.get('monitor.arcade', 'shown') === 'hidden' ? 'hidden' : 'shown',
    rotacao: c.get('rotacao', 'automatica'), maxConversas: c.get('maxConversas', 3), temaVSCode: vscode.workspace.getConfiguration('workbench').get('colorTheme', '') };
}

// ---------- About tab and version mark: everything read from the installed files (every 15 s) ----------
// What cannot be checked goes as null; the screen shows "—" instead of [OK].
const HOOKS_M80 = ['iniciar-projeto', 'continuidade', 'verificar-afirmacoes', 'portao-tarefa', 'guardiao-regras'];
const DOCS_SOBRE = { readme: 'README.md', changelog: 'CHANGELOG.md', motor: path.join('.claude-plugins', 'm80-motor', 'README.md') };
let sobreCache = { em: 0, r: null, v: null };
function versaoTemplate() {
  const locais = [path.join(os.homedir(), '.claude', 'hooks', 'm80', 'iniciar-projeto.js')];
  for (let i = 0; i < locais.length; i++) {
    try {
      const m = fs.readFileSync(locais[i], 'utf8').match(/const\s+VERSAO\s*=\s*['"]?(\d+(?:\.\d+)*)/);
      if (m) return { v: 'v' + m[1], instalado: i === 0 };
    } catch { /* try the next one */ }
  }
  return { v: null, instalado: false };
}
function pluginInstalado(chave) {
  const j = lerJson(path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json'));
  const lista = j && (j.plugins || j)[chave];
  const e = Array.isArray(lista) ? lista[0] : lista;
  if (!e) return null;
  let versao = e.version || null;
  const pj = e.installPath && lerJson(path.join(e.installPath, '.claude-plugin', 'plugin.json'));
  if (pj && pj.version) versao = pj.version;
  // LOCAL marketplace plugin (the M80 one): Claude Code reads straight from the marketplace folder and updates neither the registry nor the cache,
  // so the version that counts is the one in that folder's plugin.json
  const m = /^(.+)@m80$/.exec(chave);
  if (m) {
    const ajustes = lerJson(path.join(os.homedir(), '.claude', 'settings.json')) || {};
    const src = ((ajustes.extraKnownMarketplaces || {}).m80 || {}).source;
    const pasta = (src && src.path) || path.join(os.homedir(), '.claude', 'm80', 'marketplace');
    const pl = lerJson(path.join(pasta, m[1], '.claude-plugin', 'plugin.json'));
    if (pl && pl.version) versao = pl.version;
  }
  return { versao, installPath: e.installPath || null, existe: !!(e.installPath && fs.existsSync(e.installPath)) };
}
function sobre(context, r) {
  if (sobreCache.r === r && Date.now() - sobreCache.em < 15000) return sobreCache.v;
  const home = path.join(os.homedir(), '.claude');
  const ajustes = lerJson(path.join(home, 'settings.json')) || {};
  const ligados = ajustes.enabledPlugins || {};
  // hooks: file in ~/.claude/hooks/m80 AND registered in settings.json; the event comes from the settings itself
  const eventos = {};
  for (const [ev, grupos] of Object.entries(ajustes.hooks || {})) {
    for (const g of grupos || []) for (const h of (g && g.hooks) || []) {
      const m = String(h.command || '').match(/hooks[\\/]m80[\\/]([\w-]+)\.js/);
      if (m) (eventos[m[1]] = eventos[m[1]] || new Set()).add(ev);
    }
  }
  const hooks = HOOKS_M80.map(n => {
    const arquivo = fs.existsSync(path.join(home, 'hooks', 'm80', n + '.js'));
    const evs = eventos[n] ? [...eventos[n]] : [];
    return { nome: n, evento: evs.length ? evs.join(' + ') : null, ok: arquivo && evs.length > 0 };
  });
  const motor = pluginInstalado('m80-motor@m80');
  const pj = context.extension && context.extension.packageJSON || {};
  const temas = (pj.contributes && pj.contributes.themes) || [];
  const extDir = context.extensionPath;
  const tpl = versaoTemplate();
  let agentes = null;
  try { agentes = r ? fs.readdirSync(path.join(r, '.claude', 'agents')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)) : null; } catch { agentes = null; }
  let terceiros = [];
  const j = lerJson(path.join(home, 'plugins', 'installed_plugins.json'));
  if (j) terceiros = Object.keys(j.plugins || j).filter(k => !k.startsWith('m80-motor@')).map(k => ({ nome: k.split('@')[0], ok: ligados[k] === true }));
  if (rtk) terceiros.unshift({ nome: 'rtk', ok: true });
  const docs = {};
  for (const [k, rel] of Object.entries(DOCS_SOBRE)) docs[k] = !!(r && fs.existsSync(path.join(r, rel)));
  if (!docs.motor && motor && motor.installPath) docs.motor = fs.existsSync(path.join(motor.installPath, 'README.md'));
  const v = {
    tpl: tpl.v, tplOk: tpl.instalado ? true : null,
    ext: pj.version || null, extOk: !!pj.version,
    motor: motor ? motor.versao : null, motorOk: motor ? (motor.existe && ligados['m80-motor@m80'] === true) : null,
    visuais: temas.filter(t => !/suave|soft/i.test(t.label || '')).length || null,
    visuaisOk: temas.length ? temas.every(t => t.path && fs.existsSync(path.join(extDir, t.path))) : null,
    hooks, agentes, terceiros, docs,
  };
  sobreCache = { em: Date.now(), r, v };
  return v;
}
function abrirDoc(qual) {
  const r = raiz();
  const rel = DOCS_SOBRE[qual];
  if (!rel) return;
  let arq = r ? path.join(r, rel) : null;
  if ((!arq || !fs.existsSync(arq)) && qual === 'motor') {
    const m = pluginInstalado('m80-motor@m80');
    arq = m && m.installPath ? path.join(m.installPath, 'README.md') : null;
  }
  if (!arq || !fs.existsSync(arq)) { vscode.window.showInformationMessage('M80 Console: ' + rel + ' does not exist in this project.'); return; }
  vscode.window.showTextDocument(vscode.Uri.file(arq));
}

// ---------- the tab ----------
class Monitor {
  constructor(context) { this.context = context; this.view = null; this.timer = null; this.pendente = false; }

  resolveWebviewView(view) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const tela = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'monitor-tela.js'));
    const css = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'monitor-tela.css'));
    const mapaJs = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'monitor-mapa.js'));
    const mapaCss = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'monitor-mapa.css'));
    const nonce = Math.random().toString(36).slice(2);
    view.webview.html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource} 'unsafe-inline'; font-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"><link rel="stylesheet" href="${mapaCss}"></head><body><div id="app"></div>
<script nonce="${nonce}" src="${mapaJs}"></script>
<script nonce="${nonce}" src="${tela}"></script></body></html>`;
    view.webview.onDidReceiveMessage(m => this.receber(m));
    view.onDidChangeVisibility(() => this.ligar());
    view.onDidDispose(() => { clearInterval(this.timer); this.timer = null; this.view = null; });
    this.ligar();
  }

  ligar() {
    clearInterval(this.timer); this.timer = null;
    if (this.view && this.view.visible) { this.enviar(); this.timer = setInterval(() => this.enviar(), 1000); }
  }

  enviar() {
    if (!this.view) return;
    // several script outputs at the same instant become a single send
    if (this.pendente) return;
    this.pendente = true;
    setTimeout(() => {
      this.pendente = false;
      if (!this.view) return;
      const r = raiz();
      const vivo = r ? lerJson(path.join(r, '.sessions', 'm80-ao-vivo.json')) : null;
      medirMemoriaCode();
      medirRtk();
      this.cuidarDaRotacao(vivo);
      const estadoFicha = r ? lerJson(path.join(r, '.sessions', 'continuidade.json')) : null;
      this.view.webview.postMessage({
        conversas: conversas(this.context),
        logs: logDoClaude(this.context),
        rtk,
        animar: vscode.workspace.getConfiguration('m80').get('efeitos.animar', 'sistema'),
        efeito: vscode.workspace.getConfiguration('m80').get('efeitos.mapa', 'lixeira'),
        memoriaCode,
        orcamento: orcamento(r),
        fichaPendente: !!(estadoFicha && estadoFicha.pendente),
        rotacao: vscode.workspace.getConfiguration('m80').get('rotacao', 'automatica'),
        tipo: 'dados',
        agora: Date.now(),
        projeto: r ? path.basename(r) : '',
        raiz: r || '',
        config: configAtual(),
        regioes: pastasDoProjeto(r),
        sobre: sobre(this.context, r),
        tema: { nome: vscode.workspace.getConfiguration('workbench').get('colorTheme', ''), forma: vscode.workspace.getConfiguration('m80').get('monitor.forma', 'auto') },
        vivo,
        tarefas: tarefas(r),
        maquina: maquina(r),
        scripts: listaScripts(r),
        execucoes: execucoes.map(e => ({ id: e.id, nome: e.nome, inicio: e.inicio, fim: e.fim, codigo: e.codigo, saida: e.saida.slice(-60000) })),
      });
    }, 60);
  }

  // m80-motor requests the rotation (rotacaoPedida) when it writes the final handoff card at 85%
  cuidarDaRotacao(vivo) {
    const pedida = vivo && vivo.continuidade && vivo.continuidade.rotacaoPedida;
    if (!pedida || this.rodando) return;
    const feita = this.context.workspaceState.get('m80.ultimaRotacao', 0);
    if (pedida <= feita) return;
    if (vscode.workspace.getConfiguration('m80').get('rotacao', 'automatica') !== 'automatica') return;
    // only runs while Claude is idle: the rotation happens in the pause, never in the middle of a turn
    if (vivo.sessao && vivo.sessao.estado && vivo.sessao.estado !== 'pronto') return;
    this.rodando = true;
    this.context.workspaceState.update('m80.ultimaRotacao', pedida);
    rotacionar(this.context, 'context passed 85%').finally(() => { this.rodando = false; });
  }

  receber(m) {
    // Map validation log: one JSON line per change; the file is trimmed once it passes 300 KB
    if (m.tipo === 'logMapa') {
      const r = raiz(); if (!r || !fs.existsSync(path.join(r, '.sessions'))) return;
      const arq = path.join(r, '.sessions', 'm80-mapa.log');
      try {
        if (fs.existsSync(arq) && fs.statSync(arq).size > 300000) fs.writeFileSync(arq, fs.readFileSync(arq, 'utf8').slice(-150000));
        fs.appendFileSync(arq, JSON.stringify({ t: new Date().toISOString(), ...m.linha }) + '\n');
      } catch (e) { /* no log: carry on */ }
      return;
    }
    if (m.tipo === 'rotacionar') { rotacionar(this.context, 'requested in the Console').then(() => this.enviar()); return; }
    if (m.tipo === 'reabrir') { vscode.commands.executeCommand('claude-vscode.reopenClosedSession'); return; }
    // Settings tab: only these keys and commands can be changed from the screen
    if (m.tipo === 'config' && CONFIG_LIVRE[m.chave] && CONFIG_LIVRE[m.chave](m.valor)) {
      vscode.workspace.getConfiguration('m80').update(m.chave, m.valor, vscode.ConfigurationTarget.Global).then(() => this.enviar()); return;
    }
    if (m.tipo === 'comando' && COMANDOS_LIVRES.has(m.id)) { vscode.commands.executeCommand(m.id).then(() => setTimeout(() => this.enviar(), 400)); return; }
    if (m.tipo === 'efeito') { vscode.workspace.getConfiguration('m80').update('efeitos.mapa', m.valor, vscode.ConfigurationTarget.Global).then(() => this.enviar()); return; }
    if (m.tipo === 'animar') { vscode.workspace.getConfiguration('m80').update('efeitos.animar', m.valor, vscode.ConfigurationTarget.Global).then(() => this.enviar()); return; }
    if (m.tipo === 'rodar') rodar(m.nome, () => this.enviar());
    else if (m.tipo === 'parar') { if (!parar(m.id)) vscode.window.showInformationMessage('M80 Console: only scripts started in this tab can be stopped from here.'); }
    else if (m.tipo === 'responder') { responder(m.id, m.texto); this.enviar(); }
    else if (m.tipo === 'limpar') { for (let i = execucoes.length - 1; i >= 0; i--) if (execucoes[i].fim) execucoes.splice(i, 1); this.enviar(); }
    else if (m.tipo === 'abrirDoc') abrirDoc(m.qual);
    else if (m.tipo === 'abrir' && m.nome) { const r = raiz(); if (r) vscode.window.showTextDocument(vscode.Uri.file(path.join(r, '.scripts', m.nome))); }
  }
}

function registrarMonitor(context) {
  const monitor = new Monitor(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('m80.monitor', monitor, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('m80.abrirMonitor', () => vscode.commands.executeCommand('m80.monitor.focus')),
    vscode.commands.registerCommand('m80.rotacionar', () => rotacionar(context, 'command M80: Rotate to a new conversation')),
    { dispose: () => { for (const e of execucoes) if (e.proc) parar(e.id); } }
  );
}

module.exports = { registrarMonitor, tarefas, maquina, listaScripts, idDaLista };
