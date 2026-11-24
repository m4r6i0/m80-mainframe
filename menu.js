// M80 menu: side panel in the Quarterdeck Manifest style.
// Colored buttons with shadow, highlighted shortcut letter, real counts from the project.
const vscode = require('vscode');
const { TODOS: VISUAIS } = require('./visuais');
const fs = require('fs');
const path = require('path');

function raiz() {
  const f = vscode.workspace.workspaceFolders;
  return f && f.length ? f[0].uri.fsPath : undefined;
}

function contar(pasta, filtro) {
  try { return fs.readdirSync(pasta).filter(filtro).length; } catch { return 0; }
}

function arquivos(pasta, filtro) {
  try { return fs.readdirSync(pasta).filter(filtro).sort().reverse(); } catch { return []; }
}

async function escolherEAbrir(pasta, filtro, titulo) {
  const lista = arquivos(pasta, filtro);
  if (!lista.length) { vscode.window.showInformationMessage(`M80: nothing in ${path.basename(pasta)}.`); return; }
  const item = await vscode.window.showQuickPick(lista, { title: titulo });
  if (item) await vscode.window.showTextDocument(vscode.Uri.file(path.join(pasta, item)));
}

async function rodarScript() {
  const r = raiz(); if (!r) return;
  const pasta = path.join(r, '.scripts');
  const lista = arquivos(pasta, f => /\.(js|sh|ps1)$/.test(f)).reverse();
  if (!lista.length) { vscode.window.showInformationMessage('M80: no scripts in .scripts.'); return; }
  const item = await vscode.window.showQuickPick(lista, { title: 'M80: run script' });
  if (!item) return;
  const rel = path.join('.scripts', item).split(path.sep).join('/');
  const cmd = item.endsWith('.js') ? `node ${rel}` : item.endsWith('.sh') ? `bash ${rel}` : `powershell -File ${rel}`;
  const term = vscode.window.createTerminal({ name: `M80 ${item}`, cwd: r });
  term.show();
  term.sendText(cmd);
}

function botoes() {
  const r = raiz();
  const md = f => f.endsWith('.md') && f !== '00-INDICE.md';
  const nAn = r ? contar(path.join(r, '.analisys'), md) : 0;
  const nRe = r ? contar(path.join(r, '.report'), md) : 0;
  const nSc = r ? contar(path.join(r, '.scripts'), f => /\.(js|sh|ps1)$/.test(f)) : 0;
  const nAr = r ? contar(path.join(r, '.files'), () => true) : 0;
  const tema = vscode.workspace.getConfiguration('workbench').get('colorTheme') || '';
  // the theme name is a pt-BR identifier; the screen shows the look's English name
  const vis = VISUAIS.find(v => v.nome === tema);
  const nomeTela = vis ? vis.exibir.replace(/ Soft$/, '') : tema;
  return [
    { id: 'visual', tecla: 'V', rotulo: 'Visual', info: nomeTela.replace(/^M80 /, '').replace('Quarterdeck ', '').split(' ').slice(0, 2).join(' '), cor: 'laranja' },
    { id: 'suave', tecla: 'S', rotulo: 'Soft', info: / (Suave|Soft)$/.test(tema) ? 'on' : 'off', cor: 'azul' },
    { id: 'analises', tecla: 'A', rotulo: 'Analyses', info: String(nAn), cor: 'azul' },
    { id: 'relatorios', tecla: 'R', rotulo: 'Reports', info: String(nRe), cor: 'azul' },
    { id: 'scripts', tecla: 'C', rotulo: 'sCripts', info: String(nSc), cor: 'laranja' },
    { id: 'anexos', tecla: 'X', rotulo: 'inboX', info: String(nAr), cor: 'azul' },
    { id: 'claudemd', tecla: 'I', rotulo: 'Instructions', info: 'CLAUDE.md', cor: 'vermelho' },
    { id: 'explorador', tecla: 'E', rotulo: 'Explorer', info: '', cor: 'magenta' },
  ];
}

const ACOES = {
  visual: () => vscode.commands.executeCommand('m80.trocarVisual'),
  suave: () => vscode.commands.executeCommand('m80.alternarSuave'),
  analises: () => { const r = raiz(); if (r) return escolherEAbrir(path.join(r, '.analisys'), f => f.endsWith('.md'), 'M80: analyses'); },
  relatorios: () => { const r = raiz(); if (r) return escolherEAbrir(path.join(r, '.report'), f => f.endsWith('.md'), 'M80: reports'); },
  scripts: rodarScript,
  anexos: () => { const r = raiz(); if (r) return vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(path.join(r, '.files'))); },
  claudemd: () => { const r = raiz(); if (r) return vscode.window.showTextDocument(vscode.Uri.file(path.join(r, 'CLAUDE.md'))); },
  explorador: () => vscode.commands.executeCommand('workbench.view.explorer'),
};

function html(webview) {
  const r = raiz();
  const nome = r ? path.basename(r) : 'no project';
  const nonce = Math.random().toString(36).slice(2);
  const lista = botoes().map((b, i) => {
    const k = b.rotulo.indexOf(b.tecla) >= 0 ? b.rotulo.indexOf(b.tecla) : b.rotulo.toUpperCase().indexOf(b.tecla);
    const rot = k >= 0 ? `${esc(b.rotulo.slice(0, k))}<u>${esc(b.rotulo[k])}</u>${esc(b.rotulo.slice(k + 1))}` : esc(b.rotulo);
    return `<button class="b ${b.cor}" data-id="${b.id}" data-k="${b.tecla}" ${i === 0 ? 'autofocus' : ''}><span class="r">${rot}</span><span class="i">${esc(b.info)}</span></button>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { margin: 0; padding: 12px 10px; background: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
         font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .moldura { border: 3px double var(--vscode-sideBar-foreground, #000); padding: 12px 12px 8px; }
  .titulo { display: inline-block; background: #ff0000; color: #ffff55; padding: 2px 10px; margin-bottom: 14px; box-shadow: 6px 5px 0 #555; }
  .b { display: flex; justify-content: space-between; gap: 8px; width: calc(100% - 8px); margin: 0 8px 10px 0; padding: 1px 8px;
       border: 0; font: inherit; cursor: pointer; box-shadow: 6px 5px 0 #000000; text-align: left; }
  .b u { text-decoration: none; color: #ffff55; }
  .b .i { opacity: .9; }
  .laranja { background: #ffaa00; color: #000; } .laranja u { color: #fff; }
  .azul { background: #0000aa; color: #fff; }
  .vermelho { background: #ff0000; color: #fff; }
  .magenta { background: #ff00ff; color: #fff; }
  .b:hover, .b:focus { background: #00aaff; color: #000; outline: none; }
  .b:focus::before { content: '\\25BA'; color: #fff; margin-left: -6px; }
  .b:active { transform: translate(3px, 3px); box-shadow: 3px 2px 0 #000; }
  .rodape { margin-top: 10px; white-space: pre; }
</style></head><body>
<div class="moldura">
  <span class="titulo">${esc(nome)}</span>
  ${lista}
  <div class="rodape">F5=Refresh  Letter=Shortcut</div>
</div>
<script nonce="${nonce}">
  const vs = acquireVsCodeApi();
  document.querySelectorAll('.b').forEach(b => b.addEventListener('click', () => vs.postMessage({ id: b.dataset.id })));
  document.addEventListener('keydown', e => {
    if (e.key === 'F5') { e.preventDefault(); vs.postMessage({ id: 'atualizar' }); return; }
    const b = [...document.querySelectorAll('.b')].find(x => x.dataset.k === e.key.toUpperCase());
    if (b && !e.ctrlKey && !e.altKey) { e.preventDefault(); b.focus(); vs.postMessage({ id: b.dataset.id }); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const t = [...document.querySelectorAll('.b')]; const i = t.indexOf(document.activeElement);
      const n = t[(i + (e.key === 'ArrowDown' ? 1 : t.length - 1)) % t.length]; if (n) { e.preventDefault(); n.focus(); }
    }
  });
</script></body></html>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

class MenuM80 {
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = html(view.webview);
    view.webview.onDidReceiveMessage(async m => {
      if (m.id === 'atualizar') { this.atualizar(); return; }
      const acao = ACOES[m.id];
      if (acao) { await acao(); this.atualizar(); }
    });
    view.onDidChangeVisibility(() => { if (view.visible) this.atualizar(); });
  }
  atualizar() {
    if (this.view) this.view.webview.html = html(this.view.webview);
  }
}

function registrarMenu(context) {
  const menu = new MenuM80();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('m80.menu', menu),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('workbench.colorTheme')) menu.atualizar(); }),
    vscode.commands.registerCommand('m80.abrirMenu', () => vscode.commands.executeCommand('m80.menu.focus'))
  );
}

module.exports = { registrarMenu, botoes, html };
