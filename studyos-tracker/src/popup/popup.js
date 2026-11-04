'use strict';
(async function () {
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '—' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  el('diag').addEventListener('change', (e) => chrome.runtime.sendMessage({ tipo: 'diag:ligar', ativo: e.target.checked }));
  chrome.runtime.sendMessage({ tipo: 'diag:estado' }).then((r) => { el('diag').checked = r.ativo; el('diag').disabled = false; });
  el('abrir').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/paginas/diagnostico.html') }));

  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.tabs.sendMessage(aba.id, { tipo: 'diag:analisarAgora' });
    const a = r.analise;
    const falhou = !a.id.valor || !a.materia.valor;
    el('pagina').innerHTML =
      (falhou ? '<p class="aviso">Não consegui ler a questão.</p>' : '') +
      '<dl>' +
      '<dt>ID</dt><dd>' + esc(a.id.valor) + (a.id.fragil && a.id.valor ? ' <span class="aviso">(frágil)</span>' : '') + '</dd>' +
      '<dt>Matéria</dt><dd>' + esc(a.materia.valor || 'Não identificada') + '</dd>' +
      '<dt>Assunto</dt><dd>' + esc(a.assunto.valor || 'Não identificado') + '</dd>' +
      '<dt>Alternativas</dt><dd>' + a.alternativas.quantidade + '</dd>' +
      '<dt>Feedback</dt><dd>' + (a.feedback.presente ? esc(a.feedback.classificacao.resultado || 'não reconhecido') + ' (' + esc(a.feedback.classificacao.fonte) + ')' : 'ausente') + '</dd>' +
      '</dl>';
  } catch (e) {
    el('pagina').textContent = 'Abra uma questão no TEC Concursos (se a aba já estava aberta antes de instalar a extensão, recarregue-a).';
  }
})();
