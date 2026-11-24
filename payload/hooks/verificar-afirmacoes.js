#!/usr/bin/env node
// Global Stop hook: sends the answer back to the model when it claims a RESULT
// ("it works", "I fixed it", "tested", "all good", in English or Portuguese) with no tool
// run in this round and without the markers VERIFIED: / NOT VERIFIED: (or VERIFICADO: / NÃO VERIFICADO:).
// Successor of verificar-afirmacoes.py from template v19, with no Python dependency.
// M80_VERIFICACAO=0 turns it off.
const { lerEntrada, registrar, rodadaAtual, ferramentasUsadas, textoFinal, jaBloqueou } = require('./m80-comum');

const AFIRMACOES = [
  /est[áa]\s+(funcionando|corrigid[oa]|pront[oa]|resolvid[oa]|ok\b)/i,
  /\btudo\s+(certo|ok|funcionando|em\s+(\w+\s+){0,2}ordem)\b/i,
  /\b(foi|est[áa]|ficou)\s+(testad[oa]|validad[oa]|verificad[oa])\b/i,
  /\bfuncion(a|ando|ou)\s+(perfeitamente|corretamente|normalmente|direitinho|agora)\b/i,
  /\b(corrigi|resolvi|consertei|testei|validei)\b/i,
  /\bos\s+testes\s+passa(ram|m)\b/i,
  /\bagora\s+(vai|funciona|deve\s+funcionar)\b/i,
  /\b(it\s+works|is\s+(fixed|working)|tests\s+pass(ed)?|all\s+good)\b/i,
  /\bi\s+(fixed|tested|resolved|verified)\b/i,
];
const MARCADOR = /\b((N[ÃA]O|NOT)\s+)?(VERIFICADO|VERIFIED):/i;

const entrada = lerEntrada();
if (process.env.M80_VERIFICACAO === '0' || entrada.stop_hook_active) process.exit(0);

const { entradas, idPedido } = rodadaAtual(entrada.transcript_path || '');
const texto = entrada.last_assistant_message || textoFinal(entradas);
const usadas = ferramentasUsadas(entradas);
const afirmou = AFIRMACOES.find(re => re.test(texto));

if (!afirmou || usadas.length > 0 || MARCADOR.test(texto)) {
  registrar('verificacao.log', `released claimed=${!!afirmou} tools=${usadas.length}`);
  process.exit(0);
}
if (jaBloqueou(`stop:${entrada.session_id}:${idPedido}`)) {
  registrar('verificacao.log', 'released (already sent back once for this request)');
  process.exit(0);
}
registrar('verificacao.log', `RETURNED excerpt="${(texto.match(afirmou) || [''])[0]}"`);
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason:
    'The answer claims a result ("' + (texto.match(afirmou) || [''])[0] + '") but no tool was run in this round. ' +
    'Run something that produces the evidence and mark it with VERIFIED: <command and result>, ' +
    'or, if it cannot be verified now, replace the sentence with NOT VERIFIED: <what would verify it>.',
}));
