#!/usr/bin/env node
// Global "rules guard" hook (M80 template v21): enforces by blocking the rule
//   do not guess, do not state false data, do not hide failures,
//   do not make decisions that belong to the user.
// It acts on two events (the same file, registered for both):
//
// Stop (when the model finishes its answer):
//   1. Guessing: a supposition presented as a result ("should work", "probably", "I believe",
//      "in theory"... in English or Portuguese) outside a "NOT VERIFIED:" line -> sends the answer back.
//   2. Visual delivery without looking at the real screen: the round touched a visual file (css, html,
//      media/, theme, layout, monitor) and the answer presents it as done/fixed, but the
//      validador-visual subagent did not run in the round and there is no "NOT VERIFIED:" -> sends the answer back.
//
// PreToolUse (before a tool runs):
//   3. A decision that belongs to the user: git commit/push/merge/rebase/tag/reset --hard, deleting a folder
//      (rm -r, Remove-Item -Recurse, git clean) outside a temp folder, or editing CLAUDE.md /
//      settings*.json, when the user's latest requests do not mention it -> blocks the tool.
//
// Never loops: each check sends back / blocks at most once per user request.
// M80_GUARDIAO=0 turns it off. Log in ~/.claude/hooks/m80/guardiao.log.
// The Portuguese and English markers VERIFICADO:/VERIFIED: and NÃO VERIFICADO:/NOT VERIFIED: are both accepted.
const { lerEntrada, registrar, rodadaAtual, textoFinal, jaBloqueou } = require('./m80-comum');
const fs = require('fs');

const entrada = lerEntrada();
if (process.env.M80_GUARDIAO === '0') process.exit(0);
const evento = entrada.hook_event_name || (entrada.tool_name ? 'PreToolUse' : 'Stop');

// ---------- leitura do transcript ----------
function linhasDoTranscript(caminho) {
  try {
    return fs.readFileSync(caminho, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
// text of the last N real user requests (does not count tool results or system messages)
function pedidosRecentes(caminho, n) {
  const out = [];
  const es = linhasDoTranscript(caminho);
  for (let i = es.length - 1; i >= 0 && out.length < n; i--) {
    const e = es[i];
    if (e.type !== 'user' || !e.message || e.isMeta) continue;
    const c = e.message.content;
    if (typeof c === 'string') { out.push(c); continue; }
    if (Array.isArray(c) && !c.every(b => b && b.type === 'tool_result')) out.push(c.filter(b => b && b.type === 'text').map(b => b.text).join('\n'));
  }
  return out.join('\n').toLowerCase();
}
function usosDeFerramenta(entradas) {
  const usos = [];
  for (const e of entradas) {
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    for (const b of e.message.content) if (b && b.type === 'tool_use') usos.push({ nome: b.name, input: b.input || {} });
  }
  return usos;
}

// ---------- Stop ----------
const INFERENCIA = [
  /\bdeve(ria)?\s+(funcionar|estar\s+(ok|certo|funcionando|corrigid[oa])|resolver|dar\s+certo|passar)\b/i,
  /\bprovavelmente\b/i,
  /\b(acredito|imagino|suponho|presumo|creio)\s+que\b/i,
  /\bem\s+tese\b/i,
  /\bteoricamente\b/i,
  /\bparece\s+(que\s+)?(funcionar|estar\s+(ok|certo|funcionando))\b/i,
  /\b(should|probably)\s+(work|be\s+fine|be\s+fixed)\b/i,
  /\bprobably\b/i,
  /\bi\s+(believe|assume|suppose|guess)\b/i,
  /\bin\s+theory\b/i,
];
const PRONTO = /\b(est[áa]|ficou|fica)\s+(pront[oa]|corrigid[oa]|resolvid[oa]|funcionando|certo)\b|\b(corrigi|resolvi|consertei|instalei|entreguei)\b|\bpode\s+(conferir|usar)\b|\b(is|are)\s+(done|ready|fixed|working)\b|\bi\s+(fixed|resolved|installed|delivered)\b/i;
const VISUAL = /\.(css|html?|svg)$|[\\/]media[\\/]|monitor|tema|theme|layout|visual|maquete|prototip/i;
const MARCA_NAO = /(N[ÃA]O\s+VERIFICADO|NOT\s+VERIFIED):/i;

function stop() {
  if (entrada.stop_hook_active) return;
  const { entradas, idPedido } = rodadaAtual(entrada.transcript_path || '');
  const texto = entrada.last_assistant_message || textoFinal(entradas);
  if (!texto) return;
  const usos = usosDeFerramenta(entradas);

  // 1. guessing outside a "NOT VERIFIED:" line
  // text inside quotes or backticks is a quotation (example, rule), not a claim: it is left out
  const semCitacao = l => l.replace(/"[^"\n]*"|“[^”\n]*”|`[^`\n]*`|«[^»\n]*»/g, ' ');
  const linhaInferida = texto.split('\n').map(semCitacao).find(l => !MARCA_NAO.test(l) && INFERENCIA.some(re => re.test(l)));
  if (linhaInferida && !jaBloqueou(`guardiao-inferencia:${entrada.session_id}:${idPedido}`)) {
    const trecho = (INFERENCIA.map(re => linhaInferida.match(re)).find(Boolean) || [''])[0];
    registrar('guardiao.log', `RETURNED guess trecho="${trecho}"`);
    return devolver('Project rule: DO NOT GUESS. The answer presents a supposition as a result ("' + trecho + '"). ' +
      'Verify by running something and write VERIFIED: <command and result>, or replace it with NOT VERIFIED: <what would verify it>. Do not assume.');
  }

  // 2. visual delivery without the validador-visual on the real screen
  const mexeuVisual = usos.some(u => /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(u.nome) && VISUAL.test(String(u.input.file_path || u.input.path || '')));
  const validou = usos.some(u => u.nome === 'Agent' && /validador-visual/i.test(String(u.input.subagent_type || '')));
  if (mexeuVisual && PRONTO.test(texto) && !validou && !MARCA_NAO.test(texto) && !jaBloqueou(`guardiao-visual:${entrada.session_id}:${idPedido}`)) {
    registrar('guardiao.log', 'RETURNED visual delivery without validador-visual');
    return devolver('Project rule: a visual delivery only counts when checked on the REAL screen. This round touched a visual file and the answer presents it as done, ' +
      'but the validador-visual subagent did not run. Run the validador-visual (real-screen screenshot) before claiming it, ' +
      'or replace the claim with NOT VERIFIED: <what is still to be seen on the real screen>.');
  }
  registrar('guardiao.log', `released stop tools=${usos.length} visual=${mexeuVisual} validou=${validou}`);
}
function devolver(motivo) { process.stdout.write(JSON.stringify({ decision: 'block', reason: motivo })); }

// ---------- PreToolUse ----------
const TEMP = /(\\|\/)(temp|tmp)(\\|\/)|scratchpad|node_modules|\.vsix\b/i;
function preToolUse() {
  const nome = entrada.tool_name || '', inp = entrada.tool_input || {};
  let decisao = null; // { o: 'what it is', pede: [words that authorize it] }
  if (nome === 'Bash' || nome === 'PowerShell') {
    const cmd = String(inp.command || '');
    if (/\bgit\s+(commit|push|merge|rebase|tag)\b/i.test(cmd)) {
      const verbo = cmd.match(/\bgit\s+(commit|push|merge|rebase|tag)\b/i)[1].toLowerCase();
      decisao = { o: 'git ' + verbo, pede: [verbo, verbo === 'commit' ? 'comit' : verbo, verbo === 'push' ? 'envia' : verbo] };
    } else if (/\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-\w*f/i.test(cmd)) {
      decisao = { o: 'discard git changes', pede: ['reset', 'descart', 'discard', 'clean', 'limpa'] };
    } else if ((/\brm\s+-\w*r/i.test(cmd) || /Remove-Item\b[^|;]*-Recurse/i.test(cmd)) && !TEMP.test(cmd)) {
      decisao = { o: 'delete a folder', pede: ['apag', 'remov', 'delet', 'exclu', 'limp', 'clean', 'erase', 'wipe'] };
    }
  } else if (/^(Edit|Write|MultiEdit)$/.test(nome)) {
    const arq = String(inp.file_path || '');
    if (/(^|[\\/])CLAUDE\.md$/i.test(arq)) decisao = { o: 'edit CLAUDE.md', pede: ['claude.md', 'regra', 'instru', 'rule'] };
    else if (/(^|[\\/])settings(\.local)?\.json$/i.test(arq)) decisao = { o: 'edit ' + arq.split(/[\\/]/).pop(), pede: ['settings', 'configura', 'permiss', 'hook'] };
  }
  if (!decisao) return;
  const pedidos = pedidosRecentes(entrada.transcript_path || '', 3);
  if (decisao.pede.some(p => pedidos.includes(p))) { registrar('guardiao.log', `released ${decisao.o} (the user request mentions it)`); return; }
  registrar('guardiao.log', `BLOCKED ${decisao.o}`);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: 'Project rule: DO NOT MAKE DECISIONS THAT ARE NOT YOURS TO MAKE. "' + decisao.o + '" is the user\'s decision and their latest requests do not mention it. ' +
      'Ask the user first; do not try another way to do the same thing.' } }));
}

if (evento === 'Stop') stop();
else if (evento === 'PreToolUse') preToolUse();
