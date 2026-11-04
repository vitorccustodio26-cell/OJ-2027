/*
 * StudyOS Tracker — content script (TEC). SOMENTE LEITURA.
 * Etapa 1: só o "diagnóstico ao vivo" (desligado por padrão). Nunca clica,
 * nunca altera a página: escuta eventos de forma passiva, lê o DOM e envia
 * mensagens ao service worker, que é o único que grava estado.
 */
(function () {
  'use strict';
  const ns = globalThis.StudyOSTracker;
  const perfil = ns.perfilPorHost(location.hostname);
  if (!perfil) return;

  const instancia = Math.random().toString(36).slice(2, 7);
  let ativo = false;
  let observador = null;
  let timerUrl = null;
  let timerDebounce = null;
  let ultimaUrl = location.href;
  let ultimoInstantaneo = null;

  function enviar(tipo, dados) {
    try {
      chrome.runtime.sendMessage({ tipo: 'diag:evento', evento: { t: Date.now(), instancia, tipo, url: location.pathname, dados } }).catch(() => {});
    } catch (e) { /* extensão recarregada: contexto inválido */ }
  }

  function visivel(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  function instantaneo() {
    const a = ns.analisador;
    const id = a.lerId(document, perfil);
    const f = a.lerFeedback(document, perfil);
    const fEl = f.presente ? document.querySelector(f.seletor.vencedora) : null;
    return {
      id: id.valor, idFragil: id.fragil, idEstrategia: id.estrategia,
      materia: a.lerMateria(document, perfil).valor,
      assunto: a.lerAssunto(document, perfil).valor,
      feedback: f.presente, feedbackVisivel: visivel(fEl),
      resultado: f.classificacao ? f.classificacao.resultado : null,
      fonte: f.classificacao ? f.classificacao.fonte : null,
      sinais: f.sinais
    };
  }

  function comparar() {
    const s = instantaneo();
    const u = ultimoInstantaneo;
    ultimoInstantaneo = s;
    if (!u) return;
    if (s.id !== u.id) enviar('questao-mudou', { de: u.id, para: s.id, materia: s.materia, assunto: s.assunto, feedbackAoAbrir: s.feedback, resultadoAoAbrir: s.resultado });
    else if (s.feedback !== u.feedback || s.feedbackVisivel !== u.feedbackVisivel || s.resultado !== u.resultado) {
      enviar('feedback-estado', { id: s.id, presente: s.feedback, visivel: s.feedbackVisivel, resultado: s.resultado, fonte: s.fonte, sinais: s.sinais });
    }
  }

  function casa(el, seletores) {
    if (!el || !el.closest) return null;
    for (const s of seletores) { try { const c = el.closest(s); if (c) return c; } catch (e) {} }
    return null;
  }

  function aoClicar(ev) {
    const t = ev.target;
    if (casa(t, perfil.seletores.botaoResolver)) enviar('clique-resolver', { id: (ultimoInstantaneo || {}).id });
    else if (casa(t, perfil.seletores.alternativaItem)) enviar('clique-alternativa', { id: (ultimoInstantaneo || {}).id });
  }

  function aoMudar(mutacoes) {
    for (const m of mutacoes) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const achou = perfil.seletores.feedback.some((s) => { try { return n.matches(s) || n.querySelector(s); } catch (e) { return false; } });
        if (achou) {
          const f = ns.analisador.lerFeedback(document, perfil);
          enviar('feedback-inserido', { estrutura: f.estrutura, sinais: f.sinais, resultado: f.classificacao && f.classificacao.resultado, fonte: f.classificacao && f.classificacao.fonte, conflito: f.classificacao && f.classificacao.conflito });
        }
      }
    }
    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(comparar, 300);
  }

  function ligar() {
    if (ativo) return;
    ativo = true;
    const nav = (performance.getEntriesByType('navigation')[0] || {}).type || 'desconhecido';
    ultimoInstantaneo = instantaneo();
    enviar('carregou', Object.assign({ navegacao: nav }, ultimoInstantaneo));
    observador = new MutationObserver(aoMudar);
    observador.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    document.addEventListener('click', aoClicar, { capture: true, passive: true });
    timerUrl = setInterval(() => {
      if (location.href !== ultimaUrl) { enviar('url-mudou', { de: new URL(ultimaUrl).pathname, para: location.pathname }); ultimaUrl = location.href; }
    }, 1000);
  }

  function desligar() {
    if (!ativo) return;
    ativo = false;
    if (observador) observador.disconnect();
    document.removeEventListener('click', aoClicar, { capture: true });
    clearInterval(timerUrl);
    clearTimeout(timerDebounce);
  }

  chrome.storage.local.get('diagAtivo').then((r) => { if (r.diagAtivo) ligar(); });
  chrome.storage.onChanged.addListener((mud, area) => {
    if (area === 'local' && mud.diagAtivo) (mud.diagAtivo.newValue ? ligar : desligar)();
  });

  // Popup pede uma análise da página atual (somente leitura).
  chrome.runtime.onMessage.addListener((msg, _rem, responder) => {
    if (msg && msg.tipo === 'diag:analisarAgora') {
      responder({ ok: true, perfil: perfil.nome, analise: ns.analisador.analisarDocumento(document, perfil), tamanhoTextoCorpo: (document.body ? document.body.textContent.length : 0) });
    }
  });
})();
