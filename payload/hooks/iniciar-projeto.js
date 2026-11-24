#!/usr/bin/env node
// M80 template v21: prepares projects.
//
// As a (global) SessionStart hook:
//   - NEW folder inside M80_RAIZ (set by the installer in config.json), with no CLAUDE.md and no .claude/:
//     installs the full template and runs git init;
//   - project that already uses the template with an older version: updates agents and docs
//     (never CLAUDE.md or settings.json, which belong to the project);
//   - existing project that does not use the template: only says once how to adopt it.
// As a command:  node iniciar-projeto.js --adotar <folder>
//   adopts the template in an existing project without overwriting anything that already exists.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const VERSAO = 21;
// The extension installer writes ~/.claude/hooks/m80/config.json ({ modelo, raiz }); environment variables win over it
const CONFIG = path.join(os.homedir(), '.claude', 'hooks', 'm80', 'config.json');
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { /* no config: uses the defaults below */ }
const MODELO = process.env.M80_TEMPLATE || CFG.modelo || path.join(os.homedir(), '.claude', 'm80', 'projeto-modelo');
const RAIZ = path.resolve(process.env.M80_RAIZ || CFG.raiz || 'C:/source');
const PASTAS = ['.analisys', '.report', '.code', '.files', '.scripts', '.sessions', '.claude/agents', '.claude/skills', '.claude/skills/m80-faxina', '.claude/docs'];
const AVISADOS = path.join(os.homedir(), '.claude', 'hooks', 'm80', 'avisados.json');

function msg(texto) {
  process.stdout.write(JSON.stringify({ systemMessage: texto }));
}

function copiar(rel, destino, sobrescrever, nome) {
  const de = path.join(MODELO, rel);
  const para = path.join(destino, rel);
  if (!fs.existsSync(de)) return false;
  if (fs.existsSync(para) && !sobrescrever) return false;
  fs.mkdirSync(path.dirname(para), { recursive: true });
  let conteudo = fs.readFileSync(de, 'utf8');
  if (nome) conteudo = conteudo.split('{{NOME_PROJETO}}').join(nome);
  fs.writeFileSync(para, conteudo);
  return true;
}

function arquivosDoModelo(sub) {
  const base = path.join(MODELO, sub);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).map(f => path.join(sub, f).split(path.sep).join('/'));
}

function marcar(destino) {
  fs.writeFileSync(path.join(destino, '.claude', 'm80.json'), JSON.stringify({ template: 'm80', versao: VERSAO, data: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
}

function indice(destino) {
  const f = path.join(destino, '.report', '00-INDICE.md');
  if (!fs.existsSync(f)) fs.writeFileSync(f, '# Reports index\n\n| Date | Report | Matching analysis | Topic |\n|------|--------|-------------------|-------|\n');
}

function instalar(destino, completo) {
  const nome = path.basename(destino).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const feitos = [];
  for (const p of PASTAS) fs.mkdirSync(path.join(destino, p), { recursive: true });
  if (copiar('CLAUDE.md', destino, false)) feitos.push('CLAUDE.md');
  if (copiar('.gitignore', destino, false)) feitos.push('.gitignore');
  const settingsDestino = path.join(destino, '.claude', 'settings.json');
  if (!fs.existsSync(settingsDestino)) {
    copiar('.claude/settings.json', destino, false, nome);
    feitos.push('.claude/settings.json');
  } else {
    // adopted project: only adds the task-list variables, if they are missing
    const s = JSON.parse(fs.readFileSync(settingsDestino, 'utf8'));
    s.env = s.env || {};
    let mudou = false;
    if (!s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS) { s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS = '1'; mudou = true; }
    if (!s.env.CLAUDE_CODE_TASK_LIST_ID) { s.env.CLAUDE_CODE_TASK_LIST_ID = nome; mudou = true; }
    if (mudou) { fs.writeFileSync(settingsDestino, JSON.stringify(s, null, 2) + '\n'); feitos.push('task-list env'); }
  }
  for (const rel of [...arquivosDoModelo('.claude/agents'), ...arquivosDoModelo('.claude/docs'), ...arquivosDoModelo('.claude/skills/m80-faxina'), ...arquivosDoModelo('.scripts')]) {
    if (copiar(rel, destino, false)) feitos.push(rel);
  }
  indice(destino);
  marcar(destino);
  if (completo && !fs.existsSync(path.join(destino, '.git'))) {
    try { execFileSync('git', ['init', '-q'], { cwd: destino, stdio: 'ignore' }); feitos.push('git init'); } catch { /* no git */ }
  }
  return feitos;
}

function atualizar(destino, versaoAtual) {
  const feitos = [];
  for (const rel of [...arquivosDoModelo('.claude/agents'), ...arquivosDoModelo('.claude/docs'), ...arquivosDoModelo('.claude/skills/m80-faxina'), ...arquivosDoModelo('.scripts')]) {
    if (copiar(rel, destino, true)) feitos.push(rel);
  }
  marcar(destino);
  return `M80: project updated from template v${versaoAtual} to v${VERSAO} (${feitos.length} agent and doc files; CLAUDE.md and settings.json were not touched).`;
}

function dentroDaRaiz(dir) {
  const rel = path.relative(RAIZ, dir);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function jaAvisado(dir) {
  let lista = [];
  try { lista = JSON.parse(fs.readFileSync(AVISADOS, 'utf8')); } catch { /* empty */ }
  if (lista.includes(dir)) return true;
  lista.push(dir);
  try { fs.mkdirSync(path.dirname(AVISADOS), { recursive: true }); fs.writeFileSync(AVISADOS, JSON.stringify(lista)); } catch { /* ok */ }
  return false;
}

function principal() {
  const i = process.argv.indexOf('--adotar');
  if (i > 0) {
    const destino = path.resolve(process.argv[i + 1] || process.cwd());
    const feitos = instalar(destino, false);
    console.log(`M80 template v${VERSAO} adopted in ${destino}.`);
    console.log(feitos.length ? 'Created: ' + feitos.join(', ') : 'Nothing to create: everything already existed.');
    console.log('The existing CLAUDE.md was not changed. Compare it with ' + path.join(MODELO, 'CLAUDE.md') + ' if you want the new rules.');
    return;
  }

  let entrada = {};
  try { entrada = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }
  const dir = path.resolve(entrada.cwd || process.cwd());
  if (!dentroDaRaiz(dir) || !fs.existsSync(MODELO)) return;
  if (path.resolve(MODELO).toLowerCase().startsWith(dir.toLowerCase() + path.sep)) return; // the template project itself

  const marca = path.join(dir, '.claude', 'm80.json');
  if (fs.existsSync(marca)) {
    let v = 0;
    try { v = JSON.parse(fs.readFileSync(marca, 'utf8')).versao || 0; } catch { /* ok */ }
    if (v < VERSAO) msg(atualizar(dir, v));
    return;
  }

  const novo = !fs.existsSync(path.join(dir, 'CLAUDE.md')) && !fs.existsSync(path.join(dir, '.claude'));
  if (novo) {
    const feitos = instalar(dir, true);
    msg(`M80: new project prepared with template v${VERSAO} (${feitos.join(', ')}). Look: Ctrl+Alt+F9. Router mode: /m80-modo.`);
    return;
  }
  if (!jaAvisado(dir)) {
    msg(`M80: this project does not use template v${VERSAO}. To adopt it without overwriting anything: node "${path.join(os.homedir(), '.claude', 'hooks', 'm80', 'iniciar-projeto.js')}" --adotar "${dir}"`);
  }
}

try { principal(); } catch (err) {
  // the start hook must never block the session
  try { fs.appendFileSync(path.join(os.homedir(), '.claude', 'hooks', 'm80', 'erros.log'), `${new Date().toISOString()} iniciar-projeto: ${err && err.stack}\n`); } catch { /* ok */ }
}
