// Single source of truth for the seven retro M80 looks plus the modern themes. Used by the theme
// generator (gerar-temas.js) and by the extension (extension.js) to switch font, cursor and terminal.
// Palettes: real CGA/EGA. F1-F5 follow the 2026-11-20 research (JSON of the reference themes);
// F6 was sampled from the pixels of the reference LapLink screenshot.

const CGA_ANSI = {
  'terminal.ansiBlack': '#000000', 'terminal.ansiBlue': '#0000AA',
  'terminal.ansiGreen': '#00AA00', 'terminal.ansiCyan': '#00AAAA',
  'terminal.ansiRed': '#AA0000', 'terminal.ansiMagenta': '#AA00AA',
  'terminal.ansiYellow': '#AA5500', 'terminal.ansiWhite': '#AAAAAA',
  'terminal.ansiBrightBlack': '#555555', 'terminal.ansiBrightBlue': '#5555FF',
  'terminal.ansiBrightGreen': '#55FF55', 'terminal.ansiBrightCyan': '#55FFFF',
  'terminal.ansiBrightRed': '#FF5555', 'terminal.ansiBrightMagenta': '#FF55FF',
  'terminal.ansiBrightYellow': '#FFFF55', 'terminal.ansiBrightWhite': '#FFFFFF'
};

const VISUAIS = [
  {
    id: 'clipper', tecla: 'F1', rotulo: 'CLIPPER', nome: 'M80 Clipper Summer 87', exibir: 'M80 Clipper Summer 87',
    descricao: 'Gray text on CGA blue, cyan bars (SET COLOR TO W/B,N/BG)',
    tipo: 'dark', fonte: 'PxPlus IBM VGA 8x16', cursor: 'underline', piscar: 'blink',
    c: {
      bg: '#0000AA', fg: '#AAAAAA', kw: '#FFFFFF', str: '#FFFF55', num: '#55FF55', cm: '#00AAAA', fn: '#55FFFF', type: '#FFFFFF',
      sel: '#00AAAA', cur: '#FFFFFF', lineNo: '#00AAAA',
      title: ['#00AAAA', '#000000'], menu: ['#AAAAAA', '#000000'], menuSel: ['#000000', '#FFFFFF'],
      status: ['#00AAAA', '#000000'], side: ['#0000AA', '#AAAAAA'], sideHead: ['#00AAAA', '#000000'],
      listSel: ['#00AAAA', '#000000'], listIn: ['#000080', '#FFFFFF'], hover: '#000080',
      tabs: '#0000AA', tabAct: ['#0000AA', '#FFFFFF'], tabIn: ['#000080', '#AAAAAA'],
      border: '#00AAAA', focus: '#FFFF55', input: ['#000000', '#FFFF55'], widget: ['#000080', '#FFFFFF'],
      panel: '#0000AA', term: ['#0000AA', '#AAAAAA'], activity: ['#000080', '#FFFF55']
    }
  },
  {
    id: 'turbo', tecla: 'F2', rotulo: 'TURBO', nome: 'M80 Turbo Pascal 7', exibir: 'M80 Turbo Pascal 7',
    descricao: 'Yellow on blue, gray menus, cyan dialogs',
    tipo: 'dark', fonte: 'PxPlus IBM VGA 9x16', cursor: 'underline', piscar: 'blink',
    c: {
      bg: '#0000AA', fg: '#FFFF55', kw: '#FFFFFF', str: '#55FFFF', num: '#55FFFF', cm: '#AAAAAA', fn: '#FFFF55', type: '#FFFFFF',
      sel: '#00AAAA', cur: '#FFFF55', lineNo: '#AAAAAA',
      title: ['#AAAAAA', '#000000'], menu: ['#AAAAAA', '#000000'], menuSel: ['#00AA00', '#000000'],
      status: ['#AAAAAA', '#000000'], side: ['#0000AA', '#FFFF55'], sideHead: ['#AAAAAA', '#000000'],
      listSel: ['#00AAAA', '#000000'], listIn: ['#000080', '#FFFF55'], hover: '#000080',
      tabs: '#0000AA', tabAct: ['#0000AA', '#FFFFFF'], tabIn: ['#000080', '#AAAAAA'],
      border: '#AAAAAA', focus: '#FFFFFF', input: ['#00AAAA', '#000000'], widget: ['#AAAAAA', '#000000'],
      panel: '#0000AA', term: ['#0000AA', '#FFFF55'], activity: ['#AAAAAA', '#000000']
    }
  },
  {
    id: 'norton', tecla: 'F3', rotulo: 'NORTON', nome: 'M80 Norton Commander 5', exibir: 'M80 Norton Commander 5',
    descricao: 'Cyan on blue, cyan borders, black footer',
    tipo: 'dark', fonte: 'PxPlus IBM VGA 8x16', cursor: 'underline', piscar: 'blink',
    c: {
      bg: '#0000AA', fg: '#55FFFF', kw: '#FFFF55', str: '#FFFFFF', num: '#FFFFFF', cm: '#00AAAA', fn: '#FFFFFF', type: '#FFFF55',
      sel: '#00AAAA', cur: '#55FFFF', lineNo: '#00AAAA',
      title: ['#00AAAA', '#000000'], menu: ['#00AAAA', '#000000'], menuSel: ['#000000', '#55FFFF'],
      status: ['#000000', '#00AAAA'], side: ['#0000AA', '#55FFFF'], sideHead: ['#0000AA', '#FFFF55'],
      listSel: ['#00AAAA', '#000000'], listIn: ['#000080', '#55FFFF'], hover: '#000080',
      tabs: '#0000AA', tabAct: ['#00AAAA', '#000000'], tabIn: ['#0000AA', '#55FFFF'],
      border: '#55FFFF', focus: '#FFFF55', input: ['#000000', '#55FFFF'], widget: ['#00AAAA', '#000000'],
      panel: '#000000', term: ['#000000', '#AAAAAA'], activity: ['#000000', '#00AAAA']
    }
  },
  {
    id: 'fosforo', tecla: 'F4', rotulo: 'PHOSPHOR', nome: 'M80 Green Phosphor 5151', exibir: 'M80 Green Phosphor 5151',
    descricao: 'Green monochrome monitor, status bar in reverse video',
    tipo: 'dark', fonte: 'PxPlus IBM MDA', cursor: 'block', piscar: 'solid',
    c: {
      bg: '#050A05', fg: '#33FF33', kw: '#AAFFAA', str: '#66FF66', num: '#66FF66', cm: '#1A8C1A', fn: '#AAFFAA', type: '#AAFFAA',
      sel: '#1F5F1F', cur: '#33FF33', lineNo: '#1A8C1A',
      title: ['#050A05', '#33FF33'], menu: ['#050A05', '#33FF33'], menuSel: ['#33FF33', '#000000'],
      status: ['#33FF33', '#000000'], side: ['#050A05', '#2ED22E'], sideHead: ['#0A1A0A', '#33FF33'],
      listSel: ['#33FF33', '#000000'], listIn: ['#1F5F1F', '#AAFFAA'], hover: '#0F2A0F',
      tabs: '#050A05', tabAct: ['#0A1A0A', '#33FF33'], tabIn: ['#050A05', '#1A8C1A'],
      border: '#1A8C1A', focus: '#33FF33', input: ['#000000', '#33FF33'], widget: ['#0A1A0A', '#33FF33'],
      panel: '#050A05', term: ['#050A05', '#33FF33'], activity: ['#050A05', '#33FF33']
    }
  },
  {
    id: 'ambar', tecla: 'F5', rotulo: 'AMBER', nome: 'M80 dBase III Amber', exibir: 'M80 dBase III Amber',
    descricao: 'Amber monitor, the easiest on the eyes at night',
    tipo: 'dark', fonte: 'PxPlus IBM EGA 8x14', cursor: 'block', piscar: 'blink',
    c: {
      bg: '#100A00', fg: '#FFB000', kw: '#FFD966', str: '#FFCC33', num: '#FFCC33', cm: '#A06A00', fn: '#FFD966', type: '#FFD966',
      sel: '#5A3C00', cur: '#FFB000', lineNo: '#A06A00',
      title: ['#100A00', '#FFB000'], menu: ['#100A00', '#FFB000'], menuSel: ['#FFB000', '#000000'],
      status: ['#FFB000', '#000000'], side: ['#100A00', '#E0A000'], sideHead: ['#1A1000', '#FFB000'],
      listSel: ['#FFB000', '#000000'], listIn: ['#5A3C00', '#FFD966'], hover: '#2A1C00',
      tabs: '#100A00', tabAct: ['#1A1000', '#FFB000'], tabIn: ['#100A00', '#A06A00'],
      border: '#A06A00', focus: '#FFB000', input: ['#000000', '#FFB000'], widget: ['#1A1000', '#FFB000'],
      panel: '#100A00', term: ['#100A00', '#FFB000'], activity: ['#100A00', '#FFB000']
    }
  },
  {
    id: 'laplink', tecla: 'F6', rotulo: 'LAPLINK', nome: 'M80 LapLink White Paper', exibir: 'M80 LapLink White Paper',
    descricao: 'White panels, cyan menu, blue header (from the reference screenshot)',
    tipo: 'light', fonte: 'PxPlus IBM VGA 8x16', cursor: 'underline', piscar: 'blink',
    c: {
      bg: '#FFFFFF', fg: '#000000', kw: '#0000AA', str: '#AA0000', num: '#AA00AA', cm: '#555555', fn: '#AA5500', type: '#0000AA',
      sel: '#00AAAA', cur: '#000000', lineNo: '#555555',
      title: ['#00AAAA', '#FFFFFF'], menu: ['#00AAAA', '#FFFFFF'], menuSel: ['#000000', '#FFFFFF'],
      status: ['#00AAAA', '#000000'], side: ['#FFFFFF', '#000000'], sideHead: ['#0000AA', '#FFFFFF'],
      listSel: ['#000000', '#FFFFFF'], listIn: ['#C8C8C8', '#000000'], hover: '#AAAAAA',
      tabs: '#555555', tabAct: ['#0000AA', '#FFFFFF'], tabIn: ['#000000', '#FFFFFF'],
      border: '#0000AA', focus: '#0000AA', input: ['#FFFFFF', '#000000'], widget: ['#FFFFFF', '#000000'],
      panel: '#FFFFFF', term: ['#FFFFFF', '#000000'], activity: ['#555555', '#FFFFFF']
    }
  },
  {
    id: 'manifest', tecla: 'F7', rotulo: 'MANIFEST', nome: 'M80 Quarterdeck Manifest', exibir: 'M80 Quarterdeck Manifest',
    descricao: 'Blue data box, gray panel, sky-blue area and tabs with a green highlight (from the reference screenshot)',
    tipo: 'dark', fonte: 'PxPlus IBM VGA 8x16', cursor: 'underline', piscar: 'blink',
    c: {
      bg: '#00AAFF', fg: '#000000', kw: '#0000AA', str: '#5A0000', num: '#550055', cm: '#0A3A66', fn: '#003A00', type: '#0000AA',
      sel: '#FFAA00', cur: '#000000', lineNo: '#0000AA',
      title: ['#000000', '#AAAAAA'], menu: ['#AAAAAA', '#000000'], menuSel: ['#FFAA00', '#000000'],
      status: ['#AAAAAA', '#000000'], side: ['#AAAAAA', '#000000'], sideHead: ['#0000AA', '#FFFFFF'],
      listSel: ['#FFAA00', '#000000'], listIn: ['#FFD27F', '#000000'], hover: '#C8C8C8',
      tabs: '#0000AA', tabAct: ['#55FF55', '#000000'], tabIn: ['#0000AA', '#FFFFFF'],
      border: '#000000', focus: '#FFAA00', input: ['#FFFFFF', '#000000'], widget: ['#0000AA', '#FFFFFF'],
      panel: '#0000AA', term: ['#0000AA', '#FFFFFF'], activity: ['#000000', '#AAAAAA']
    }
  }
];

// ---------- modern themes (no 80s reference) ----------
// Mockup approved on 2026-11-22. Each theme is defined by a few base colors and converted to the same
// structure as the retro looks (v.c), so the generator, the soft variant and the menu treat them all alike.
// t: dark|light. bg=editor, s1=sidebar, s2=title bar and activity bar, bd=border, fg=text, mu=muted text, ac=accent,
// sel=selection, k/s/n/f/ty=keyword/string/number/function/type, tm=terminal background.
const ANSI_ESCURO = {
  'terminal.ansiBlack': '#3B3F46', 'terminal.ansiRed': '#FF6B6B', 'terminal.ansiGreen': '#7BD88F', 'terminal.ansiYellow': '#F3C677',
  'terminal.ansiBlue': '#6AA6FF', 'terminal.ansiMagenta': '#C792EA', 'terminal.ansiCyan': '#5FD0D6', 'terminal.ansiWhite': '#D9DDE3',
  'terminal.ansiBrightBlack': '#6B7280', 'terminal.ansiBrightRed': '#FF8F8F', 'terminal.ansiBrightGreen': '#9BE7AC', 'terminal.ansiBrightYellow': '#FFD88F',
  'terminal.ansiBrightBlue': '#8FBAFF', 'terminal.ansiBrightMagenta': '#DCB0FF', 'terminal.ansiBrightCyan': '#86E3E8', 'terminal.ansiBrightWhite': '#FFFFFF'
};
const ANSI_CLARO = {
  'terminal.ansiBlack': '#1F2433', 'terminal.ansiRed': '#B3261E', 'terminal.ansiGreen': '#1C7A45', 'terminal.ansiYellow': '#8A5A00',
  'terminal.ansiBlue': '#1D5FD6', 'terminal.ansiMagenta': '#8E3FB0', 'terminal.ansiCyan': '#0B6F8A', 'terminal.ansiWhite': '#596273',
  'terminal.ansiBrightBlack': '#3A4256', 'terminal.ansiBrightRed': '#C93027', 'terminal.ansiBrightGreen': '#20884F', 'terminal.ansiBrightYellow': '#946000',
  'terminal.ansiBrightBlue': '#2A6DE3', 'terminal.ansiBrightMagenta': '#9C4BBF', 'terminal.ansiBrightCyan': '#0E7C99', 'terminal.ansiBrightWhite': '#2D3342'
};
const MODERNOS = [
  { id: 'graphite', nome: 'Graphite', t: 'dark', info: 'Neutral gray, blue accent', bg: '#1e2024', s1: '#181a1d', s2: '#131416', bd: '#2d3036', fg: '#dadde3', mu: '#9199a6', ac: '#6aa6ff', sel: '#2b3a52', k: '#7fb4ff', s: '#a5d6a7', n: '#f3c677', f: '#e5c07b', ty: '#c9a7ff', tm: '#16171a' },
  { id: 'midnight', nome: 'Midnight', t: 'dark', info: 'Deep navy, teal accent', bg: '#0f1626', s1: '#0b111f', s2: '#080d18', bd: '#1f2a42', fg: '#d5deef', mu: '#8d9bb8', ac: '#3fd2c4', sel: '#1c2d4a', k: '#6fb5ff', s: '#8fe0b0', n: '#ffc979', f: '#7ee0d6', ty: '#b9a4ff', tm: '#0a101c' },
  { id: 'daylight', nome: 'Daylight', t: 'light', info: 'Clean light, blue accent', bg: '#ffffff', s1: '#f3f5f8', s2: '#e8ecf1', bd: '#d3d9e2', fg: '#1d2430', mu: '#5c6778', ac: '#1d5fd6', sel: '#d5e3fb', k: '#1d5fd6', s: '#1c7a45', n: '#a35a00', f: '#7b3fc4', ty: '#0d7a7a', tm: '#f3f5f8' },
  { id: 'porcelain', nome: 'Porcelain', t: 'light', info: 'Cool light, teal accent', bg: '#f7f9fa', s1: '#eef2f3', s2: '#e1e8ea', bd: '#ccd6d9', fg: '#1b2a2e', mu: '#566a70', ac: '#0b7a73', sel: '#cfe8e5', k: '#0b6a8f', s: '#2c7d3c', n: '#9a5a00', f: '#6a3fb0', ty: '#0b7a73', tm: '#eef2f3' },
  { id: 'forest', nome: 'Forest', t: 'dark', info: 'Dark moss, mint accent', bg: '#15201b', s1: '#111a16', s2: '#0d1511', bd: '#25362d', fg: '#d6e3da', mu: '#8fa699', ac: '#6fdc9b', sel: '#23402f', k: '#7dd3a8', s: '#e6d48a', n: '#f0a97a', f: '#9ad1ff', ty: '#c7b6ff', tm: '#0f1713' },
  { id: 'dusk', nome: 'Dusk', t: 'dark', info: 'Grayish violet, lavender accent', bg: '#1c1a2a', s1: '#171524', s2: '#110f1c', bd: '#2f2b45', fg: '#e0dcf0', mu: '#a29cc0', ac: '#b79cff', sel: '#352f57', k: '#c4a8ff', s: '#9ee0b8', n: '#ffb88a', f: '#8fc7ff', ty: '#ff9fc7', tm: '#131120' },
  { id: 'ember', nome: 'Ember', t: 'dark', info: 'Warm charcoal, orange accent', bg: '#201c1a', s1: '#1a1716', s2: '#141211', bd: '#352f2b', fg: '#e6dfd9', mu: '#a89c93', ac: '#ff8c4a', sel: '#4a3326', k: '#ffa268', s: '#b7da8a', n: '#f6d067', f: '#8bc7e8', ty: '#e0a8ff', tm: '#161312' },
  { id: 'ocean', nome: 'Ocean', t: 'dark', info: 'Petrol blue, cyan accent', bg: '#0c2530', s1: '#091d26', s2: '#06161d', bd: '#1b3a48', fg: '#d3e6ee', mu: '#86a7b6', ac: '#52c7ff', sel: '#17415a', k: '#6fd6ff', s: '#9fe3b8', n: '#ffcf86', f: '#a8c7ff', ty: '#ffa8d0', tm: '#081b23' },
  { id: 'contrast', nome: 'Contrast', t: 'dark', info: 'High contrast, black and yellow', bg: '#000000', s1: '#0a0a0a', s2: '#000000', bd: '#6b6b6b', fg: '#ffffff', mu: '#c8c8c8', ac: '#ffd60a', sel: '#1f3a8a', k: '#6cc0ff', s: '#7dff9a', n: '#ffd60a', f: '#ff9ee8', ty: '#7dffe6', tm: '#000000' },
  { id: 'mist', nome: 'Mist', t: 'light', info: 'Light blue-gray, indigo accent', bg: '#eef1f6', s1: '#e4e8f0', s2: '#d8deea', bd: '#c3cbdb', fg: '#1f2433', mu: '#586079', ac: '#4f46d8', sel: '#cfd5f5', k: '#4f46d8', s: '#1f7a4a', n: '#a05a00', f: '#9b2fa6', ty: '#0b6f8a', tm: '#e4e8f0' }
];
function aoMisturar(a, b, t) { const x = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), y = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function aoLuz(h) { const l = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
// text on top of the accent: black or white, whichever has more contrast
const sobreAcento = h => (aoLuz(h) + 0.05) / 0.05 >= 1.05 / (aoLuz(h) + 0.05) ? '#000000' : '#FFFFFF';
VISUAIS.push(...MODERNOS.map(t => ({
  id: t.id, tecla: '', rotulo: t.nome.toUpperCase(), nome: 'M80 ' + t.nome, exibir: 'M80 ' + t.nome, descricao: t.info,
  tipo: t.t, fonte: 'Cascadia Code', cursor: 'line', piscar: 'smooth', moderno: true, ansi: t.t === 'light' ? ANSI_CLARO : ANSI_ESCURO,
  neutroSuave: t.t === 'light' ? '#E4E8EE' : '#1E2128', claude: t,
  c: {
    bg: t.bg, fg: t.fg, kw: t.k, str: t.s, num: t.n, cm: t.mu, fn: t.f, type: t.ty, sel: t.sel, cur: t.ac, lineNo: t.mu,
    title: [t.s2, t.fg], menu: [t.s2, t.fg], menuSel: [t.ac, sobreAcento(t.ac)], status: [t.ac, sobreAcento(t.ac)], side: [t.s1, t.fg], sideHead: [t.s1, t.mu],
    listSel: [t.sel, t.fg], listIn: [aoMisturar(t.s1, t.sel, 0.5), t.fg], hover: aoMisturar(t.bg, t.sel, 0.5),
    tabs: t.s1, tabAct: [t.bg, t.fg], tabIn: [t.s1, t.mu], border: t.bd, focus: t.ac, input: [t.s1, t.fg], widget: [t.s1, t.fg],
    panel: t.bg, term: [t.tm, t.fg], activity: [t.s2, t.mu]
  }
})));

module.exports = { VISUAIS, CGA_ANSI };

// ---------- soft variants ----------
// Same color identity, less brightness and saturation: light colors move toward
// the background and dark colors rise a little (pure black and pure blue tire the eyes).
function hex2rgb(h) { const n = parseInt(h.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r) { return '#' + r.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function misturar(a, b, t) { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); }
function luz(h) { const [r, g, b] = hex2rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

function suavizarCor(cor, v) {
  if (typeof cor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(cor)) return cor;
  const fundo = v.c.bg, texto = v.c.fg;
  const neutro = v.neutroSuave || (v.tipo === 'light' ? '#F2EEE3' : '#1C1C24');
  if (v.tipo === 'light') {
    return luz(cor) > 0.6 ? misturar(cor, neutro, 0.85) : misturar(cor, fundo, 0.12);
  }
  // dark: light colors lose brightness toward the background; dark colors gain body
  return luz(cor) > 0.3 ? misturar(cor, misturar(fundo, neutro, 0.5), 0.12) : misturar(cor, neutro, 0.38);
}

function suavizar(v) {
  const c = {};
  for (const [k, val] of Object.entries(v.c)) c[k] = Array.isArray(val) ? val.map(x => suavizarCor(x, v)) : suavizarCor(val, v);
  if (v.moderno) { c.status = [c.status[0], sobreAcento(c.status[0])]; c.menuSel = [c.menuSel[0], sobreAcento(c.menuSel[0])]; }
  return { ...v, id: v.id + '-suave', rotulo: v.rotulo + '~', nome: v.nome + ' Soft', exibir: v.exibir + ' Soft', descricao: v.descricao + ' (soft)', suave: true, original: v.id, c };
}

const SUAVES = VISUAIS.map(suavizar);
module.exports.SUAVES = SUAVES;
module.exports.TODOS = [...VISUAIS, ...SUAVES];
