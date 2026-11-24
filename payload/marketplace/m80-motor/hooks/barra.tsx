// Desenho da barra de status M80 (faixa acima da caixa de mensagem).
// Pure function: receives the surface elements, the panel and the width.
// Raw CGA colors (not from the theme), like the Clipper systems of the time.
import type { Estilo, Painel } from '../types'

const CGA = {
  preto: '#000000', azul: '#0000AA', verde: '#00AA00', ciano: '#00AAAA', vermelho: '#AA0000', magenta: '#AA00AA', marrom: '#AA5500', cinza: '#AAAAAA',
  cinzaEsc: '#555555', azulB: '#5555FF', verdeB: '#55FF55', cianoB: '#55FFFF', vermelhoB: '#FF5555', magentaB: '#FF55FF', amarelo: '#FFFF55', branco: '#FFFFFF',
}

const GIRO = ['|', '/', '-', '\\']

type Peca = { t: string; cor?: string; fundo?: string; negrito?: boolean }

function ocupado(p: Painel): boolean {
  return p.estado !== 'pronto'
}

function tempo(p: Painel): string {
  if (!p.inicio) return '00:00'
  const s = Math.max(0, Math.floor((p.agora - p.inicio) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function palavra(p: Painel): Peca {
  const pisca = p.quadro % 2 === 0
  switch (p.estado) {
    case 'pronto': return { t: ' READY  ', cor: CGA.preto, fundo: CGA.verdeB, negrito: true }
    case 'pensando': return { t: ` THINK ${GIRO[p.quadro % 4]} `, cor: CGA.preto, fundo: pisca ? CGA.amarelo : CGA.branco, negrito: true }
    case 'ferramenta': return { t: ` EXEC  ${GIRO[p.quadro % 4]} `, cor: CGA.preto, fundo: pisca ? CGA.cianoB : CGA.branco, negrito: true }
    case 'compactando': return { t: ` CALC  ${GIRO[p.quadro % 4]} `, cor: CGA.branco, fundo: CGA.magenta, negrito: true }
    case 'erro': return { t: ' ERROR! ', cor: CGA.branco, fundo: pisca ? CGA.vermelho : CGA.vermelhoB, negrito: true }
  }
}

function modelo(p: Painel): string {
  const m = p.modelo.toLowerCase()
  if (m.includes('opus')) return 'OPUS'
  if (m.includes('sonnet')) return 'SONNET'
  if (m.includes('haiku')) return 'HAIKU'
  if (m.includes('fable')) return 'FABLE'
  return (p.modelo || '----').slice(0, 4).toUpperCase()
}

// effort como degraus coloridos: verde, amarelo, vermelho
function degraus(p: Painel): Peca[] {
  const nivel = ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 5 } as Record<string, number>)[p.effort] ?? 0
  const cores = [CGA.verdeB, CGA.verdeB, CGA.amarelo, CGA.vermelhoB, CGA.magentaB]
  const pecas: Peca[] = []
  // same blocks as the CTX ruler (█ full, ░ empty), so both bars have the same height and style
  for (let i = 0; i < 5; i++) pecas.push({ t: i < nivel ? '█' : '░', cor: i < nivel ? cores[i] : CGA.cinzaEsc })
  return pecas
}

// context ruler: fills in green, yellow and red; while Claude
// works, a bright block sweeps the ruler (like the SuperLib/PROGDISP bars)
function regua(p: Painel, largura: number): Peca[] {
  const pct = Math.max(0, Math.min(100, p.ctx ?? 0))
  const cheios = Math.round((pct / 100) * largura)
  const varre = ocupado(p) ? p.quadro % largura : -1
  const pecas: Peca[] = []
  for (let i = 0; i < largura; i++) {
    const frac = i / largura
    const cor = frac < 0.5 ? CGA.verdeB : frac < 0.8 ? CGA.amarelo : CGA.vermelhoB
    if (i === varre) pecas.push({ t: i < cheios ? '█' : '▒', cor: CGA.branco })
    else pecas.push(i < cheios ? { t: '█', cor } : { t: '░', cor: CGA.cinzaEsc })
  }
  return pecas
}

function custo(p: Painel, contador = false): string {
  if (p.custo === null) return contador ? '000.00' : '-.--'
  const v = p.custo.toFixed(2)
  return contador ? v.padStart(6, '0') : v
}

function acao(p: Painel, max: number): string {
  let t = ''
  if (p.estado === 'ferramenta') t = `${p.ferramenta}${p.detalhe ? ': ' + p.detalhe : ''}`
  else if (p.estado === 'pensando') t = 'thinking...'
  else if (p.estado === 'compactando') t = 'compacting the conversation...'
  else if (p.estado === 'erro') t = p.detalhe || 'failed'
  else t = p.ferramentas ? `${p.ferramentas} ${p.ferramentas === 1 ? 'action' : 'actions'} this turn` : 'waiting'
  return t.length > max ? t.slice(0, Math.max(0, max - 1)) + '…' : t
}

const SEP = (fundo: string, cor: string): Peca => ({ t: '║', cor, fundo })

function estiloDbase(p: Painel, colunas: number): Peca[] {
  const f = CGA.ciano
  const ctxCor = (p.ctx ?? 0) >= 80 ? { cor: CGA.branco, fundo: CGA.vermelho } : { cor: CGA.preto, fundo: f }
  const base: Peca[] = [
    palavra(p),
    SEP(f, CGA.preto),
    { t: ` ${modelo(p)} `, cor: CGA.amarelo, fundo: CGA.azul, negrito: true },
    SEP(f, CGA.preto),
    { t: 'EFF ', cor: CGA.preto, fundo: f }, ...degraus(p).map(d => ({ ...d, fundo: CGA.preto })),
    SEP(f, CGA.preto),
    { t: `CTX ${String(p.ctx ?? '--').padStart(3)}% `, ...ctxCor }, ...regua(p, 10).map(d => ({ ...d, fundo: CGA.preto })),
    SEP(f, CGA.preto),
    { t: ` US$ ${custo(p)} `, cor: CGA.amarelo, fundo: CGA.preto },
    SEP(f, CGA.preto),
    { t: ` ${tempo(p)} `, cor: CGA.preto, fundo: f },
    SEP(f, CGA.preto),
  ]
  const usado = base.reduce((n, x) => n + x.t.length, 0)
  const sobra = Math.floor(colunas * 0.8) - usado - 2
  if (sobra >= 8) base.push({ t: ' ' + acao(p, sobra) + ' ', cor: CGA.preto, fundo: f })
  return base
}

function estiloScoreboard(p: Painel, colunas: number): Peca[] {
  const msg = p.estado === 'pronto' ? 'Auto' : p.estado === 'erro' ? 'ERR!' : `Exec ${GIRO[p.quadro % 4]}`
  const t = `${modelo(p)}·${p.effort.toUpperCase()}   CTX:${p.ctx ?? '--'}%   $${custo(p)}   `
  const pad = Math.max(0, Math.floor(colunas * 0.85) - t.length - msg.length)
  return [
    { t: ' '.repeat(pad) },
    { t, cor: CGA.cinza },
    { t: msg, cor: p.estado === 'erro' ? CGA.vermelhoB : p.estado === 'pronto' ? CGA.verdeB : CGA.amarelo, negrito: true },
  ]
}

function estiloLotus(p: Painel, colunas: number): Peca[] {
  const w = palavra(p)
  const t = `${modelo(p)}/${p.effort.toUpperCase()}  CTX ${p.ctx ?? '--'}%  US$ ${custo(p)}  ${acao(p, Math.max(8, Math.floor(colunas * 0.8) - 45))}`
  const pad = Math.max(1, Math.floor(colunas * 0.85) - t.length - w.t.length)
  return [{ t: t + ' '.repeat(pad), cor: CGA.cinza }, w]
}

function estiloTurbo(p: Painel, colunas: number): Peca[] {
  const f = CGA.cinza
  const tecla = (k: string, a: string): Peca[] => [{ t: ` ${k}`, cor: CGA.vermelho, fundo: f, negrito: true }, { t: ` ${a} `, cor: CGA.preto, fundo: f }]
  const pecas: Peca[] = [
    ...tecla('F2', '/m80-modo'), ...tecla('F3', '/m80-status'), ...tecla('F4', '/m80-barra'), ...tecla('^T', 'Tasks'), ...tecla('F9', 'Visual'),
  ]
  const resumo = ` ${modelo(p)}·${p.effort.toUpperCase()} │ ${p.ctx ?? '--'}% ${ocupado(p) ? GIRO[p.quadro % 4] : '■'} `
  const usado = pecas.reduce((n, x) => n + x.t.length, 0)
  pecas.push({ t: ' '.repeat(Math.max(1, Math.floor(colunas * 0.85) - usado - resumo.length)), fundo: f })
  pecas.push({ t: resumo, cor: ocupado(p) ? CGA.amarelo : CGA.cianoB, fundo: CGA.preto, negrito: true })
  return pecas
}

function estiloMedidor(p: Painel, colunas: number): Peca[] {
  const onda = '░▒▓█▓▒░'
  const sep: Peca = { t: ' │ ', cor: CGA.cinzaEsc }
  const atividade: Peca[] = []
  for (let i = 0; i < 6; i++) {
    const ch = ocupado(p) ? onda[(i + p.quadro) % onda.length] ?? '░' : '·'
    atividade.push({ t: ch, cor: ocupado(p) ? (p.estado === 'erro' ? CGA.vermelhoB : CGA.cianoB) : CGA.cinzaEsc })
  }
  const pecas: Peca[] = [
    { t: ` ${modelo(p)} `, cor: CGA.preto, fundo: modelo(p) === 'OPUS' ? CGA.magentaB : CGA.cianoB, negrito: true },
    sep, { t: 'EFF ', cor: CGA.cianoB }, ...degraus(p),
    sep, { t: 'CTX ', cor: CGA.cianoB }, ...regua(p, 12), { t: ` ${String(p.ctx ?? '--').padStart(2)}%`, cor: CGA.branco },
    sep, { t: 'US$ ', cor: CGA.cianoB }, { t: custo(p, true), cor: CGA.amarelo, negrito: true },
    sep, ...atividade, { t: ` ${tempo(p)}`, cor: CGA.branco },
  ]
  const usado = pecas.reduce((n, x) => n + x.t.length, 0)
  const sobra = Math.floor(colunas * 0.8) - usado - 3
  if (sobra >= 10) pecas.push(sep, { t: acao(p, sobra), cor: CGA.cinza })
  return pecas
}

// current style: only Claude theme keys (success, claude, warning...), so the bar follows the active theme
function estiloModerna(p: Painel, colunas: number): Peca[] {
  const sep: Peca = { t: '  ', cor: 'subtle' }
  const estado = p.estado === 'erro' ? { t: ' ERROR ', cor: 'inverseText', fundo: 'error' }
    : p.estado === 'pronto' ? { t: ' READY ', cor: 'inverseText', fundo: 'success' }
    : { t: ` ${p.estado === 'pensando' ? 'THINK' : p.estado === 'compactando' ? 'CALC' : 'EXEC'} ${GIRO[p.quadro % 4]} `, cor: 'inverseText', fundo: 'warning' }
  const nivel = ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 5 } as Record<string, number>)[p.effort] ?? 0
  const pct = Math.max(0, Math.min(100, p.ctx ?? 0))
  const cheios = Math.round((pct / 100) * 10)
  const corCtx = pct >= 80 ? 'error' : pct >= 50 ? 'warning' : 'success'
  const pecas: Peca[] = [
    { ...estado, negrito: true }, sep,
    { t: ` ${modelo(p)} `, cor: 'inverseText', fundo: 'claude', negrito: true }, sep,
    { t: 'EFF ', cor: 'subtle' }, { t: '█'.repeat(nivel), cor: 'claude' }, { t: '░'.repeat(5 - nivel), cor: 'inactive' }, sep,
    { t: `CTX ${String(p.ctx ?? '--').padStart(3)}% `, cor: 'subtle' }, { t: '█'.repeat(cheios), cor: corCtx }, { t: '░'.repeat(10 - cheios), cor: 'inactive' }, sep,
    { t: `US$ ${custo(p)}`, cor: 'warning' }, sep,
    { t: tempo(p), cor: 'subtle' },
  ]
  const usado = pecas.reduce((n, x) => n + x.t.length, 0)
  const sobra = Math.floor(colunas * 0.8) - usado - 3
  if (sobra >= 8) pecas.push(sep, { t: acao(p, sobra), cor: 'inactive' })
  return pecas
}

export function pecasDaBarra(estilo: Estilo, p: Painel, colunas: number): Peca[] {
  switch (estilo) {
    case 'scoreboard': return estiloScoreboard(p, colunas)
    case 'lotus': return estiloLotus(p, colunas)
    case 'turbo': return estiloTurbo(p, colunas)
    case 'medidor': return estiloMedidor(p, colunas)
    case 'moderna': return estiloModerna(p, colunas)
    default: return estiloDbase(p, colunas)
  }
}

// merges neighboring pieces of the same color to draw fewer elements
export function agrupar(pecas: Peca[]): Peca[] {
  const out: Peca[] = []
  for (const x of pecas) {
    const u = out[out.length - 1]
    if (u && u.cor === x.cor && u.fundo === x.fundo && !!u.negrito === !!x.negrito) u.t += x.t
    else out.push({ ...x })
  }
  return out
}
