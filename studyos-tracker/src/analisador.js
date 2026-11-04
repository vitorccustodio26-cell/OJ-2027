/*
 * StudyOS Tracker — analisador de página (SOMENTE LEITURA).
 * Recebe um Document (página viva ou arquivo salvo aberto com DOMParser) e um
 * perfil, e relata o que cada estratégia de seletor encontrou. Nunca altera o DOM.
 * Não devolve enunciado nem alternativas: só estrutura (tag/classe) e os
 * metadados de cabeçalho (ID, matéria, assunto) e o texto curto do feedback.
 */
(function (raiz) {
  'use strict';
  const ns = (raiz.StudyOSTracker = raiz.StudyOSTracker || {});
  const nucleo = ns.nucleo || (typeof require === 'function' ? require('./nucleo.js') : null);

  function q(raizBusca, sel) {
    try { return Array.from(raizBusca.querySelectorAll(sel)); } catch (e) { return []; }
  }

  /** Testa as estratégias em ordem; devolve todas as tentativas e a vencedora. */
  function tentar(raizBusca, seletores) {
    const tentativas = seletores.map((sel) => ({ seletor: sel, encontrados: q(raizBusca, sel).length }));
    const idx = tentativas.findIndex((t) => t.encontrados > 0);
    return {
      tentativas,
      vencedora: idx >= 0 ? tentativas[idx].seletor : null,
      hipotesePrincipalOk: tentativas[0] && tentativas[0].encontrados > 0,
      elementos: idx >= 0 ? q(raizBusca, seletores[idx]) : []
    };
  }

  function textoCurto(el, max) {
    const t = (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function descrever(el) {
    if (!el || !el.tagName) return null;
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
    const role = el.getAttribute && el.getAttribute('role');
    return el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).join('.') : '') + (role ? '[role=' + role + ']' : '');
  }

  /** Classes do nó e dos ancestrais próximos (wrapper) — até 3 níveis acima. */
  function classesDoWrapper(el) {
    const partes = [];
    let atual = el;
    for (let i = 0; atual && atual.getAttribute && i < 4; i++, atual = atual.parentElement) {
      partes.push(atual.getAttribute('class') || '');
    }
    return partes.join(' ');
  }

  /** Lê os sinais do feedback de resultado. */
  function lerFeedback(doc, perfil) {
    const r = tentar(doc, perfil.seletores.feedback);
    const el = r.elementos[0] || null;
    const out = { seletor: r, presente: !!el, estrutura: null, sinais: { classes: null, icone: null, texto: null }, textoFeedback: '', classificacao: null };
    if (!el) return out;
    out.estrutura = descrever(el);
    // Classes: do próprio nó e dos descendentes diretos (o wrapper pode ser filho)
    const classesProprias = [classesDoWrapper(el)].concat(Array.from(el.children || []).map((c) => c.getAttribute('class') || '')).join(' ');
    out.sinais.classes = nucleo.sinalPorClasses(classesProprias, perfil);
    const temIconeOk = perfil.seletores.iconeAcerto.some((s) => q(el, s).length > 0);
    const temIconeErro = perfil.seletores.iconeErro.some((s) => q(el, s).length > 0);
    out.sinais.icone = temIconeOk && !temIconeErro ? 'acerto' : temIconeErro && !temIconeOk ? 'erro' : null;
    out.textoFeedback = textoCurto(el, 120);
    out.sinais.texto = nucleo.sinalPorTexto(el.textContent, perfil);
    out.classesLidas = classesProprias.replace(/\s+/g, ' ').trim();
    out.classificacao = nucleo.classificarResultado(out.sinais);
    return out;
  }

  /** ID: link /questoes/<n> no cabeçalho > "#<4+ dígitos"> > "Questão X de Y" (frágil). */
  function lerId(doc, perfil) {
    const r = tentar(doc, perfil.seletores.idLink);
    for (const a of r.elementos) {
      const m = (a.getAttribute('href') || '').match(perfil.regexIdHref);
      if (m) return { valor: m[1], estrategia: 'link do cabeçalho', fragil: false, seletor: r };
    }
    const cab = tentar(doc, perfil.seletores.cabecalho).elementos[0];
    const textoCab = cab ? cab.textContent : '';
    const m2 = textoCab.match(perfil.regexIdTexto);
    if (m2) return { valor: m2[1], estrategia: 'texto #número no cabeçalho', fragil: false, seletor: r };
    const corpo = doc.body ? doc.body.textContent : '';
    const m3 = corpo.match(perfil.regexPosicao);
    if (m3) return { valor: 'pos-' + m3[1] + '-de-' + m3[2], estrategia: '"Questão X de Y"', fragil: true, seletor: r };
    return { valor: null, estrategia: null, fragil: true, seletor: r };
  }

  function lerMateria(doc, perfil) {
    const r = tentar(doc, perfil.seletores.materia);
    const el = r.elementos.find((a) => !a.getAttribute || !a.getAttribute('href') || perfil.regexHrefMateria.test(a.getAttribute('href'))) || r.elementos[0];
    return { valor: el ? textoCurto(el, 120) || null : null, href: el && el.getAttribute ? el.getAttribute('href') : null, seletor: r };
  }

  function lerAssunto(doc, perfil) {
    const r = tentar(doc, perfil.seletores.assunto);
    const el = r.elementos[0];
    return { valor: el ? textoCurto(el, 160) || null : null, seletor: r };
  }

  /** Para quando a hipótese falha: lista estruturas com nomes sugestivos (sem texto). */
  function candidatos(doc) {
    const palavras = ['resolver', 'alternativa', 'resolucao', 'mensagem', 'materia', 'assunto', 'cabecalho', 'acert', 'errou', 'gabarito'];
    const vistos = new Map();
    for (const el of q(doc, '[class]')) {
      const cls = (el.getAttribute('class') || '').toLowerCase();
      if (!palavras.some((p) => cls.includes(p))) continue;
      const d = descrever(el);
      vistos.set(d, (vistos.get(d) || 0) + 1);
      if (vistos.size >= 60) break;
    }
    const links = { questoes: 0, materias: 0, exemplosQuestoes: [], exemplosMaterias: [] };
    for (const a of q(doc, 'a[href]')) {
      const h = a.getAttribute('href');
      if (/\/questoes\/\d+/.test(h)) { links.questoes++; if (links.exemplosQuestoes.length < 5) links.exemplosQuestoes.push(h + ' (dentro de ' + descrever(a.parentElement) + ')'); }
      if (/\/materias\//.test(h)) { links.materias++; if (links.exemplosMaterias.length < 5) links.exemplosMaterias.push(h + ' (dentro de ' + descrever(a.parentElement) + ')'); }
    }
    return { classes: Array.from(vistos, ([estrutura, n]) => ({ estrutura, n })), links };
  }

  /**
   * Onde pode estar o ID real da questão: números de 4+ dígitos em links,
   * atributos e marcas de texto ("#123456", "Q123456"). Só devolve o número,
   * o nome do atributo e a estrutura (tag/classe) — nunca texto do enunciado.
   */
  function candidatosId(doc) {
    const out = { atributos: [], textos: [] };
    const vistos = new Set();
    const corpo = doc.body || doc.documentElement;
    if (!corpo) return out;
    for (const el of q(corpo, '*')) {
      if (out.atributos.length >= 40) break;
      for (const at of Array.from(el.attributes || [])) {
        if (at.name === 'class' || at.name === 'style') continue;
        const m = String(at.value).match(/(?:questoes?[\/\-_=]|^|[^\d])(\d{5,9})(?:[^\d]|$)/i);
        if (!m) continue;
        const chave = at.name + '=' + m[1];
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        out.atributos.push({ estrutura: descrever(el), atributo: at.name, numero: m[1], valor: String(at.value).slice(0, 80) });
        if (out.atributos.length >= 40) break;
      }
    }
    const texto = corpo.textContent || '';
    const re = /(#\s?\d{4,9}|\bQ\s?\d{5,9}\b|\bc[oó]d(?:igo)?\.?\s*:?\s*\d{4,9})/gi;
    let m;
    while ((m = re.exec(texto)) && out.textos.length < 20) out.textos.push(m[1].replace(/\s+/g, ' '));
    return out;
  }

  /** Relatório completo de uma página. */
  function analisarDocumento(doc, perfil) {
    const botao = tentar(doc, perfil.seletores.botaoResolver);
    const lista = tentar(doc, perfil.seletores.alternativasLista);
    const itens = tentar(doc, perfil.seletores.alternativaItem);
    const cab = tentar(doc, perfil.seletores.cabecalho);
    return {
      perfil: perfil.id,
      botaoResolver: { seletor: limpar(botao), estrutura: descrever(botao.elementos[0]) },
      alternativas: {
        lista: limpar(lista),
        itens: limpar(itens),
        quantidade: itens.elementos.length,
        itemComRoleRadio: itens.elementos.some((e) => e.getAttribute && e.getAttribute('role') === 'radio'),
        estruturaItem: descrever(itens.elementos[0])
      },
      feedback: (function () { const f = lerFeedback(doc, perfil); f.seletor = limpar(f.seletor); return f; })(),
      cabecalho: { seletor: limpar(cab), estrutura: descrever(cab.elementos[0]) },
      id: (function () { const x = lerId(doc, perfil); x.seletor = limpar(x.seletor); return x; })(),
      materia: (function () { const x = lerMateria(doc, perfil); x.seletor = limpar(x.seletor); return x; })(),
      assunto: (function () { const x = lerAssunto(doc, perfil); x.seletor = limpar(x.seletor); return x; })(),
      candidatos: candidatos(doc),
      candidatosId: candidatosId(doc)
    };
  }

  function limpar(r) { return { tentativas: r.tentativas, vencedora: r.vencedora, hipotesePrincipalOk: r.hipotesePrincipalOk }; }

  const api = { analisarDocumento, candidatosId, lerFeedback, lerId, lerMateria, lerAssunto };
  ns.analisador = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
