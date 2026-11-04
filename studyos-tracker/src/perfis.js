/*
 * StudyOS Tracker — perfis de site (seletores e textos de classificação).
 *
 * ÚNICO lugar onde ficam seletores CSS, padrões de texto e regras de leitura
 * de cada site. Cada dado tem uma lista de estratégias em ordem de prioridade
 * (fallback): a primeira que encontrar algo vence.
 *
 * ESTADO: hipóteses NÃO verificadas (Etapa 1). O campo `verificado` só passa
 * a true depois da comparação com páginas reais salvas pelo usuário.
 */
(function (raiz) {
  'use strict';
  const ns = (raiz.StudyOSTracker = raiz.StudyOSTracker || {});

  const TEC = {
    id: 'tec',
    nome: 'TEC Concursos',
    verificado: false,
    // Domínios atendidos (comparação por sufixo do hostname).
    dominios: ['tecconcursos.com.br'],

    seletores: {
      // Bloco que contém uma questão inteira (usado para limitar buscas).
      questao: ['.questao', '[class*="questao-container"]', 'main'],

      botaoResolver: ['.botao-resolver', 'button[class*="resolver"]', '[class*="resolver"] button'],

      alternativasLista: ['.questao-enunciado-alternativas', '[class*="alternativas"]'],
      alternativaItem: [
        '.questao-enunciado-alternativas li[role="radio"]',
        '.questao-enunciado-alternativas li',
        '[role="radiogroup"] [role="radio"]'
      ],

      // Nó inserido no DOM após responder.
      feedback: ['.questao-enunciado-mensagem-resolucao', '[class*="mensagem-resolucao"]'],

      // Ícones dentro do feedback (prioridade 2).
      iconeAcerto: ['[class*="fa-check"]', '[class*="icone-acerto"]', '[class*="icon-ok"]', '[class*="acerto"] i', '[class*="acerto"] svg'],
      iconeErro: ['[class*="fa-times"]', '[class*="fa-close"]', '[class*="fa-xmark"]', '[class*="icone-erro"]', '[class*="erro"] i', '[class*="erro"] svg'],

      // Cabeçalho da questão.
      cabecalho: ['.questao-cabecalho', '[class*="questao-cabecalho"]'],
      idLink: ['.questao-cabecalho a[href*="/questoes/"]', '[class*="questao-cabecalho"] a[href*="/questoes/"]'],
      materia: [
        '.questao-cabecalho-informacoes-materia a[href*="/materias/"]',
        '[class*="informacoes-materia"] a[href*="/materias/"]',
        '[class*="informacoes-materia"] a'
      ],
      assunto: [
        '.questao-cabecalho-informacoes-assunto-link',
        '[class*="informacoes-assunto"] a',
        '[class*="informacoes-assunto"]'
      ]
    },

    // Prioridade 1: palavras (tokens) nas classes do wrapper do feedback.
    // Classes são quebradas em tokens por "-", "_" e espaço; compara token inteiro.
    tokensClasseAcerto: ['acerto', 'acertou', 'correta', 'correto', 'certo', 'sucesso', 'success'],
    tokensClasseErro: ['erro', 'errou', 'errada', 'errado', 'incorreta', 'incorreto', 'falha', 'danger', 'error'],

    // Prioridade 3: textos (comparados sem acento e sem diferenciar maiúsculas).
    textosAcerto: ['voce acertou'],
    textosErro: ['voce errou'],

    // ID da questão.
    regexIdHref: /\/questoes\/(\d+)/,
    regexIdTexto: /#\s?(\d{4,})/,
    regexPosicao: /quest[aã]o\s+(\d+)\s+de\s+(\d+)/i,

    // Matéria: o link precisa apontar para cá.
    regexHrefMateria: /\/materias\//
  };

  ns.PERFIS = { tec: TEC };

  /** Escolhe o perfil pelo hostname (ex.: "www.tecconcursos.com.br"). */
  ns.perfilPorHost = function (host) {
    host = String(host || '').toLowerCase();
    for (const p of Object.values(ns.PERFIS)) {
      if (p.dominios.some((d) => host === d || host.endsWith('.' + d))) return p;
    }
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { PERFIS: ns.PERFIS, perfilPorHost: ns.perfilPorHost };
})(typeof globalThis !== 'undefined' ? globalThis : this);
