// Generates themes/*.json from visuais.js. Run: node gerar-temas.js
const fs = require('fs');
const path = require('path');
const { TODOS: VISUAIS, CGA_ANSI } = require('./visuais');
function lin(h) { return [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); }
function luz(h) { const [r, g2, b] = lin(h); return 0.2126 * r + 0.7152 * g2 + 0.0722 * b; }
function contraste(a, b) { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// the Claude panel uses the sidebar background with the editor text and the general text
const falhas = [];
for (const v of VISUAIS) {
  for (const [nome, fundo, texto] of [['editor', v.c.bg, v.c.fg], ['sidebar', v.c.side[0], v.c.side[1]], ['Claude panel', v.c.side[0], v.c.fg], ['terminal', v.c.term[0], v.c.term[1]]]) {
    const cr = contraste(fundo, texto);
    if (cr < 4.5) falhas.push(`${v.nome}: ${nome} ${texto} on ${fundo} = ${cr.toFixed(1)}`);
  }
}
if (falhas.length) { console.error('CONTRAST BELOW 4.5: ' + falhas.join(' ; ')); process.exit(1); }
console.log('contrast ok in', VISUAIS.length, 'themes (editor, sidebar, Claude panel and terminal)');

function cores(v) {
  const c = v.c;
  const claro = v.tipo === 'light' || luz(c.side[0]) > 0.25;
  return {
    'foreground': c.side[1],
    'focusBorder': c.focus,
    'contrastBorder': c.border,
    'widget.shadow': '#00000000',
    'selection.background': c.sel,
    'editor.background': c.bg,
    'editor.foreground': c.fg,
    'editorCursor.foreground': c.cur,
    'editor.selectionBackground': c.sel,
    'editor.inactiveSelectionBackground': c.sel + '80',
    'editor.selectionHighlightBackground': c.sel + '55',
    'editor.wordHighlightBackground': c.sel + '40',
    'editor.findMatchBackground': c.status[0],
    'editor.findMatchHighlightBackground': c.sel + '66',
    'editor.lineHighlightBackground': c.bg,
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': c.lineNo,
    'editorLineNumber.activeForeground': c.fg,
    'editorIndentGuide.background1': '#00000000',
    'editorWhitespace.foreground': c.lineNo + '80',
    'editorGutter.background': c.bg,
    'editorWidget.background': c.widget[0],
    'editorWidget.foreground': c.widget[1],
    'editorWidget.border': c.border,
    'editorSuggestWidget.background': c.widget[0],
    'editorSuggestWidget.foreground': c.widget[1],
    'editorSuggestWidget.selectedBackground': c.listSel[0],
    'editorSuggestWidget.selectedForeground': c.listSel[1],
    'editorHoverWidget.background': c.widget[0],
    'editorHoverWidget.foreground': c.widget[1],
    'editorHoverWidget.border': c.border,
    'editorHoverWidget.statusBarBackground': c.widget[0],
    'widget.border': c.border,
    'editorSuggestWidget.border': c.border,
    'editorGroup.border': c.border,
    'editorGroupHeader.tabsBackground': c.tabs,
    'editorGroupHeader.noTabsBackground': c.tabs,
    'breadcrumb.background': c.tabs,
    'breadcrumb.foreground': c.tabIn[1],
    'tab.activeBackground': c.tabAct[0],
    'tab.activeForeground': c.tabAct[1],
    'tab.inactiveBackground': c.tabIn[0],
    'tab.inactiveForeground': c.tabIn[1],
    'tab.border': c.tabs,
    'tab.activeBorder': c.focus,
    'titleBar.activeBackground': c.title[0],
    'titleBar.activeForeground': c.title[1],
    'titleBar.inactiveBackground': c.title[0],
    'titleBar.inactiveForeground': c.title[1],
    'titleBar.border': c.border,
    'menubar.selectionBackground': c.menuSel[0],
    'menubar.selectionForeground': c.menuSel[1],
    'menu.background': c.menu[0],
    'menu.foreground': c.menu[1],
    'menu.selectionBackground': c.menuSel[0],
    'menu.selectionForeground': c.menuSel[1],
    'menu.border': c.border,
    'activityBar.background': c.activity[0],
    'activityBar.foreground': c.activity[1],
    'activityBar.inactiveForeground': c.activity[1] + '99',
    'activityBarBadge.background': c.status[0],
    'activityBarBadge.foreground': c.status[1],
    'sideBar.background': c.side[0],
    'sideBar.foreground': c.side[1],
    'sideBar.border': c.border,
    'sideBarTitle.foreground': c.side[1],
    'sideBarSectionHeader.background': c.sideHead[0],
    'sideBarSectionHeader.foreground': c.sideHead[1],
    'list.activeSelectionBackground': c.listSel[0],
    'list.activeSelectionForeground': c.listSel[1],
    'list.inactiveSelectionBackground': c.listIn[0],
    'list.inactiveSelectionForeground': c.listIn[1],
    'list.focusBackground': c.listSel[0],
    'list.focusForeground': c.listSel[1],
    'list.focusOutline': c.focus,
    'list.hoverBackground': c.hover,
    'list.highlightForeground': c.focus,
    'statusBar.background': c.status[0],
    'statusBar.foreground': c.status[1],
    'statusBar.noFolderBackground': c.status[0],
    'statusBar.noFolderForeground': c.status[1],
    'statusBar.debuggingBackground': '#AA0000',
    'statusBar.debuggingForeground': '#FFFFFF',
    'statusBar.border': c.status[0],
    'statusBarItem.hoverBackground': c.sel,
    'statusBarItem.remoteBackground': c.status[0],
    'statusBarItem.remoteForeground': c.status[1],
    'panel.background': c.bg,
    'panel.border': c.border,
    'panelTitle.activeForeground': c.fg,
    'panelTitle.activeBorder': c.focus,
    'panelTitle.inactiveForeground': c.lineNo,
    'terminal.background': c.term[0],
    'terminal.foreground': c.term[1],
    'terminalCursor.foreground': c.cur,
    'terminal.selectionBackground': c.sel + '99',
    'input.background': c.input[0],
    'input.foreground': c.input[1],
    'input.border': c.border,
    'dropdown.background': c.input[0],
    'dropdown.foreground': c.input[1],
    'dropdown.border': c.border,
    'quickInput.background': c.widget[0],
    'quickInput.foreground': c.widget[1],
    'quickInputList.focusBackground': c.listSel[0],
    'quickInputList.focusForeground': c.listSel[1],
    'button.background': c.status[0],
    'button.foreground': c.status[1],
    'button.hoverBackground': c.sel,
    'badge.background': c.status[0],
    'badge.foreground': c.status[1],
    'scrollbarSlider.background': c.sel + '80',
    'scrollbarSlider.hoverBackground': c.sel + 'AA',
    'scrollbarSlider.activeBackground': c.sel,
    'textPreformat.foreground': claro ? c.kw : c.str,
    'textPreformat.background': claro ? '#0000001F' : '#FFFFFF1A',
    'textCodeBlock.background': claro ? '#0000001A' : '#00000040',
    'textBlockQuote.background': claro ? '#0000000F' : '#FFFFFF0F',
    'textLink.foreground': c.kw,
    'textLink.activeForeground': c.focus,
    'notifications.background': c.widget[0],
    'notifications.foreground': c.widget[1],
    'notifications.border': c.border,
    'peekView.border': c.border,
    'gitDecoration.modifiedResourceForeground': claro ? '#5A2D00' : '#FFFF55',
    'gitDecoration.untrackedResourceForeground': claro ? '#004D00' : '#55FF55',
    'gitDecoration.deletedResourceForeground': claro ? '#7A0000' : '#FF5555',
    'errorForeground': claro ? '#AA0000' : '#FF5555',
    'editorError.foreground': claro ? '#AA0000' : '#FF5555',
    'editorWarning.foreground': claro ? '#5A2D00' : '#FFFF55',
    'editorInfo.foreground': claro ? '#0000AA' : '#55FFFF',
    'minimap.background': c.bg,
    ...(v.ansi || CGA_ANSI)
  };
}

function tokens(v) {
  const c = v.c;
  return [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.cm, fontStyle: '' } },
    { scope: ['keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier'], settings: { foreground: c.kw, fontStyle: '' } },
    { scope: ['string', 'string.quoted', 'punctuation.definition.string'], settings: { foreground: c.str } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: c.num } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: c.fn } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'], settings: { foreground: c.type } },
    { scope: ['variable', 'meta', 'punctuation', 'source'], settings: { foreground: c.fg } },
    { scope: ['entity.name.tag', 'markup.heading'], settings: { foreground: c.kw, fontStyle: '' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: c.fn } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic', 'emphasis'], settings: { fontStyle: '' } },
    { scope: ['markup.inserted'], settings: { foreground: v.tipo === 'light' ? '#00AA00' : '#55FF55' } },
    { scope: ['markup.deleted', 'invalid'], settings: { foreground: v.tipo === 'light' ? '#AA0000' : '#FF5555' } }
  ];
}

const dir = path.join(__dirname, 'themes');
fs.mkdirSync(dir, { recursive: true });
for (const v of VISUAIS) {
  const tema = {
    $schema: 'vscode://schemas/color-theme',
    name: v.nome,
    type: v.tipo,
    semanticHighlighting: false,
    colors: cores(v),
    tokenColors: tokens(v)
  };
  fs.writeFileSync(path.join(dir, v.id + '.json'), JSON.stringify(tema, null, 2) + '\n');
  console.log('theme generated:', v.id, '-', Object.keys(tema.colors).length, 'colors');
}

// ---------- Claude (terminal) themes for the modern themes ----------
// The retro looks have a hand-written Claude theme in .claude/global/temas-claude/; the modern ones come from the same VS Code colors.
const dirClaude = path.join(__dirname, '..', '..', '.claude', 'global', 'temas-claude');
fs.mkdirSync(dirClaude, { recursive: true });
for (const v of VISUAIS.filter(x => x.moderno && !x.suave)) {
  const t = v.claude, escuro = t.t === 'dark';
  const claude = {
    name: t.nome, base: escuro ? 'dark' : 'light',
    overrides: {
      claude: t.ac, text: t.fg, inactive: t.mu, subtle: t.mu, promptBorder: t.ac, permission: t.ac, suggestion: t.k,
      success: escuro ? '#7BD88F' : '#1C7A45', error: escuro ? '#FF6B6B' : '#B3261E', warning: t.n,
      diffAdded: escuro ? '#1F4D2E' : '#C8E6D0', diffRemoved: escuro ? '#5A2328' : '#F5CDCD', userMessageBackground: t.s1
    }
  };
  fs.writeFileSync(path.join(dirClaude, v.id + '.json'), JSON.stringify(claude, null, 2) + '\n');
}
console.log('Claude themes generated:', VISUAIS.filter(x => x.moderno && !x.suave).length);

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
pkg.contributes.themes = VISUAIS.map(v => ({ label: v.nome, uiTheme: v.tipo === 'light' ? 'vs' : 'vs-dark', path: './themes/' + v.id + '.json' }));
fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(pkg, null, 2) + String.fromCharCode(10));
console.log('package.json:', pkg.contributes.themes.length, 'themes');
