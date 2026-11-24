'use strict';
// Core of the M80 installer: installs OUTSIDE the extension what it carries bundled in payload/ (global hooks, project template,
// m80-motor plugin, Claude themes, IBM fonts) and records everything in ~/.claude/m80/instalado.json so it can be undone.
// It does not use the VS Code API: it can be tested with a fake HOME (see .scripts/testar-instalador.js). Windows only for now
// (fonts and registry); the rest already uses os.homedir() and portable paths.
//
// Safety rules:
//  - nothing is written until the layer above (instalador.js) has asked for confirmation;
//  - Claude's settings.json gets a backup first and is written through a temporary file + rename;
//  - only M80 keys are touched (hook groups with "hooks/m80/", extraKnownMarketplaces.m80, enabledPlugins["m80-motor@m80"]).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PLUGIN = 'm80-motor@m80';
const HOOKS = {
  SessionStart: [['startup', 'iniciar-projeto.js', 20], ['startup|clear|compact', 'continuidade.js', 10]],
  Stop: [[null, 'verificar-afirmacoes.js', 10], [null, 'guardiao-regras.js', 10]],
  TaskCompleted: [[null, 'portao-tarefa.js', 10]],
  PreToolUse: [['Bash|PowerShell|Edit|Write|MultiEdit', 'guardiao-regras.js', 10]]
};
const RTK = 'command -v rtk >/dev/null 2>&1 && rtk hook claude || true';

function caminhos(o) {
  const home = o.home || os.homedir();
  const claude = path.join(home, '.claude');
  const local = o.localAppData || process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return { home, claude, local, m80: path.join(claude, 'm80'), hooks: path.join(claude, 'hooks', 'm80'), temas: path.join(claude, 'themes'),
    fontes: path.join(local, 'Microsoft', 'Windows', 'Fonts'), settings: path.join(claude, 'settings.json'), instalado: path.join(claude, 'm80', 'instalado.json'),
    modelo: path.join(claude, 'm80', 'projeto-modelo'), marketplace: path.join(claude, 'm80', 'marketplace') };
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lerJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const posix = p => p.split(path.sep).join('/');
function listar(dir, base = dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]); }
function copiarArvore(de, para) { for (const rel of listar(de)) { fs.mkdirSync(path.dirname(path.join(para, rel)), { recursive: true }); fs.copyFileSync(path.join(de, rel), path.join(para, rel)); } }
function trocarPasta(de, para, c) { // replaces a folder that belongs only to M80 (always inside ~/.claude/m80)
  if (!posix(para).startsWith(posix(c.m80) + '/')) throw new Error('folder outside ~/.claude/m80: ' + para);
  fs.rmSync(para, { recursive: true, force: true }); copiarArvore(de, para);
}
const nomeFonte = arq => path.basename(arq, '.ttf').replace(/_/g, ' ') + ' (TrueType)';

function manifestoEmbarcado(payload) { const m = lerJson(path.join(payload, 'manifesto.json')); if (!m) throw new Error('payload without manifesto.json: ' + payload); return m; }
const lerInstalado = o => lerJson(caminhos(o).instalado);

// what would change in an installation (for the "What changes" dialog)
function planejar(o) {
  const c = caminhos(o), m = manifestoEmbarcado(o.payload), inst = lerInstalado(o);
  const contar = (sub, destino, filtro) => listar(path.join(o.payload, sub)).filter(f => !filtro || filtro(f)).filter(f => { const d = path.join(destino, f); return !fs.existsSync(d) || sha(d) !== sha(path.join(o.payload, sub, f)); });
  const itens = {
    'global hooks': contar('hooks', c.hooks), 'Claude themes': contar('temas-claude', c.temas), 'IBM fonts': contar('fontes', c.fontes),
    'project template': contar('projeto-modelo', c.modelo), 'm80-motor plugin': contar('marketplace', c.marketplace)
  };
  const s = lerJson(c.settings);
  const settingsOk = !!s && !!s.enabledPlugins && s.enabledPlugins[PLUGIN] === true && JSON.stringify(s.hooks || {}).includes('hooks/m80/')
    && ((s.extraKnownMarketplaces || {}).m80 || {}).source && s.extraKnownMarketplaces.m80.source.path === c.marketplace;
  return { necessario: !inst || inst.assinatura !== m.assinatura || Object.values(itens).some(l => l.length) || !settingsOk, instalado: inst, manifesto: m, itens, settingsOk, caminhos: c };
}

// merges only what belongs to M80 into the settings; returns the new object (pure: does not write)
function mesclarSettings(antes, c, o) {
  const s = JSON.parse(JSON.stringify(antes || {}));
  s.permissions = s.permissions || {}; s.env = s.env || {}; s.hooks = s.hooks || {};
  if (o.modoAuto === true) { s.permissions.defaultMode = 'auto'; s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS = '1'; s.env.CLAUDE_CODE_ENABLE_TASKS = '1'; }
  const node = arq => 'node "' + posix(path.join(c.hooks, arq)) + '"';
  const ehM80 = g => JSON.stringify(g).includes('hooks/m80/');
  if (Array.isArray(s.hooks.UserPromptSubmit)) { s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit.filter(g => !JSON.stringify(g).includes('suggest-cheaper-model')); if (!s.hooks.UserPromptSubmit.length) delete s.hooks.UserPromptSubmit; }
  for (const [ev, lista] of Object.entries(HOOKS)) {
    let atual = (s.hooks[ev] || []).filter(g => !ehM80(g)); // removes the old M80 groups and puts the current ones back (idempotent)
    for (const [matcher, arq, timeout] of lista) { const g = { hooks: [{ type: 'command', command: node(arq), timeout }] }; if (matcher) g.matcher = matcher; atual.push(g); }
    s.hooks[ev] = atual;
  }
  // rtk: compresses the output of Bash commands; only acts if rtk is on the PATH
  s.hooks.PreToolUse = (s.hooks.PreToolUse || []).filter(g => !JSON.stringify(g).includes('rtk hook claude'));
  s.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: RTK, timeout: 5 }] });
  s.extraKnownMarketplaces = Object.assign({}, s.extraKnownMarketplaces, { m80: { source: { source: 'directory', path: c.marketplace } } });
  s.enabledPlugins = Object.assign({}, s.enabledPlugins, { [PLUGIN]: true });
  return s;
}
function gravarJsonAtomico(arq, obj) {
  const txt = JSON.stringify(obj, null, 2) + '\n'; JSON.parse(txt);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.m80-tmp'; fs.writeFileSync(tmp, txt); fs.renameSync(tmp, arq);
}
const executar = (cmd, o) => o.exec ? o.exec(cmd) : new Promise(res => exec(cmd, { windowsHide: true, timeout: 120000 }, (e, out, err) => res({ code: e ? (e.code || 1) : 0, out: String(out || '') + String(err || '') })));
const registrarFonte = (nome, arq, o) => o.reg ? o.reg.add(nome, arq) : executar('reg add "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "' + nome + '" /t REG_SZ /d "' + arq + '" /f', o);
const removerFonteReg = (nome, o) => o.reg ? o.reg.del(nome) : executar('reg delete "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "' + nome + '" /f', o);

async function aplicar(o) {
  const c = caminhos(o), m = manifestoEmbarcado(o.payload), rel = [], avisos = [];
  const raiz = path.resolve(o.raiz || 'C:/source');
  fs.mkdirSync(c.claude, { recursive: true });
  // 1) backup of the settings
  let backup = null;
  if (fs.existsSync(c.settings)) { backup = c.settings + '.m80-bak-' + new Date().toISOString().replace(/[:.]/g, '-'); fs.copyFileSync(c.settings, backup); rel.push('settings.json backup: ' + backup); }
  // 2) hooks and configuration (project template and projects folder)
  const hooks = listar(path.join(o.payload, 'hooks')); fs.mkdirSync(c.hooks, { recursive: true });
  for (const f of hooks) fs.copyFileSync(path.join(o.payload, 'hooks', f), path.join(c.hooks, f));
  fs.writeFileSync(path.join(c.hooks, 'config.json'), JSON.stringify({ modelo: posix(c.modelo), raiz: posix(raiz) }, null, 2) + '\n');
  rel.push(hooks.length + ' hooks in ' + c.hooks);
  trocarPasta(path.join(o.payload, 'projeto-modelo'), c.modelo, c); rel.push('project template in ' + c.modelo);
  trocarPasta(path.join(o.payload, 'marketplace'), c.marketplace, c); rel.push('plugin marketplace in ' + c.marketplace);
  // 3) Claude themes
  const temas = listar(path.join(o.payload, 'temas-claude')); fs.mkdirSync(c.temas, { recursive: true });
  for (const f of temas) fs.copyFileSync(path.join(o.payload, 'temas-claude', f), path.join(c.temas, f));
  rel.push(temas.length + ' Claude themes in ' + c.temas);
  // 4) fonts (per user: the user fonts folder + HKCU registry)
  const fontes = listar(path.join(o.payload, 'fontes')); fs.mkdirSync(c.fontes, { recursive: true });
  for (const f of fontes) {
    const de = path.join(o.payload, 'fontes', f), para = path.join(c.fontes, f);
    if (!fs.existsSync(para) || sha(para) !== sha(de)) try { fs.copyFileSync(de, para); } catch (e) { avisos.push('font in use, not replaced: ' + f); }
    const r = await registrarFonte(nomeFonte(f), para, o); if (r && r.code) avisos.push('font registration failed: ' + f);
  }
  rel.push(fontes.length + ' IBM fonts in ' + c.fontes);
  // 5) Claude settings
  const antes = lerJson(c.settings), existia = fs.existsSync(c.settings);
  if (existia && !antes) throw new Error('~/.claude/settings.json exists but is not valid JSON; nothing was changed in it. Fix the file and run again.');
  gravarJsonAtomico(c.settings, mesclarSettings(antes, c, o)); rel.push('Claude settings.json: M80 hooks, local marketplace m80 and plugin ' + PLUGIN + (o.modoAuto === true ? ', auto mode and task list' : ''));
  // 6) plugin through the Claude CLI (installs if not there yet; otherwise updates)
  let plugin = 'not tried';
  if (o.claudeCli !== false) {
    const add = await executar('claude plugin marketplace add "' + c.marketplace + '"', o);
    const upd = await executar('claude plugin marketplace update m80', o);
    const inst = await executar('claude plugin install ' + PLUGIN, o);
    const atualiza = inst.code ? await executar('claude plugin update ' + PLUGIN, o) : null;
    plugin = (inst.code === 0 || (atualiza && atualiza.code === 0)) ? 'installed or updated through the Claude CLI' : 'the Claude CLI did not answer (add=' + add.code + ', update=' + upd.code + ', install=' + inst.code + '); run: claude plugin install ' + PLUGIN;
    if (!/installed/.test(plugin)) avisos.push(plugin);
  }
  rel.push('m80-motor plugin: ' + plugin);
  // 7) record of what was done (to undo it)
  fs.mkdirSync(c.m80, { recursive: true });
  fs.writeFileSync(c.instalado, JSON.stringify({ assinatura: m.assinatura, extensao: m.extensao, template: m.template, motor: m.motor, quando: new Date().toISOString(), raiz: posix(raiz), backup,
    hooks, temas, fontes, modoAuto: o.modoAuto === true }, null, 2) + '\n');
  return { relatorio: rel, avisos, backup };
}

async function desfazer(o) {
  const c = caminhos(o), inst = lerInstalado(o), rel = [];
  if (!inst) return { relatorio: ['nothing to undo: no installation record'], avisos: [] };
  if (fs.existsSync(c.settings)) {
    const s = lerJson(c.settings);
    if (s) {
      const bak = c.settings + '.m80-bak-desfazer-' + new Date().toISOString().replace(/[:.]/g, '-'); fs.copyFileSync(c.settings, bak);
      for (const ev of Object.keys(s.hooks || {})) { s.hooks[ev] = s.hooks[ev].filter(g => !JSON.stringify(g).includes('hooks/m80/') && !JSON.stringify(g).includes('rtk hook claude')); if (!s.hooks[ev].length) delete s.hooks[ev]; }
      if (s.extraKnownMarketplaces) { delete s.extraKnownMarketplaces.m80; if (!Object.keys(s.extraKnownMarketplaces).length) delete s.extraKnownMarketplaces; }
      if (s.enabledPlugins) delete s.enabledPlugins[PLUGIN];
      gravarJsonAtomico(c.settings, s); rel.push('M80 hooks and plugin removed from settings.json (copy in ' + bak + '; auto mode and variables left as they are)');
    }
  }
  if (o.claudeCli !== false) { await executar('claude plugin uninstall ' + PLUGIN, o); await executar('claude plugin marketplace remove m80', o); }
  for (const f of inst.hooks || []) fs.rmSync(path.join(c.hooks, f), { force: true });
  fs.rmSync(path.join(c.hooks, 'config.json'), { force: true });
  for (const f of inst.temas || []) fs.rmSync(path.join(c.temas, f), { force: true });
  for (const f of inst.fontes || []) { await removerFonteReg(nomeFonte(f), o); try { fs.rmSync(path.join(c.fontes, f), { force: true }); } catch { /* in use */ } }
  fs.rmSync(c.m80, { recursive: true, force: true });
  rel.push('hooks, themes, fonts, project template and marketplace removed (hook logs were kept)');
  return { relatorio: rel, avisos: [] };
}

module.exports = { planejar, aplicar, desfazer, mesclarSettings, manifestoEmbarcado, lerInstalado, caminhos, nomeFonte, PLUGIN };
