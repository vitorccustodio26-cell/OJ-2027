'use strict';
(function () {
  const ns = globalThis.StudyOSTracker;
  const perfil = ns.PERFIS.tec;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '—' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cenarios = ['antes', 'acerto', 'erro', 'repetida'];
  let itens = [];
  let log = [];

  for (const c of cenarios) {
    const d = document.createElement('label');
    d.className = 'cartao';
    d.innerHTML = '<b>' + ns.relatorio.CENARIOS[c] + '</b><br><input type="file" accept=".html,.htm,.mhtml,text/html" data-cenario="' + c + '">';
    el('entradas').appendChild(d);
  }

  function classe(v) { return v.startsWith('✔') ? 'ok' : v.startsWith('✘') ? 'erro' : v.startsWith('?') ? 'talvez' : ''; }

  async function analisar() {
    itens = [];
    for (const inp of document.querySelectorAll('input[type=file]')) {
      const f = inp.files[0];
      if (!f) continue;
      const html = await f.text();
      // DOMParser não executa scripts: o arquivo é lido como dado.
      const doc = new DOMParser().parseFromString(html, 'text/html');
      itens.push({
        cenario: inp.dataset.cenario, nomeArquivo: f.name,
        meta: { tamanhoTextoCorpo: doc.body ? doc.body.textContent.length : 0 },
        analise: ns.analisador.analisarDocumento(doc, perfil)
      });
    }
    desenhar();
  }

  function desenhar() {
    const chaves = Object.keys(ns.relatorio.ROTULOS);
    if (itens.length) {
      const av = itens.map((it) => ns.relatorio.avaliar(it.analise, it.cenario));
      let h = '<div class="cartao" style="overflow-x:auto"><table><thead><tr><th>Hipótese</th>' + itens.map((it) => '<th>' + esc(ns.relatorio.CENARIOS[it.cenario]) + '</th>').join('') + '</tr></thead><tbody>';
      for (const k of chaves) {
        if (!av.some((a) => k in a)) continue;
        h += '<tr><td>' + esc(ns.relatorio.ROTULOS[k]) + '</td>' + av.map((a) => k in a ? '<td class="' + classe(a[k]) + '">' + esc(a[k]) + '</td>' : '<td>—</td>').join('') + '</tr>';
      }
      h += '<tr><td>ID lido</td>' + itens.map((it) => '<td>' + esc(it.analise.id.valor) + '</td>').join('') + '</tr>';
      h += '<tr><td>Matéria lida</td>' + itens.map((it) => '<td>' + esc(it.analise.materia.valor) + '</td>').join('') + '</tr>';
      h += '<tr><td>Assunto lido</td>' + itens.map((it) => '<td>' + esc(it.analise.assunto.valor) + '</td>').join('') + '</tr>';
      h += '</tbody></table></div>';
      const crus = itens.filter((it) => ns.relatorio.pareceHtmlCru(it.analise, it.meta));
      if (crus.length) h = '<p class="aviso">⚠ ' + crus.map((c) => esc(c.nomeArquivo)).join(', ') + ' parece(m) ser só o HTML original, sem a questão. Salve como "Página da Web, completa".</p>' + h;
      el('resultado').innerHTML = h;
    }
    const r = ns.relatorio.resumirLog(log);
    el('resumoLog').innerHTML = r
      ? 'Eventos: ' + r.eventos + ' · carregamentos: ' + r.carregamentos + ' · <b>trocas de questão sem recarregar: ' + r.trocasSemRecarregar + '</b> · feedback inserido: ' + r.inseridos + ' · mudanças de estado do feedback: ' + r.porEstado + ' · cliques em alternativa/resolver: ' + r.cliquesAlt + '/' + r.cliquesRes
      : 'Nenhum evento registrado.';
    el('markdown').value = ns.relatorio.gerarMarkdown(itens, log);
  }

  async function carregarLog() {
    const r = await chrome.runtime.sendMessage({ tipo: 'diag:log' });
    log = r.log || [];
    desenhar();
  }

  el('analisar').addEventListener('click', analisar);
  el('atualizarLog').addEventListener('click', carregarLog);
  el('limparLog').addEventListener('click', async () => { await chrome.runtime.sendMessage({ tipo: 'diag:limpar' }); carregarLog(); });
  el('copiar').addEventListener('click', async () => {
    await navigator.clipboard.writeText(el('markdown').value);
    el('copiado').textContent = 'Copiado.';
    setTimeout(() => (el('copiado').textContent = ''), 2000);
  });
  carregarLog();
})();
