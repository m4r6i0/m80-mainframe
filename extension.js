// M80 Mainframe: seven retro looks, ten current themes and switching between them.
// v.nome is the theme name in VS Code (an identifier, kept in pt-BR); v.exibir is the English name shown on screen.
// Switching changes the color theme and what a theme cannot change by itself: font, cursor and terminal.
const vscode = require('vscode');
const { VISUAIS: ORIGINAIS, TODOS: VISUAIS } = require('./visuais');
const { registrarMenu } = require('./menu');
const { registrarMonitor } = require('./monitor');
const { registrarInstalador } = require('./instalador');

const ESCOPO_PADRAO = vscode.ConfigurationTarget.Global;

function visualAtual() {
  const tema = vscode.workspace.getConfiguration('workbench').get('colorTheme');
  return VISUAIS.find(v => v.nome === tema);
}

async function aplicar(v, alvo) {
  const destino = alvo || ESCOPO_PADRAO;
  const cfg = (secao) => vscode.workspace.getConfiguration(secao);
  await cfg('workbench').update('colorTheme', v.nome, destino);
  // the current themes do not use the IBM font, not even as a fallback: Cascadia Code, then Consolas
  const fonte = v.moderno ? `'${v.fonte}', Consolas, monospace` : `'${v.fonte}', 'PxPlus IBM VGA 8x16', Consolas, monospace`;
  await cfg('editor').update('fontFamily', fonte, destino);
  await cfg('editor').update('cursorStyle', v.cursor, destino);
  await cfg('editor').update('cursorBlinking', v.piscar, destino);
  // always with a monospace fallback: without it, if the font fails to load, the panel falls back to a serif
  await cfg('terminal.integrated').update('fontFamily', fonte, destino);
  await cfg('chat').update('fontFamily', fonte, destino);
  await cfg('chat.editor').update('fontFamily', fonte, destino);
  await cfg('m80').update('visual', v.id, destino);
  atualizarBarra();
}

let barra;
// the m80-motor plugin reads this file to pick the "modern" bar on its own for the current themes
function gravarTemaAtivo() {
  try {
    const pasta = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    if (!pasta) return;
    const dir = require('path').join(pasta.uri.fsPath, '.sessions');
    if (!require('fs').existsSync(dir)) return;
    const nome = String(vscode.workspace.getConfiguration('workbench').get('colorTheme') || '');
    const moderno = /^M80 (Graphite|Midnight|Daylight|Porcelain|Forest|Dusk|Ember|Ocean|Contrast|Mist)/i.test(nome);
    require('fs').writeFileSync(require('path').join(dir, 'm80-tema.json'), JSON.stringify({ nome, moderno }));
  } catch { /* no folder or no permission: the bar keeps the default style */ }
}

function atualizarBarra() {
  gravarTemaAtivo();
  if (!barra) return;
  const v = visualAtual();
  barra.text = v ? `▓ ${v.rotulo}` : '▓ M80';
  barra.tooltip = v ? `${v.exibir}: click or Ctrl+K M to switch` : 'M80: choose look';
}

async function escolher() {
  const atual = visualAtual();
  const item = v => ({
    label: v.tecla ? `${v.tecla}  ${v.exibir.replace(/^M80 /, '')}` : v.exibir.replace(/^M80 /, ''),
    description: v === atual ? '(current)' : v.fonte,
    detail: v.descricao,
    visual: v
  });
  const SEP = vscode.QuickPickItemKind.Separator;
  const itens = [{ label: 'Retro', kind: SEP }, ...ORIGINAIS.filter(v => !v.moderno).map(item), { label: 'Modern', kind: SEP }, ...ORIGINAIS.filter(v => v.moderno).map(item)];
  itens.push({ label: '', kind: SEP });
  itens.push({ label: '$(pin) Pin the current look to this project only', fixar: true });
  const escolhido = await vscode.window.showQuickPick(itens, {
    title: 'M80: Switch look',
    placeHolder: 'Choose a look (the arrow keys show a preview)',
    onDidSelectItem: (item) => {
      if (item && item.visual) {
        vscode.workspace.getConfiguration('workbench').update('colorTheme', item.visual.nome, ESCOPO_PADRAO);
      }
    }
  });
  if (!escolhido) {
    if (atual) await vscode.workspace.getConfiguration('workbench').update('colorTheme', atual.nome, ESCOPO_PADRAO);
    return;
  }
  if (escolhido.fixar) {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('M80: open a project folder to pin the look to it.');
      return;
    }
    const v = visualAtual() || VISUAIS[0];
    await aplicar(v, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`M80: ${v.exibir} pinned to this project (.vscode/settings.json).`);
    return;
  }
  await aplicar(escolhido.visual);
}

async function alternarSuave() {
  const atual = visualAtual() || VISUAIS[0];
  const alvo = atual.suave ? VISUAIS.find(v => v.id === atual.original) : VISUAIS.find(v => v.id === atual.id + '-suave');
  if (alvo) await aplicar(alvo);
}

async function proximo() {
  const atual = visualAtual();
  const i = atual ? ORIGINAIS.findIndex(v => v.id === (atual.original || atual.id)) : -1;
  await aplicar(ORIGINAIS[(i + 1) % ORIGINAIS.length]);
}

function activate(context) {
  registrarMenu(context);
  registrarMonitor(context);
  registrarInstalador(context);
  barra = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  barra.command = 'm80.trocarVisual';
  atualizarBarra();
  barra.show();
  context.subscriptions.push(
    barra,
    vscode.commands.registerCommand('m80.trocarVisual', escolher),
    vscode.commands.registerCommand('m80.proximoVisual', proximo),
    vscode.commands.registerCommand('m80.alternarSuave', alternarSuave),
    ...ORIGINAIS.map(v => vscode.commands.registerCommand(`m80.visual.${v.id}`, () => aplicar(v))),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('workbench.colorTheme')) atualizarBarra();
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
