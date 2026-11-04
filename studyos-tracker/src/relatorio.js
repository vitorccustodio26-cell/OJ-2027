/*
 * StudyOS Tracker — relatório da Etapa 1 (verificação de seletores).
 * Puro: recebe análises (saída de analisador.analisarDocumento) e devolve
 * um diagnóstico por hipótese + texto em Markdown para colar na conversa.
 */
(function (raiz) {
  'use strict';
  const ns = (raiz.StudyOSTracker = raiz.StudyOSTracker || {});

  const CENARIOS = {
    antes: 'Antes de responder',
    acerto: 'Depois de acertar',
    erro: 'Depois de errar',
    repetida: 'Já respondida anteriormente',
    outro: 'Outro'
  };

  const OK = '✔ bate', NAO = '✘ diverge', TALVEZ = '? inconclusivo', NA = '— n/a';

  /** Sinal de que o arquivo é o HTML "cru" (sem a página renderizada). */
  function pareceHtmlCru(a, meta) {
    const semNada = !a.cabecalho.seletor.vencedora && !a.alternativas.lista.vencedora && !a.feedback.presente;
    return semNada && (meta && meta.tamanhoTextoCorpo != null ? meta.tamanhoTextoCorpo < 800 : true);
  }

  /** Avalia cada hipótese em uma análise, considerando o cenário. */
  function avaliar(a, cenario) {
    const r = {};
    r.botaoResolver = cenario === 'antes'
      ? (a.botaoResolver.seletor.hipotesePrincipalOk ? OK : NAO)
      : (a.botaoResolver.seletor.hipotesePrincipalOk ? OK : TALVEZ);
    r.alternativas = a.alternativas.itens.tentativas[0].encontrados > 0 ? OK : NAO;
    r.roleRadio = a.alternativas.quantidade === 0 ? TALVEZ : a.alternativas.itemComRoleRadio ? OK : NAO;
    if (cenario === 'antes') {
      r.feedback = a.feedback.presente ? NAO + ' (feedback já presente antes de responder)' : OK + ' (ausente, como esperado)';
    } else if (cenario === 'acerto' || cenario === 'erro') {
      if (!a.feedback.presente) r.feedback = NAO + ' (feedback não encontrado)';
      else if (!a.feedback.seletor.hipotesePrincipalOk) r.feedback = TALVEZ + ' (achado só pelo fallback)';
      else r.feedback = OK;
      const s = a.feedback.sinais;
      r.sinalClasses = s.classes === cenario ? OK : s.classes ? NAO + ' (indicou ' + s.classes + ')' : NAO + ' (sem sinal)';
      r.sinalIcone = s.icone === cenario ? OK : s.icone ? NAO + ' (indicou ' + s.icone + ')' : NAO + ' (sem sinal)';
      r.sinalTexto = s.texto === cenario ? OK : s.texto ? NAO + ' (indicou ' + s.texto + ')' : NAO + ' (sem sinal)';
      const c = a.feedback.classificacao;
      r.classificacaoFinal = c && c.resultado === cenario ? OK + ' (via ' + c.fonte + ')' : NAO + ' (resultado: ' + (c && c.resultado) + ')';
    } else if (cenario === 'repetida') {
      r.feedback = a.feedback.presente
        ? 'feedback presente ao abrir (resultado lido: ' + (a.feedback.classificacao && a.feedback.classificacao.resultado) + ') — precisa do "armar" para não contar'
        : 'feedback ausente ao abrir';
    } else r.feedback = a.feedback.presente ? 'presente' : 'ausente';
    r.id = a.id.estrategia === 'link do cabeçalho' ? OK : a.id.valor ? TALVEZ + ' (só via ' + a.id.estrategia + (a.id.fragil ? ', FRÁGIL' : '') + ')' : NAO;
    r.materia = a.materia.seletor.hipotesePrincipalOk ? OK : a.materia.valor ? TALVEZ + ' (só via fallback)' : NAO;
    r.assunto = a.assunto.seletor.hipotesePrincipalOk ? OK : a.assunto.valor ? TALVEZ + ' (só via fallback)' : NAO;
    return r;
  }

  const ROTULOS = {
    botaoResolver: 'Botão resolver (.botao-resolver)',
    alternativas: 'Alternativas (.questao-enunciado-alternativas li)',
    roleRadio: 'Itens com role="radio"',
    feedback: 'Feedback (.questao-enunciado-mensagem-resolucao)',
    sinalClasses: 'Sinal 1: classes do wrapper',
    sinalIcone: 'Sinal 2: ícone ok/erro',
    sinalTexto: 'Sinal 3: texto "Você acertou/errou"',
    classificacaoFinal: 'Classificação final',
    id: 'ID (link /questoes/<n> no cabeçalho)',
    materia: 'Matéria (link /materias/)',
    assunto: 'Assunto (.questao-cabecalho-informacoes-assunto-link)'
  };

  /** Resumo do diagnóstico ao vivo (SPA etc.). */
  function resumirLog(log) {
    if (!log || !log.length) return null;
    const instancias = new Set(log.map((e) => e.instancia));
    const trocasSemRecarregar = log.filter((e) => e.tipo === 'questao-mudou').length;
    const urls = log.filter((e) => e.tipo === 'url-mudou').length;
    const inseridos = log.filter((e) => e.tipo === 'feedback-inserido').length;
    const porEstado = log.filter((e) => e.tipo === 'feedback-estado').length;
    const cliquesAlt = log.filter((e) => e.tipo === 'clique-alternativa').length;
    const cliquesRes = log.filter((e) => e.tipo === 'clique-resolver').length;
    return { eventos: log.length, carregamentos: instancias.size, trocasSemRecarregar, urls, inseridos, porEstado, cliquesAlt, cliquesRes };
  }

  /** Markdown com tudo (para copiar e colar). */
  function gerarMarkdown(itens, log) {
    const L = [];
    L.push('# StudyOS Tracker — Etapa 1: verificação de seletores');
    L.push('');
    for (const it of itens) {
      const a = it.analise;
      L.push('## ' + (CENARIOS[it.cenario] || it.cenario) + ' — `' + (it.nomeArquivo || 'página ao vivo') + '`');
      if (pareceHtmlCru(a, it.meta)) {
        L.push('> ⚠ Este arquivo parece ser só o HTML original, sem a questão renderizada. Salve de novo como **"Página da Web, completa"** (só o .html importa).');
      }
      const av = avaliar(a, it.cenario);
      L.push('| Hipótese | Resultado |');
      L.push('|---|---|');
      for (const k of Object.keys(av)) L.push('| ' + (ROTULOS[k] || k) + ' | ' + av[k] + ' |');
      L.push('');
      L.push('- ID lido: `' + a.id.valor + '` (' + (a.id.estrategia || 'nenhuma estratégia') + ')');
      L.push('- Matéria lida: `' + a.materia.valor + '`' + (a.materia.href ? ' → ' + a.materia.href : ''));
      L.push('- Assunto lido: `' + a.assunto.valor + '`');
      L.push('- Alternativas: ' + a.alternativas.quantidade + ' (estrutura: `' + a.alternativas.estruturaItem + '`)');
      L.push('- Botão resolver: `' + a.botaoResolver.estrutura + '`');
      if (a.feedback.presente) {
        L.push('- Feedback: `' + a.feedback.estrutura + '`');
        L.push('  - classes lidas (nó + 3 ancestrais + filhos): `' + a.feedback.classesLidas + '`');
        L.push('  - texto: "' + a.feedback.textoFeedback + '"');
      }
      L.push('- Seletores que acharam algo:');
      for (const [nome, s] of [['botão', a.botaoResolver.seletor], ['alternativas', a.alternativas.itens], ['feedback', a.feedback.seletor], ['cabeçalho', a.cabecalho.seletor], ['matéria', a.materia.seletor], ['assunto', a.assunto.seletor]]) {
        L.push('  - ' + nome + ': ' + s.tentativas.map((t) => '`' + t.seletor + '`=' + t.encontrados).join(', '));
      }
      if (a.candidatos.classes.length) {
        L.push('<details><summary>Estruturas candidatas (classes com nomes sugestivos)</summary>');
        L.push('');
        for (const c of a.candidatos.classes) L.push('- `' + c.estrutura + '` ×' + c.n);
        L.push('- links /questoes/<n>: ' + a.candidatos.links.questoes + ' ' + a.candidatos.links.exemplosQuestoes.map((x) => '`' + x + '`').join(' '));
        L.push('- links /materias/: ' + a.candidatos.links.materias + ' ' + a.candidatos.links.exemplosMaterias.map((x) => '`' + x + '`').join(' '));
        L.push('</details>');
      }
      L.push('');
    }
    const r = resumirLog(log);
    if (r) {
      L.push('## Diagnóstico ao vivo');
      L.push('- Eventos: ' + r.eventos + ' · carregamentos de página: ' + r.carregamentos + ' · mudanças de URL sem recarregar: ' + r.urls);
      L.push('- Trocas de questão SEM recarregar (SPA): **' + r.trocasSemRecarregar + '**');
      L.push('- Feedback inserido no DOM: ' + r.inseridos + ' · mudanças de estado do feedback: ' + r.porEstado);
      L.push('- Cliques em alternativa: ' + r.cliquesAlt + ' · cliques em resolver: ' + r.cliquesRes);
      L.push('');
      L.push('<details><summary>Eventos</summary>');
      L.push('');
      for (const e of log) L.push('- ' + new Date(e.t).toLocaleTimeString('pt-BR') + ' [' + e.instancia + '] ' + e.tipo + ' ' + JSON.stringify(e.dados || {}));
      L.push('</details>');
    }
    return L.join('\n');
  }

  const api = { CENARIOS, avaliar, gerarMarkdown, resumirLog, pareceHtmlCru, ROTULOS };
  ns.relatorio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
