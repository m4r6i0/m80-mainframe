'use strict';
// VS Code layer of the M80 installer: asks (Clipper-style pop-ups), runs the core and shows the result.
// On activation it only ASKS if something is missing or out of date; nothing is written to ~/.claude without "Install".
const vscode = require('vscode');
const os = require('os');
const path = require('path');
const nucleo = require('./instalador-nucleo');
const { perguntar } = require('./alerta-clipper');

const TITULO = 'M80 TEMPLATE';
const payloadDe = context => path.join(context.extensionPath, 'payload');
const opcoesBase = context => ({ payload: payloadDe(context) });

function resumo(plano) {
  const linhas = [];
  for (const [nome, lista] of Object.entries(plano.itens)) if (lista.length) linhas.push('  - ' + nome + ': ' + lista.length + (lista.length === 1 ? ' file' : ' files') + ' to write');
  if (!plano.settingsOk) linhas.push('  - ~/.claude/settings.json: add M80 hooks, local marketplace and plugin m80-motor (backup first)');
  return linhas.length ? linhas : ['  - nothing to write; only the install record is refreshed'];
}

async function escolherRaiz(context, atual) {
  let valor = atual;
  for (;;) {
    const r = await perguntar(context, { titulo: TITULO, linhas: ['Which folder holds your projects?', 'New folders inside it get the M80 template automatically.', ''], botoes: ['OK', 'Browse...', 'Cancel'], campo: { rotulo: 'Projects folder:', valor } });
    if (r.botao === 'Cancel') return null;
    if (r.botao === 'Browse...') {
      const p = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Use this folder', defaultUri: vscode.Uri.file(r.valor || atual) });
      if (p && p[0]) valor = p[0].fsPath; else valor = r.valor || atual;
      continue;
    }
    return (r.valor || atual).trim() || atual;
  }
}

async function instalar(context, { origem } = {}) {
  if (process.platform !== 'win32') { vscode.window.showWarningMessage('M80: the component installer supports Windows only for now.'); return; }
  const base = opcoesBase(context);
  let plano;
  try { plano = nucleo.planejar(base); } catch (e) { vscode.window.showErrorMessage('M80: install package not found in this extension (' + e.message + ').'); return; }
  if (origem === 'ativacao' && !plano.necessario) return;
  if (origem === 'ativacao' && context.globalState.get('m80.adiado') === plano.manifesto.assinatura) return;
  const AUTO = 'Install + auto mode';
  let r = await perguntar(context, { titulo: TITULO, linhas: [plano.instalado ? 'The M80 components are out of date.' : 'The M80 components are not installed on this computer.', '', 'Install the hooks, the m80-motor plugin, the Claude themes,', 'the project template and the IBM fonts?', '', 'Auto mode (Claude runs without asking for each permission)', 'stays OFF unless you pick "' + AUTO + '".', ''], botoes: ['Install', AUTO, 'What changes', 'Not now'] });
  if (r.botao === 'What changes') {
    r = await perguntar(context, { titulo: TITULO + ' - WHAT CHANGES', linhas: ['These items will be written:', ...resumo(plano), '', 'Your own settings, hooks and permissions are kept.', 'A backup of settings.json is saved next to it.', 'Auto mode is only turned on if you pick "' + AUTO + '".'], botoes: ['Install', AUTO, 'Not now'] });
  }
  const modoAuto = r.botao === AUTO;
  if (r.botao !== 'Install' && !modoAuto) { if (origem === 'ativacao') await context.globalState.update('m80.adiado', plano.manifesto.assinatura); return; }
  const raiz = await escolherRaiz(context, (plano.instalado && plano.instalado.raiz) || 'C:/source');
  if (!raiz) return;
  let res;
  try { res = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'M80: installing components...' }, () => nucleo.aplicar({ ...base, raiz, modoAuto })); }
  catch (e) { await perguntar(context, { titulo: TITULO + ' - ERROR', linhas: [String(e.message), '', 'Nothing was changed in your settings.json.'], botoes: ['OK'] }); return; }
  await context.globalState.update('m80.adiado', undefined);
  await perguntar(context, { titulo: TITULO + ' - DONE', linhas: [...res.relatorio.map(l => '- ' + l), ...(res.avisos.length ? ['', 'Notes:', ...res.avisos.map(l => '- ' + l)] : []), '', 'Open Claude sessions pick up the hooks on the next session.', 'Restart VS Code to see the new fonts.'], botoes: ['OK'] });
}

async function desinstalar(context) {
  const inst = nucleo.lerInstalado(opcoesBase(context));
  if (!inst) { vscode.window.showInformationMessage('M80: no installation record found; nothing to uninstall.'); return; }
  const r = await perguntar(context, { titulo: TITULO + ' - UNINSTALL', linhas: ['Remove the M80 hooks, the m80-motor plugin, the Claude themes,', 'the project template and the IBM fonts installed by M80?', '', 'Your own settings stay. Projects already created keep their files.'], botoes: ['Uninstall', 'Cancel'] });
  if (r.botao !== 'Uninstall') return;
  const res = await nucleo.desfazer(opcoesBase(context));
  await context.globalState.update('m80.adiado', undefined);
  await perguntar(context, { titulo: TITULO + ' - DONE', linhas: res.relatorio.map(l => '- ' + l), botoes: ['OK'] });
}

function registrarInstalador(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('m80.instalar', () => instalar(context, {})),
    vscode.commands.registerCommand('m80.desinstalar', () => desinstalar(context))
  );
  // when VS Code opens: asks once per package version if something is missing (waits 4 s so it does not compete with startup)
  if (!process.env.M80_SEM_INSTALADOR) setTimeout(() => { instalar(context, { origem: 'ativacao' }).catch(() => { /* the question is optional */ }); }, 4000);
}

module.exports = { registrarInstalador };
