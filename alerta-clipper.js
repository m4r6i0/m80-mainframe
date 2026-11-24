'use strict';
// Question window in the Clipper "Alert" style (the same box as the Monitor's "?"): cyan box with a black shadow, black title
// bar, blue buttons and yellow focus. Opens in a VS Code tab (webview) and returns the text of the chosen button.
//   const r = await perguntar(context, { titulo, linhas: ['text', ...], botoes: ['Install', 'Not now'], campo: { rotulo, valor } });
//   r = { botao: 'Install', valor: 'C:\\source' }   (Esc or closing the tab = the LAST button)
// Keyboard: arrows and Tab switch buttons, Enter chooses, Esc cancels.
const vscode = require('vscode');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function html(webview, media, nonce, o) {
  const fonte = webview.asWebviewUri(vscode.Uri.joinPath(media, 'VT323-Regular.ttf'));
  const linhas = o.linhas.map(l => l === '' ? '<br>' : '<p>' + esc(l) + '</p>').join('');
  const campo = o.campo ? '<label>' + esc(o.campo.rotulo) + '<input id="campo" value="' + esc(o.campo.valor || '') + '" spellcheck="false"></label>' : '';
  const botoes = o.botoes.map((b, i) => '<button data-i="' + i + '"' + (i === 0 ? ' autofocus' : '') + '>' + esc(b) + '</button>').join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
@font-face { font-family: "VT323"; src: url(${fonte}); }
:root { --fundo: #00aaaa; --tinta: #000; --bt: #0000aa; --bt-t: #fff; --foco: #ffff55; }
html, body { height: 100%; margin: 0; background: #0000aa; color: #aaa; font-family: "VT323", monospace; font-size: 22px; }
body { display: grid; place-items: center; }
.caixa { width: min(640px, 92vw); background: var(--fundo); color: var(--tinta); border: 2px solid var(--tinta); box-shadow: 12px 10px 0 #000; padding: 0 18px 16px; display: grid; gap: 8px; }
.t { background: var(--tinta); color: var(--fundo); margin: 0 -18px; padding: 2px 0; text-align: center; letter-spacing: .05em; }
p { margin: 0; line-height: 1.1; white-space: pre-wrap; }
label { display: grid; gap: 2px; }
input { font: inherit; background: #fff; color: #000; border: 2px solid var(--tinta); padding: 1px 6px; }
.bts { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-top: 6px; }
button { font: inherit; line-height: 1; border: 0; background: var(--bt); color: var(--bt-t); padding: 3px 16px; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--foco); outline-offset: 1px; }
</style></head><body>
<div class="caixa" role="dialog" aria-modal="true" aria-labelledby="t"><div class="t" id="t">${esc(o.titulo)}</div>${linhas}${campo}<div class="bts">${botoes}</div></div>
<script nonce="${nonce}">
const vs = acquireVsCodeApi(), bs = [...document.querySelectorAll('button')], campo = document.getElementById('campo');
const enviar = i => vs.postMessage({ i, valor: campo ? campo.value : '' });
bs.forEach(b => b.addEventListener('click', () => enviar(+b.dataset.i)));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') enviar(bs.length - 1);
  const f = bs.indexOf(document.activeElement);
  if (e.key === 'ArrowRight' && f >= 0) bs[(f + 1) % bs.length].focus();
  if (e.key === 'ArrowLeft' && f >= 0) bs[(f - 1 + bs.length) % bs.length].focus();
  if (e.key === 'Enter' && document.activeElement === campo) enviar(0);
});
(campo || bs[0]).focus();
</script></body></html>`;
}

function perguntar(context, o) {
  return new Promise(resolve => {
    const media = vscode.Uri.joinPath(context.extensionUri, 'media');
    const painel = vscode.window.createWebviewPanel('m80.alerta', 'M80', { viewColumn: vscode.ViewColumn.Active, preserveFocus: false }, { enableScripts: true, localResourceRoots: [media] });
    const nonce = require('crypto').randomBytes(16).toString('hex');
    let fim = false;
    const sair = r => { if (fim) return; fim = true; resolve(r); try { painel.dispose(); } catch { /* already closed */ } };
    painel.webview.html = html(painel.webview, media, nonce, o);
    painel.webview.onDidReceiveMessage(m => sair({ botao: o.botoes[m.i], valor: m.valor, indice: m.i }));
    painel.onDidDispose(() => sair({ botao: o.botoes[o.botoes.length - 1], valor: '', indice: o.botoes.length - 1 }));
  });
}

module.exports = { perguntar };
module.exports._html = html;
