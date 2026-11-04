'use strict';
(function () {
  const ns = globalThis.StudyOSTracker;
  const perfil = ns.PERFIS.tec;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '—' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cenarios = ['antes', 'acerto', 'erro', 'repetida'];
  let itens = [];      // de arquivos
  let capturas = [];   // capturadas ao vivo pelo popup
  let log = [];

  /** Extrai o HTML de um .mhtml ("Página da Web, arquivo único"). */
  function htmlDeMhtml(txt) {
    const b = txt.match(/boundary="?([^";\r\n]+)"?/i);
    if (!b) return txt;
    for (const parte of txt.split('--' + b[1])) {
      const fim = parte.search(/\r?\n\r?\n/);
      if (fim < 0) continue;
      const cab = parte.slice(0, fim);
      if (!/content-type:\s*text\/html/i.test(cab)) continue;
      let corpo = parte.slice(fim).replace(/^\s+/, '');
      if (/quoted-printable/i.test(cab)) {
        corpo = corpo.replace(/=\r?\n/g, '');
        const bytes = [];
        for (let i = 0; i < corpo.length; i++) {
          if (corpo[i] === '=' && /^[0-9A-F]{2}$/i.test(corpo.substr(i + 1, 2))) { bytes.push(parseInt(corpo.substr(i + 1, 2), 16)); i += 2; }
          else bytes.push(corpo.charCodeAt(i) & 0xff);
        }
        corpo = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      } else if (/base64/i.test(cab)) {
        corpo = new TextDecoder('utf-8').decode(Uint8Array.from(atob(corpo.replace(/\s+/g, '')), (c) => c.charCodeAt(0)));
      }
      return corpo;
    }
    return txt;
  }

  function status(t, aviso) { el('status').textContent = t; el('status').className = aviso ? 'aviso' : 'nota'; }

  for (const c of cenarios) {
    const d = document.createElement('label');
    d.className = 'cartao';
    d.innerHTML = '<b>' + ns.relatorio.CENARIOS[c] + '</b><br><input type="file" accept=".html,.htm,.mht,.mhtml" data-cenario="' + c + '">';
    el('entradas').appendChild(d);
  }

  function classe(v) { return v.startsWith('✔') ? 'ok' : v.startsWith('✘') ? 'erro' : v.startsWith('?') ? 'talvez' : ''; }

  async function analisar() {
    itens = [];
    const escolhidos = Array.from(document.querySelectorAll('input[type=file]')).filter((i) => i.files[0]);
    if (!escolhidos.length) { status('Nenhum arquivo escolhido. Escolha ao menos um arquivo nos quadros acima (ou use "Capturar" no ícone da extensão).', true); desenhar(); return; }
    status('Analisando ' + escolhidos.length + ' arquivo(s)…');
    for (const inp of escolhidos) {
      const f = inp.files[0];
      try {
        let html = await f.text();
        if (/\.mht(ml)?$/i.test(f.name) || /^(from:|mime-version:)/im.test(html.slice(0, 500))) html = htmlDeMhtml(html);
        // DOMParser não executa scripts: o arquivo é lido como dado.
        const doc = new DOMParser().parseFromString(html, 'text/html');
        itens.push({
          cenario: inp.dataset.cenario, nomeArquivo: f.name,
          meta: { tamanhoTextoCorpo: doc.body ? doc.body.textContent.length : 0 },
          analise: ns.analisador.analisarDocumento(doc, perfil)
        });
      } catch (e) {
        itens.push({ cenario: inp.dataset.cenario, nomeArquivo: f.name, erro: String(e && e.message || e) });
      }
    }
    const falhas = itens.filter((i) => i.erro).length;
    status('Pronto: ' + (itens.length - falhas) + ' analisado(s)' + (falhas ? ', ' + falhas + ' com erro (veja o relatório)' : '') + '.', !!falhas);
    desenhar();
  }

  function desenhar() {
    const chaves = Object.keys(ns.relatorio.ROTULOS);
    const todos = capturas.concat(itens);
    const validos = todos.filter((i) => !i.erro);
    el('resultado').innerHTML = '';
    if (validos.length) {
      const itens = validos;
      const av = itens.map((it) => ns.relatorio.avaliar(it.analise, it.cenario));
      let h = '<div class="cartao" style="overflow-x:auto"><table><thead><tr><th>Hipótese</th>' + itens.map((it) => '<th>' + esc(ns.relatorio.CENARIOS[it.cenario]) + '<br><span class="nota">' + esc(it.nomeArquivo) + '</span></th>').join('') + '</tr></thead><tbody>';
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
    el('markdown').value = ns.relatorio.gerarMarkdown(todos, log);
  }

  async function carregarLog() {
    const r = await chrome.runtime.sendMessage({ tipo: 'diag:log' });
    log = r.log || [];
    const c = await chrome.runtime.sendMessage({ tipo: 'diag:capturas' });
    capturas = c.capturas || [];
    el('capturas').textContent = capturas.length
      ? 'Capturas feitas pelo ícone: ' + capturas.map((x) => ns.relatorio.CENARIOS[x.cenario] + ' (' + x.nomeArquivo.replace('captura ', '') + ')').join(' · ')
      : 'Nenhuma captura feita pelo ícone ainda.';
    desenhar();
  }

  el('analisar').addEventListener('click', () => analisar().catch((e) => status('Erro: ' + e.message, true)));
  el('limparCapturas').addEventListener('click', async () => { await chrome.runtime.sendMessage({ tipo: 'diag:limparCapturas' }); carregarLog(); });
  el('atualizarLog').addEventListener('click', carregarLog);
  el('limparLog').addEventListener('click', async () => { await chrome.runtime.sendMessage({ tipo: 'diag:limpar' }); carregarLog(); });
  el('copiar').addEventListener('click', async () => {
    await navigator.clipboard.writeText(el('markdown').value);
    el('copiado').textContent = 'Copiado.';
    setTimeout(() => (el('copiado').textContent = ''), 2000);
  });
  carregarLog();
})();
