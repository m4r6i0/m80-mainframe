// Common functions of the M80 global hooks (Node, no dependencies).
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA = path.join(os.homedir(), '.claude', 'hooks', 'm80');

function lerEntrada() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function registrar(arquivo, linha) {
  try {
    fs.mkdirSync(PASTA, { recursive: true });
    fs.appendFileSync(path.join(PASTA, arquivo), `${new Date().toISOString()} ${linha}\n`);
  } catch {
    // the log is a convenience
  }
}

// Transcript entries since the last real user request
// (a user message that is not only a tool_result).
function rodadaAtual(transcriptPath) {
  let linhas = [];
  try {
    linhas = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch {
    return { entradas: [], idPedido: '' };
  }
  const entradas = [];
  for (const l of linhas) {
    try { entradas.push(JSON.parse(l)); } catch { /* partial line */ }
  }
  let inicio = 0;
  let idPedido = '';
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type !== 'user' || !e.message) continue;
    const c = e.message.content;
    const ehPedido = typeof c === 'string' || (Array.isArray(c) && c.some(b => b && b.type === 'text'));
    const soResultado = Array.isArray(c) && c.length > 0 && c.every(b => b && b.type === 'tool_result');
    if (ehPedido && !soResultado && !e.isMeta) {
      inicio = i + 1;
      idPedido = e.uuid || String(i);
      break;
    }
  }
  return { entradas: entradas.slice(inicio), idPedido };
}

function ferramentasUsadas(entradas) {
  const nomes = [];
  for (const e of entradas) {
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    for (const b of e.message.content) if (b && b.type === 'tool_use') nomes.push(b.name);
  }
  return nomes;
}

function textoFinal(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    const t = e.message.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
    if (t.trim()) return t;
  }
  return '';
}

// Blocks at most once per key, so the model is never trapped in a loop.
function jaBloqueou(chave) {
  const f = path.join(PASTA, 'bloqueios.json');
  let mapa = {};
  try { mapa = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* empty */ }
  if (mapa[chave]) return true;
  mapa[chave] = Date.now();
  const chaves = Object.keys(mapa);
  if (chaves.length > 500) for (const k of chaves.slice(0, chaves.length - 500)) delete mapa[k];
  try { fs.mkdirSync(PASTA, { recursive: true }); fs.writeFileSync(f, JSON.stringify(mapa)); } catch { /* ok */ }
  return false;
}

module.exports = { lerEntrada, registrar, rodadaAtual, ferramentasUsadas, textoFinal, jaBloqueou };
