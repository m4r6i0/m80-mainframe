export type Estilo = 'dbase' | 'scoreboard' | 'lotus' | 'turbo' | 'medidor' | 'moderna' | 'auto'

export type Estado = 'pronto' | 'pensando' | 'ferramenta' | 'compactando' | 'erro'

export type Painel = {
  estado: Estado
  modo: string
  modelo: string
  effort: string
  ctx: number | null
  custo: number | null
  ferramenta: string
  detalhe: string
  inicio: number
  agora: number
  quadro: number
  ferramentas: number
}

declare module 'claude-code' {
  interface PluginState {
    'm80-motor': { painel: Painel; estilo: Estilo }
  }
}
