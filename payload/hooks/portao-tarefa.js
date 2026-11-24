#!/usr/bin/env node
// Global TaskCompleted hook: an implementation task only closes if some command
// ran in this round (Bash, PowerShell or a test). Input fields read from
// binary 2.1.329: task_id, task_subject, task_description.
// Exit 2 refuses the completion and returns the reason to the model. Once per task.
// M80_PORTAO=0 turns it off.
const { lerEntrada, registrar, rodadaAtual, ferramentasUsadas, jaBloqueou } = require('./m80-comum');

const IMPLEMENTACAO = /\b(implement|corrig|consert|cri(a|ar)\s+(o|a|um|uma)?\s*(script|fun[cç][aã]o|m[oó]dulo|hook|extens|plugin|teste|endpoint|api)|instal|configur|integr|migr|refator|fix|build|deploy|testar|test)/i;
const EXECUTORAS = new Set(['Bash', 'PowerShell']);

const e = lerEntrada();
if (process.env.M80_PORTAO === '0') process.exit(0);

const texto = `${e.task_subject || ''}\n${e.task_description || ''}`;
if (!IMPLEMENTACAO.test(texto)) process.exit(0);

const { entradas } = rodadaAtual(e.transcript_path || '');
const rodou = ferramentasUsadas(entradas).some(n => EXECUTORAS.has(n));
if (rodou) {
  registrar('portao.log', `released "${e.task_subject}"`);
  process.exit(0);
}
if (jaBloqueou(`task:${e.session_id}:${e.task_id}`)) process.exit(0);

registrar('portao.log', `REFUSED "${e.task_subject}"`);
process.stderr.write(
  `The task "${e.task_subject}" is an implementation task and no command ran in this round to prove it is done. ` +
  'Run the check (test, build, execution) and only then mark it as completed, with VERIFIED: in the report.'
);
process.exit(2);
