/*
 * StudyOS Tracker — service worker. ÚNICO que grava estado.
 * Etapa 1: guarda o log do diagnóstico ao vivo (chrome.storage.session) e o
 * interruptor do diagnóstico (chrome.storage.local). Nenhuma requisição de rede.
 */
'use strict';

const LIMITE_LOG = 400;

// Fila única de gravações: evita corrida entre mensagens simultâneas.
let fila = Promise.resolve();
function gravar(fn) {
  fila = fila.then(fn).catch((e) => console.error('[StudyOS Tracker]', e));
  return fila;
}

async function atualizarSelo() {
  const { diagAtivo } = await chrome.storage.local.get('diagAtivo');
  await chrome.action.setBadgeText({ text: diagAtivo ? 'DIAG' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
}

chrome.runtime.onInstalled.addListener(atualizarSelo);
chrome.runtime.onStartup.addListener(atualizarSelo);

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (!msg || typeof msg.tipo !== 'string') return;
  switch (msg.tipo) {
    case 'diag:evento':
      gravar(async () => {
        const { diagLog = [] } = await chrome.storage.session.get('diagLog');
        diagLog.push(msg.evento);
        await chrome.storage.session.set({ diagLog: diagLog.slice(-LIMITE_LOG) });
      });
      return;
    case 'diag:log':
      chrome.storage.session.get('diagLog').then((r) => responder({ log: r.diagLog || [] }));
      return true;
    case 'diag:limpar':
      gravar(() => chrome.storage.session.set({ diagLog: [] })).then(() => responder({ ok: true }));
      return true;
    case 'diag:ligar':
      gravar(async () => { await chrome.storage.local.set({ diagAtivo: !!msg.ativo }); await atualizarSelo(); }).then(() => responder({ ok: true }));
      return true;
    case 'diag:capturar':
      gravar(async () => {
        const { diagCapturas = [] } = await chrome.storage.session.get('diagCapturas');
        diagCapturas.push(msg.item);
        await chrome.storage.session.set({ diagCapturas: diagCapturas.slice(-20) });
      }).then(() => responder({ ok: true }));
      return true;
    case 'diag:capturas':
      chrome.storage.session.get('diagCapturas').then((r) => responder({ capturas: r.diagCapturas || [] }));
      return true;
    case 'diag:limparCapturas':
      gravar(() => chrome.storage.session.set({ diagCapturas: [] })).then(() => responder({ ok: true }));
      return true;
    case 'diag:estado':
      chrome.storage.local.get('diagAtivo').then((r) => responder({ ativo: !!r.diagAtivo }));
      return true;
  }
});
