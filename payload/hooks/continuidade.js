#!/usr/bin/env node
// Global SessionStart hook of the M80 Continuity System.
// - startup / clear: if there is a recent PENDING handoff note (written by m80-motor at 85%
//   or by /m80-continuar), injects the note and the open tasks and marks it as consumed.
// - compact: after a compaction, always re-injects the most recent note.
// - resume: does nothing (the resumed conversation already has its own history).
// M80_CONTINUIDADE=0 turns it off.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lerEntrada, registrar } = require('./m80-comum');

const VALIDADE_MS = 24 * 60 * 60 * 1000;

function lerJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

function tarefasAbertas(raiz) {
  const s = lerJson(path.join(raiz, '.claude', 'settings.json'));
  const id = (s && s.env && s.env.CLAUDE_CODE_TASK_LIST_ID) || path.basename(raiz).toLowerCase();
  const dir = path.join(os.homedir(), '.claude', 'tasks', id);
  let nomes = [];
  try { nomes = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; }
  return nomes.map(f => lerJson(path.join(dir, f))).filter(t => t && t.status !== 'completed')
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(t => `  #${t.id} ${t.status === 'in_progress' ? 'in progress' : 'pending'}: ${t.subject}`);
}

function principal() {
  if (process.env.M80_CONTINUIDADE === '0') return;
  const e = lerEntrada();
  const raiz = path.resolve(e.cwd || process.cwd());
  const origem = e.source || 'startup';
  if (origem === 'resume') return;
  const sess = path.join(raiz, '.sessions');
  const arqFicha = path.join(sess, 'continuidade.md');
  const arqEstado = path.join(sess, 'continuidade.json');
  if (!fs.existsSync(arqFicha)) return;

  const estado = lerJson(arqEstado) || {};
  let motivo;
  if (origem === 'compact') {
    motivo = 'the conversation was just compacted; the note below is the state of the work before the compaction';
  } else if (estado.pendente && Date.now() - (estado.criada || 0) < VALIDADE_MS) {
    motivo = 'this conversation continues the work of an earlier conversation that handed over near the context limit';
  } else {
    return;
  }

  const ficha = fs.readFileSync(arqFicha, 'utf8').slice(0, 16000);
  const tarefas = tarefasAbertas(raiz);
  const contexto = [
    'M80 CONTINUITY: ' + motivo + '.',
    'Before answering, read the note and resume from the NEXT STEP. Do not redo what is already VERIFIED.',
    'If anything in the note is ambiguous, check the files it cites before acting.',
    '',
    ficha.trim(),
    '',
    tarefas.length ? 'OPEN TASKS IN THE SHARED LIST:\n' + tarefas.join('\n') : 'No open tasks in the shared list.',
  ].join('\n');

  if (origem !== 'compact') {
    try {
      fs.writeFileSync(arqEstado, JSON.stringify({ ...estado, pendente: false, consumida: Date.now(), consumidaPor: e.session_id || null }));
    } catch { /* sem escrita: a ficha vale uma vez mesmo assim */ }
  }
  registrar('continuidade.log', `${origem} ${raiz} note injected (${ficha.length} characters, ${tarefas.length} tasks)`);
  process.stdout.write(JSON.stringify({
    systemMessage: origem === 'compact' ? 'M80: continuity note re-injected after the compaction.' : 'M80: continuity note loaded; the work continues where it stopped.',
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto },
  }));
}

try { principal(); } catch (err) {
  try { registrar('erros.log', 'continuidade: ' + (err && err.stack)); } catch { /* ok */ }
}
