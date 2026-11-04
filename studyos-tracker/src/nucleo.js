/*
 * StudyOS Tracker — núcleo puro.
 * Sem DOM e sem APIs da extensão: só funções sobre dados. Testado em Node.
 * (Etapa 1: normalização de texto e classificação de resultado por prioridade.
 *  Armar/confirmar, dedup, tempo e sessão entram nas próximas etapas.)
 */
(function (raiz) {
  'use strict';
  const ns = (raiz.StudyOSTracker = raiz.StudyOSTracker || {});

  /** Minúsculas, sem acentos, espaços colapsados. */
  function normalizarTexto(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Quebra uma string de classes em tokens ("msg-acerto foo_bar" -> [msg, acerto, foo, bar]). */
  function tokensDeClasse(classes) {
    return normalizarTexto(classes).split(/[\s\-_]+/).filter(Boolean);
  }

  /**
   * Sinal de classes: 'acerto' | 'erro' | null.
   * Ambíguo (tokens dos dois lados) => null, para não inventar resultado.
   */
  function sinalPorClasses(classes, perfil) {
    const t = new Set(tokensDeClasse(classes));
    const a = perfil.tokensClasseAcerto.some((x) => t.has(x));
    const e = perfil.tokensClasseErro.some((x) => t.has(x));
    if (a && !e) return 'acerto';
    if (e && !a) return 'erro';
    return null;
  }

  /** Sinal de texto: procura "voce acertou"/"voce errou" já normalizados. */
  function sinalPorTexto(texto, perfil) {
    const n = normalizarTexto(texto);
    if (!n) return null;
    const a = perfil.textosAcerto.some((x) => n.includes(normalizarTexto(x)));
    const e = perfil.textosErro.some((x) => n.includes(normalizarTexto(x)));
    if (a && !e) return 'acerto';
    if (e && !a) return 'erro';
    return null;
  }

  /**
   * Classifica por prioridade: (1) classes, (2) ícones, (3) texto.
   * sinais = { classes: 'acerto'|'erro'|null, icone: ..., texto: ... }
   * Retorna { resultado: 'acerto'|'erro'|null, fonte: 'classes'|'icone'|'texto'|null, conflito: bool }
   * conflito = algum sinal de prioridade menor discorda do escolhido (vai para o relatório).
   */
  function classificarResultado(sinais) {
    const ordem = ['classes', 'icone', 'texto'];
    let resultado = null;
    let fonte = null;
    for (const k of ordem) {
      const v = sinais && sinais[k];
      if (v === 'acerto' || v === 'erro') { resultado = v; fonte = k; break; }
    }
    const conflito = !!resultado && ordem.some((k) => {
      const v = sinais[k];
      return (v === 'acerto' || v === 'erro') && v !== resultado;
    });
    return { resultado, fonte, conflito };
  }

  const api = { normalizarTexto, tokensDeClasse, sinalPorClasses, sinalPorTexto, classificarResultado };
  ns.nucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
