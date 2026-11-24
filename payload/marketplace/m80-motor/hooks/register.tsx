// m80-motor: the engine of the M80 template v21.
//
// 1. Router: picks model and effort ONCE per round (at turn.step 0 of the
//    main loop) and keeps the choice in the following steps of the same round,
//    so the prompt cache is not rewritten at every step. Subagents keep
//    the model from their own frontmatter.
// 2. Guard: denies destructive commands in Bash and PowerShell, and a .sh
//    opened as a file (it opens a stray git-bash window on Windows).
// 3. Status: mode, model, effort, context and estimated cost.
// 4. Compaction: asks the summary to preserve tasks, decisions and verifications.
// 5. Commands: /m80-modo, /m80-status, /m80-ficha, /m80-continuar and /m80-barra.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Estilo, Painel } from '../types'
import { agrupar, pecasDaBarra } from './barra'

type Modo = 'auto' | 'economico' | 'normal' | 'maximo' | 'fixo'
type Classe = 'continuacao' | 'simples' | 'normal' | 'complexo'
type Esforco = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type Decisao = { model: string; effort: Esforco; classe: Classe | Modo; motivo: string }

const MODOS: readonly Modo[] = ['auto', 'economico', 'normal', 'maximo', 'fixo']

const POR_CLASSE: Record<Exclude<Classe, 'continuacao'>, { model: string; effort: Esforco }> = {
  simples: { model: 'sonnet', effort: 'low' },
  normal: { model: 'sonnet', effort: 'medium' },
  complexo: { model: 'opus', effort: 'high' },
}

const POR_MODO: Record<Exclude<Modo, 'auto' | 'fixo'>, { model: string; effort: Esforco }> = {
  economico: { model: 'sonnet', effort: 'low' },
  normal: { model: 'sonnet', effort: 'medium' },
  maximo: { model: 'opus', effort: 'high' },
}

// Requests that are almost always a continuation of the previous round: keep the model.
const CONTINUACAO = /^\s*(ok|okay|sim|s|pode|pode (seguir|continuar|executar|fazer)[^\n]{0,40}|segue|continua|continue|vai|manda|isso|beleza|blz|perfeito|certo|confirmo|aprovado|faz|faça|yes|y|go ahead|go on|proceed|do it|carry on|sounds good|looks good|approved|confirmed|lgtm)[\s.!]*$/i
// Cheap shortcuts before spending a classification.
const SIMPLES = /^\s*(\/(commit|status|diff|log)\b|git (status|diff|log|add|commit|push|pull)\b|mostr|list|ler |leia |abr(e|a) |qual (é|e) |onde (fica|está|esta)|show |read |open |what is |where is )/i
const COMPLEXO = /(arquitet|refator|depur|debug|investig|causa raiz|root cause|plano|planej|estrat[eé]g|migra[cç][aã]o|seguran[cç]a|performance|desempenho|desenh(e|ar|o) (o|a|um|uma)|por que .*(falh|quebr|trav)|architect|refactor|investigat|strategy|migration|security|why .*(fail|break|hang))/i

// ---------- guarda ----------
type Regra = { re: RegExp; motivo: string }
const REGRAS: readonly Regra[] = [
  { re: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive)\b[^|;&]*\s(\/|~|\$HOME|\/c\/?|[A-Za-z]:[\\/]?)(\s|$)/i, motivo: 'rm recursivo na raiz ou no home' },
  { re: /\bRemove-Item\b(?=.*-Recurse)(?=.*\s(['"]?)([A-Za-z]:\\?|~|\$env:USERPROFILE|\$HOME)\1(\s|$))/i, motivo: 'Remove-Item -Recurse na raiz de um disco ou no perfil' },
  { re: /\b(rd|rmdir)\s+\/s\b[^|;&]*\s[A-Za-z]:\\?(\s|$)/i, motivo: 'rmdir /s na raiz de um disco' },
  { re: /\bformat(\.com)?\s+[A-Za-z]:/i, motivo: 'formatar disco' },
  { re: /\bgit\s+push\b[^|;&]*\s(--force(?!-with-lease)|-f)\b/i, motivo: 'git push --force (use --force-with-lease se precisar mesmo)' },
  { re: /\bgit\s+reset\s+--hard\b/i, motivo: 'git reset --hard discards unsaved work' },
  { re: /\bgit\s+clean\s+-[a-z]*f/i, motivo: 'git clean -f deletes untracked files' },
  { re: /\b(aws)\s+\S+\s+(create|delete|update|put|modify|remove|terminate|run|invoke|deploy|attach|detach|stop|start)-/i, motivo: 'AWS command that changes a resource (read-only without authorization)' },
  { re: /\baws\s+s3\s+(cp|mv|rm|sync|mb|rb)\b/i, motivo: 'aws s3 write (read-only without authorization)' },
  { re: /\baz\s+(\S+\s+){1,3}(create|delete|update|set|start|stop|restart|deallocate|scale|purge)\b/i, motivo: 'comando Azure que altera recurso' },
  { re: /\bgcloud\s+(\S+\s+){1,3}(create|delete|update|deploy|set|start|stop|resize|enable|disable)\b/i, motivo: 'comando GCP que altera recurso' },
  { re: /\b(npm|pnpm|yarn)\s+publish\b/i, motivo: 'publicar pacote' },
  { re: /\bStop-Computer\b|\bRestart-Computer\b|\bshutdown(\.exe)?\s+\/[srp]\b/i, motivo: 'shutting down or restarting the machine' },
]
// .sh aberto como arquivo no Windows sobe o git-bash.exe numa janela solta.
const SH_COMO_ARQUIVO = /(^|[;&|]\s*)(\.[\\/][^\s]+\.sh\b|start\s+[^\s]+\.sh\b|cmd(\.exe)?\s+\/c\s+[^\s]+\.sh\b|Invoke-Item\s+[^\s]+\.sh\b)/i

function verificarComando(cmd: string): string | undefined {
  for (const r of REGRAS) if (r.re.test(cmd)) return r.motivo
  return undefined
}

function curto(model: string): string {
  const m = model.toLowerCase()
  if (m.includes('opus')) return 'opus'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('fable')) return 'fable'
  return model
}

// process state (restarts on a reload; the mode persists in $.store)
let modo: Modo = 'auto'
const textoDaRodada = new Map<string, string>()
const decisoes = new Map<string, Decisao>()
let ultima: Decisao | undefined
let ultimoCusto = ''

// ---------- barra de status ao vivo ----------
const ESTILOS: readonly Estilo[] = ['dbase', 'scoreboard', 'lotus', 'turbo', 'medidor', 'moderna', 'auto']
const PAINEL_INICIAL: Painel = {
  estado: 'pronto', modo: 'auto', modelo: '', effort: '', ctx: null, custo: null,
  ferramenta: '', detalhe: '', inicio: 0, agora: 0, quadro: 0, ferramentas: 0,
}
const painelA = atom({ plugin: 'm80-motor', key: 'painel' } as const, PAINEL_INICIAL)
const estiloA = atom({ plugin: 'm80-motor', key: 'estilo' } as const, 'auto' as Estilo)
let temaModerno = false
let lerTemaEm = 0
let relogio: { cancel: () => void } | undefined
let barraDesenhada = false

async function mudarPainel($: any, patch: Partial<Painel>) {
  await update($, painelA, (p: Painel) => ({ ...p, ...patch }))
  void gravarAoVivo($)
}

// active VS Code theme, written by the M80 extension to .sessions/m80-tema.json; read about every 5 s
async function lerTema($: any) {
  if (Date.now() - lerTemaEm < 5000) return
  lerTemaEm = Date.now()
  try {
    const arq = await caminhoDoArquivo($)
    if (!arq) return
    const f = arq.slice(0, arq.lastIndexOf('/')) + '/m80-tema.json'
    if (!(await $.fs.exists(f))) { temaModerno = false; return }
    temaModerno = JSON.parse(String(await $.fs.read(f))).moderno === true
  } catch { /* no file: default style */ }
}

function ligarRelogio($: any) {
  if (relogio) return
  relogio = $.clock.every(250, () => {
    void lerTema($)
    void update($, painelA, (p: Painel) => ({ ...p, quadro: p.quadro + 1, agora: Date.now() }))
  })
}

function desligarRelogio() {
  relogio?.cancel()
  relogio = undefined
}

function detalheDe(e: any): string {
  const v = e.command ?? e.file_path ?? e.pattern ?? e.url ?? e.description ?? e.prompt ?? ''
  const s = String(v).replace(/\s+/g, ' ').trim()
  // file path: the end matters (the file name); cut from the start
  if (e.file_path && s.length > 120) return s.slice(0, 24) + '…' + s.slice(-95)
  return s.slice(0, 120)
}

// ---------- continuity: handoff note, context metrics and cache ----------
// At 60, 75 and 85% of the context, a parallel question (fork, low effort, read from the cache)
// writes the note to .sessions/continuidade.md. At 85% the note becomes pending and the
// tab rotation is requested from the M80 extension. The global hook continuidade.js
// injects the note into the new conversation (or after a compaction).
const MARCOS = [60, 75, 85]
const marcosFeitos = new Set<number>()
let fichaEmAndamento = false
let compactacoes = 0
let cacheLido = 0
let cacheTotal = 0
let ultimaFicha: number | null = null
let rotacaoPedida: number | null = null
let slotFicha = 0
const metricas: any = { livre: null, reserva: null, usados: null, janela: null, categorias: [], cacheRodada: null, cacheSessao: null }

const PROMPT_FICHA = [
  'Write the CONTINUITY NOTE for this conversation, in the language the user has been writing in, so that a new conversation can resume the work without losing anything.',
  'Answer with the note only, in this format and with these headings in capitals:',
  'OBJECTIVE: one or two lines about the work as a whole.',
  'DECISIONS WITH THE USER: a short list of the decisions and preferences the user gave, with the reason when there is one.',
  'FILES TOUCHED: relative paths of the files created or changed, one per line.',
  'TASKS: what is in progress, what is pending and what is done.',
  'VERIFICATION: what is VERIFIED (with the command) and what is NOT VERIFIED.',
  'KNOWN PROBLEMS: pitfalls and errors already found that must not happen again.',
  'NEXT STEP: the exact action that comes next.',
  'Be specific: file names, commands, versions and numbers. No generic sentences. At most 60 lines.',
].join('\n')

async function raizSessoes($: any): Promise<string | null> {
  const arq = await caminhoDoArquivo($)
  return arq ? arq.slice(0, arq.lastIndexOf('/')) : null
}

async function escreverFicha($: any, motivo: string, final: boolean) {
  if (fichaEmAndamento) return false
  const dir = await raizSessoes($)
  if (!dir) return false
  fichaEmAndamento = true
  try {
    const r: any = await $.model.fork({ prompt: PROMPT_FICHA, effort: 'low' })
    if (!r || !r.isAnswered || !String(r.text || '').trim()) return false
    const agora = Date.now()
    const p = await read($, painelA)
    const cab = '# CONTINUITY NOTE\n\n' +
      '- generated: ' + new Date(agora).toISOString() + '\n' +
      '- reason: ' + motivo + '\n' +
      '- context: ' + (p.ctx == null ? '?' : p.ctx + '%') + ' · model ' + (p.modelo || '?') + '\n\n'
    const texto = cab + String(r.text).trim() + '\n'
    await $.fs.write(dir + '/continuidade.md', texto)
    slotFicha = (slotFicha % 5) + 1
    await $.fs.write(dir + '/fichas/ficha-' + slotFicha + '.md', texto)
    ultimaFicha = agora
    if (final) {
      rotacaoPedida = agora
      await $.fs.write(dir + '/continuidade.json', JSON.stringify({ pendente: true, criada: agora, motivo, ctx: p.ctx }))
    }
    void gravarAoVivo($)
    return true
  } catch {
    return false
  } finally {
    fichaEmAndamento = false
  }
}

async function medirContexto($: any) {
  try {
    const u = await $.session.usage({ breakdown: 'summary' })
    const b = u.context && u.context.breakdown
    if (b && Array.isArray(b.categories)) {
      const soma = (k: string) => b.categories.filter((c: any) => c.kind === k).reduce((n: number, c: any) => n + (c.tokens || 0), 0)
      metricas.livre = soma('free')
      metricas.reserva = soma('buffer')
      metricas.usados = soma('used')
      metricas.janela = b.maxTokens ?? u.context.window
      metricas.categorias = b.categories.filter((c: any) => c.kind === 'used').map((c: any) => ({ nome: c.name, tokens: c.tokens }))
    }
  } catch { /* sem detalhamento */ }
}

function contarCache(usage: any) {
  if (!usage) return
  // tokens por modelo, para a aba Economia calcular o que o roteador e o cache pouparam
  const m = curto(String(usage.model || 'outro'))
  const pm = metricas.porModelo || (metricas.porModelo = {})
  const t = pm[m] || (pm[m] = { rodadas: 0, entrada: 0, saida: 0, cacheLido: 0, cacheEscrito: 0 })
  t.rodadas++
  t.entrada += usage.input_tokens || 0
  t.saida += usage.output_tokens || 0
  t.cacheLido += usage.cache_read_input_tokens || 0
  t.cacheEscrito += usage.cache_creation_input_tokens || 0
  const lido = usage.cache_read_input_tokens || 0
  const total = lido + (usage.cache_creation_input_tokens || 0) + (usage.input_tokens || 0)
  if (total > 0) {
    metricas.cacheRodada = Math.round(100 * lido / total)
    cacheLido += lido
    cacheTotal += total
    metricas.cacheSessao = Math.round(100 * cacheLido / cacheTotal)
  }
}

async function cuidarDosMarcos($: any) {
  const p = await read($, painelA)
  const ctx = p.ctx
  if (ctx == null) return
  const devidos = MARCOS.filter(m => ctx >= m && !marcosFeitos.has(m))
  if (!devidos.length) return
  const marco = devidos[devidos.length - 1] ?? 85
  for (const m of devidos) marcosFeitos.add(m)
  void escreverFicha($, 'marco de ' + marco + '% do contexto', marco >= 85)
}

// ---------- live bridge to the M80 Console tab ----------
// Writes .sessions/m80-ao-vivo.json (only in projects that have a .sessions folder).
// Keeps the latest tool events, which are the Recorder's "tape".
type Evento = { id: string; agente: string; tool: string; detalhe: string; ini: number; fim: number | null; ok: boolean | null }
const eventos: Evento[] = []
let seqEvento = 0
let ultimaGravacao = 0
let gravacaoAgendada = false
let caminhoAoVivo: string | null | undefined

async function caminhoDoArquivo($: any): Promise<string | null> {
  if (caminhoAoVivo !== undefined) return caminhoAoVivo
  try {
    const raiz = String(await $.session.root()).split(String.fromCharCode(92)).join('/')
    caminhoAoVivo = (await $.fs.exists(raiz + '/.sessions')) ? raiz + '/.sessions/m80-ao-vivo.json' : null
  } catch { caminhoAoVivo = null }
  return caminhoAoVivo
}

async function gravarAoVivo($: any) {
  const agora = Date.now()
  if (agora - ultimaGravacao < 400) {
    if (!gravacaoAgendada) { gravacaoAgendada = true; $.clock.after(450, () => { gravacaoAgendada = false; void gravarAoVivo($) }) }
    return
  }
  ultimaGravacao = agora
  const arquivo = await caminhoDoArquivo($)
  if (!arquivo) return
  let agentes: any[] = []
  try {
    agentes = (await $.agent.list()).map((a: any) => ({
      id: a.id, nome: a.label || a.description || a.type, tipo: a.type, status: a.taskStatus,
      modelo: a.model ?? '', effort: a.effort ?? '', tokens: a.tokenCount, amostras: (a.tokenSamples || []).slice(-20), inicio: a.startTime,
    }))
  } catch { /* sem agentes */ }
  let limites: any[] = []
  try { const u = await $.session.usage(); limites = (u.rateLimits || []).map((r: any) => ({ nome: r.kind, pct: r.percentUsed, renova: r.resetsAt ?? null })) } catch { /* no read */ }
  const painel = await read($, painelA)
  const continuidade = { ...metricas, compactacoes, ultimaFicha, rotacaoPedida, marcos: [...marcosFeitos] }
  const dados = { versao: 2, atualizado: agora, sessao: { ...painel, limites }, agentes, continuidade, eventos: eventos.slice(-300) }
  try { await $.fs.write(arquivo, JSON.stringify(dados)) } catch { /* no write: the tab shows the last saved version */ }
}

async function pintarStatus($: any) {
  let ctx = ''
  let pct: number | null = null
  let usd: number | null = null
  try {
    const u = await $.session.usage()
    if (typeof u.context.percent === 'number') { pct = Math.round(u.context.percent); ctx = ` | ctx ${pct}%` }
    if (u.cost) { usd = u.cost.usd; ultimoCusto = ` | US$ ${u.cost.usd.toFixed(2)} est.` }
  } catch {
    // no numbers: shows only what is available
  }
  let modeloSessao = ''
  if (!ultima) { try { modeloSessao = String(await $.session.model()) } catch { /* no read */ } }
  await mudarPainel($, { modo, modelo: ultima?.model ?? modeloSessao, effort: ultima?.effort ?? '', ctx: pct, custo: usd })
  // the text line only appears while the colored bar has not been drawn (surface without a bar)
  if (barraDesenhada) { $.ui.status(undefined); return }
  const d = ultima ? `${curto(ultima.model)}/${ultima.effort}` : 'waiting'
  $.ui.status(`M80 ${modo.toUpperCase()} | ${d}${ctx}${ultimoCusto}`)
}

async function classificar($: any, texto: string): Promise<{ classe: Classe; motivo: string }> {
  const t = texto.trim()
  if (t.length === 0) return { classe: 'continuacao', motivo: 'sem texto' }
  if (CONTINUACAO.test(t)) return { classe: 'continuacao', motivo: 'short continuation answer' }
  if (COMPLEXO.test(t)) return { classe: 'complexo', motivo: 'palavra de tarefa complexa' }
  if (t.length < 160 && SIMPLES.test(t)) return { classe: 'simples', motivo: 'pedido simples' }
  try {
    const rotulo = await $.model.classify(
      `Classify the effort this request to a programming agent requires.\n` +
        `simples = lookup, reading, git command, small tweak.\n` +
        `normal = implement or fix something well defined.\n` +
        `complexo = architecture, hard debugging, planning, several stages, design decision.\n` +
        `continuacao = only approves or tells it to go on with what was already in progress.\n\nRequest:\n${t.slice(0, 4000)}`,
      ['simples', 'normal', 'complexo', 'continuacao'],
      { model: 'haiku' },
    )
    if (rotulo === 'simples' || rotulo === 'normal' || rotulo === 'complexo' || rotulo === 'continuacao') {
      return { classe: rotulo, motivo: 'classificado pelo haiku' }
    }
  } catch {
    // classification unavailable: falls back to normal
  }
  return { classe: 'normal', motivo: 'default' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    try {
      const salvo = await $.store.get('modo')
      if (typeof salvo === 'string' && (MODOS as readonly string[]).includes(salvo)) modo = salvo as Modo
    } catch {
      // primeira vez
    }
    await $.command.register({
      name: 'm80-modo',
      description: 'M80 router mode: auto, economico, normal, maximo or fixo',
      argumentHint: '[auto|economico|normal|maximo|fixo]',
    })
    await $.command.register({ name: 'm80-status', description: 'Shows the mode, the last router decision and the context' })
    await $.command.register({ name: 'm80-ficha', description: 'Writes the continuity note of this conversation now' })
    await $.command.register({ name: 'm80-continuar', description: 'Writes the final note and hands the work over to a new conversation' })
    await $.command.register({
      name: 'm80-barra',
      description: 'Estilo da barra de status M80: dbase, scoreboard, lotus, turbo, medidor, moderna ou auto (moderna nos temas atuais)',
      argumentHint: '[dbase|scoreboard|lotus|turbo|medidor|moderna|auto]',
    })
    try {
      const e2 = await $.store.get('estilo')
      if (typeof e2 === 'string' && (ESTILOS as readonly string[]).includes(e2)) await update($, estiloA, () => e2 as Estilo)
    } catch {
      // default: dbase
    }
    await pintarStatus($)
    return r
  })

  on('command.run', { command: 'm80-ficha' }, async $ => {
    const ok = await escreverFicha($, 'requested by the user (/m80-ficha)', false)
    return { text: ok ? 'Continuity note written to .sessions/continuidade.md.' : 'Could not write the note (project without a .sessions folder, or the parallel question did not answer).', isTextDisplayOnly: true }
  })

  on('command.run', { command: 'm80-continuar' }, async $ => {
    const ok = await escreverFicha($, 'handover to another conversation (/m80-continuar)', true)
    return { text: ok ? 'Final note written and marked as pending. The M80 extension opens the new conversation; if it does not, open a new conversation in this project and the note is loaded by itself.' : 'Could not write the final note.', isTextDisplayOnly: true }
  })

  on('command.run', { command: 'm80-barra' }, async ($, e) => {
    const pedido = e.args.trim().toLowerCase()
    if (!pedido) return { text: `Current bar: ${await read($, estiloA)}. Options: ${ESTILOS.join(', ')}.`, isTextDisplayOnly: true }
    if (!(ESTILOS as readonly string[]).includes(pedido)) {
      return { text: `Estilo desconhecido: ${pedido}. Use um destes: ${ESTILOS.join(', ')}.`, isTextDisplayOnly: true }
    }
    await update($, estiloA, () => pedido as Estilo)
    await $.store.set('estilo', pedido)
    return { text: `Barra M80: ${pedido}.`, isTextDisplayOnly: true }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, painelA)
    const escolhido = await read($, estiloA)
    const estilo: Estilo = escolhido === 'auto' ? (temaModerno ? 'moderna' : 'dbase') : escolhido
    const colunas = Math.max(40, Number((e.props as any).bodyColumns) || 100)
    const { Box, Text } = $.ui.resolve(e) as any
    if (!barraDesenhada) { barraDesenhada = true; $.ui.status(undefined) }
    const pecas = agrupar(pecasDaBarra(estilo, p, colunas))
    return (
      <Box flexDirection="row" flexWrap="nowrap">
        {pecas.map(x => (
          <Text mono color={x.cor} backgroundColor={x.fundo} bold={x.negrito}>{x.t}</Text>
        ))}
      </Box>
    )
  })

  on('command.run', { command: 'm80-modo' }, async ($, e) => {
    const pedido = e.args.trim().toLowerCase()
    if (!pedido) {
      return { text: `Current mode: ${modo}. Options: ${MODOS.join(', ')}.`, isTextDisplayOnly: true }
    }
    if (!(MODOS as readonly string[]).includes(pedido)) {
      return { text: `Modo desconhecido: ${pedido}. Use um destes: ${MODOS.join(', ')}.`, isTextDisplayOnly: true }
    }
    modo = pedido as Modo
    await $.store.set('modo', modo)
    await pintarStatus($)
    const explica: Record<Modo, string> = {
      auto: 'each request is classified; sonnet for simple and normal, opus/high for complex',
      economico: 'always sonnet/low',
      normal: 'always sonnet/medium',
      maximo: 'always opus/high',
      fixo: 'the router does not interfere; /model and /effort apply',
    }
    return { text: `M80 mode: ${modo} (${explica[modo]}).`, isTextDisplayOnly: true }
  })

  on('command.run', { command: 'm80-status' }, async $ => {
    let ctx = 'sem leitura'
    try {
      const u = await $.session.usage()
      ctx = `${u.context.tokens ?? '?'} de ${u.context.window} tokens (${Math.round(u.context.percent ?? 0)}%)`
    } catch {
      // ignora
    }
    const modelo = await $.session.model()
    const d = ultima ? `${ultima.model}/${ultima.effort} (${ultima.classe}: ${ultima.motivo})` : 'nenhuma rodada roteada ainda'
    return {
      text: `M80 motor\n  mode: ${modo}\n  session model: ${modelo}\n  last decision: ${d}\n  context: ${ctx}`,
      isTextDisplayOnly: true,
    }
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      textoDaRodada.set(e.turnId, e.text)
      const agora = await $.clock.now()
      await mudarPainel($, { estado: 'pensando', inicio: agora, agora, ferramentas: 0, ferramenta: '', detalhe: '' })
      ligarRelogio($)
    }
    return next(e)
  })

  // cada ferramenta acende a barra (EXEC + nome + argumento curto); falha ou bloqueio vira ERRO
  on('tool.call', async ($, e, next) => {
    const doPrincipal = !(e as any).agentId
    const ev: Evento = { id: String(++seqEvento), agente: (e as any).agentId ?? 'principal', tool: e.tool, detalhe: detalheDe(e), ini: Date.now(), fim: null, ok: null }
    eventos.push(ev)
    if (eventos.length > 400) eventos.splice(0, eventos.length - 400)
    if (doPrincipal) {
      const p = await read($, painelA)
      await mudarPainel($, { estado: 'ferramenta', ferramenta: e.tool, detalhe: detalheDe(e), ferramentas: p.ferramentas + 1 })
    } else {
      // subagent tool: writes right at the start, otherwise the panel only sees the action when it finishes
      // (it would never show "running", the yellow LED); measured on 11/21 in m80-mapa.log
      void gravarAoVivo($)
    }
    const r: any = await next(e)
    ev.fim = Date.now()
    ev.ok = !(r && (typeof r.deny === 'string' || r.isError === true))
    void gravarAoVivo($)
    if (doPrincipal) {
      const falhou = r && (typeof r.deny === 'string' || r.isError === true)
      await mudarPainel($, falhou ? { estado: 'erro', detalhe: typeof r.deny === 'string' ? `bloqueado: ${e.tool}` : `${e.tool} falhou` } : { estado: 'pensando' })
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    // subagents and fixed mode: do not touch
    if (e.agentId || modo === 'fixo') {
      const r0 = yield* next(e)
      contarCache((r0 as any)?.usage)
      return r0
    }

    let d = decisoes.get(e.turnId)
    if (!d) {
      if (modo !== 'auto') {
        const alvo = POR_MODO[modo]
        d = { ...alvo, classe: modo, motivo: 'mode fixed by the user' }
      } else {
        const { classe, motivo } = await classificar($, textoDaRodada.get(e.turnId) ?? '')
        if (classe === 'continuacao' && ultima) {
          d = { ...ultima, classe, motivo }
        } else {
          const alvo = POR_CLASSE[classe === 'continuacao' ? 'normal' : classe]
          d = { ...alvo, classe, motivo }
          // Long conversation: downgrading the model rewrites the whole context in the other
          // model's cache. Keeps the model and only lowers the effort.
          if (e.messageCount > 40 && curto(e.model) === 'opus' && alvo.model !== 'opus') {
            d = { model: e.model, effort: alvo.effort, classe, motivo: `${motivo}; long conversation, model kept` }
          }
        }
      }
      decisoes.set(e.turnId, d)
      ultima = d
      if (decisoes.size > 200) decisoes.delete(decisoes.keys().next().value as string)
      void pintarStatus($)
    }
    const r = yield* next({ ...e, model: d.model, effort: d.effort })
    // The per-model usage only exists here (TurnStepResult.usage); it is empty in turn.complete.
    contarCache((r as any)?.usage)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) {
      textoDaRodada.delete(e.turnId)
      desligarRelogio()
      await mudarPainel($, { estado: e.isAborted ? 'erro' : 'pronto', detalhe: e.isAborted ? 'interrompido' : '', agora: await $.clock.now() })
      await medirContexto($)
      await pintarStatus($)
      if (!e.isAborted) await cuidarDosMarcos($)
    }
    return r
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const cmd = String((e as { command?: unknown }).command ?? '')
    const motivo = verificarComando(cmd)
    if (motivo) return { deny: `m80-motor blocked: ${motivo}. If it is intentional, ask the user to run it.` }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => {
    const cmd = String((e as { command?: unknown }).command ?? '')
    if (SH_COMO_ARQUIVO.test(cmd)) {
      return { deny: 'm80-motor: on Windows a .sh opened as a file starts git-bash in a stray window and the output does not come back. Run it with the Bash tool: bash path/x.sh' }
    }
    const motivo = verificarComando(cmd)
    if (motivo) return { deny: `m80-motor blocked: ${motivo}. If it is intentional, ask the user to run it.` }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const extra =
      'Preserve in the summary, in detail: (1) the open tasks and the state of each one; ' +
      '(2) the decisions made with the user and the reason; (3) the files created or changed; ' +
      '(4) what was VERIFIED (with the command) and what is NOT VERIFIED; (5) the next step.'
    await mudarPainel($, { estado: 'compactando' })
    ligarRelogio($)
    // the most recent note becomes the base of the summary (safety net for the rotation)
    let ficha = ''
    if (e.trigger !== 'precompute') {
      compactacoes++
      try { const dir = await raizSessoes($); if (dir && (await $.fs.exists(dir + '/continuidade.md'))) ficha = String(await $.fs.read(dir + '/continuidade.md')) } catch { /* no note */ }
    }
    const base = ficha ? `${extra}\n\nUse this continuity note as the base of the summary and preserve everything in it:\n\n${ficha.slice(0, 12000)}` : extra
    const r = await next({ ...e, instructions: e.instructions ? `${e.instructions}\n\n${base}` : base })
    await mudarPainel($, { estado: 'pensando' })
    return r
  }).catch(($, e, next) => next(e))
}
