'use strict';
// Roda o analisador num Chromium real (DOMParser), como a página de diagnóstico faz.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SRC = ['perfis.js', 'nucleo.js', 'analisador.js', 'relatorio.js'].map((f) => path.join(__dirname, '..', 'src', f));
const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

let browser, page;
test.before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  for (const f of SRC) await page.addScriptTag({ path: f });
});
test.after(async () => { await browser.close(); });

function analisar(html, cenario) {
  return page.evaluate(([html, cenario]) => {
    const ns = globalThis.StudyOSTracker;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const a = ns.analisador.analisarDocumento(doc, ns.PERFIS.tec);
    return { a, av: ns.relatorio.avaliar(a, cenario), cru: ns.relatorio.pareceHtmlCru(a, { tamanhoTextoCorpo: doc.body.textContent.length }) };
  }, [html, cenario]);
}

test('antes de responder: hipóteses principais batem e não há feedback', async () => {
  const { a, av } = await analisar(fx('antes.html'), 'antes');
  assert.equal(a.id.valor, '1234567');
  assert.equal(a.id.estrategia, 'link do cabeçalho');
  assert.equal(a.materia.valor, 'Direito Penal');
  assert.equal(a.assunto.valor, 'Crimes contra a pessoa');
  assert.equal(a.alternativas.quantidade, 3);
  assert.equal(a.alternativas.itemComRoleRadio, true);
  assert.equal(a.feedback.presente, false);
  assert.match(av.botaoResolver, /^✔/);
  assert.match(av.feedback, /^✔/);
});

test('acerto: os três sinais concordam e a classificação vem das classes', async () => {
  const { a, av } = await analisar(fx('acerto.html'), 'acerto');
  assert.deepEqual(a.feedback.sinais, { classes: 'acerto', icone: 'acerto', texto: 'acerto' });
  assert.deepEqual(a.feedback.classificacao, { resultado: 'acerto', fonte: 'classes', conflito: false });
  assert.match(av.classificacaoFinal, /^✔/);
});

test('erro: classificado como erro', async () => {
  const { a } = await analisar(fx('erro.html'), 'erro');
  assert.equal(a.feedback.classificacao.resultado, 'erro');
});

test('fallbacks: sem classes/ícone usa o texto; ID por "Questão X de Y" é frágil; matéria não é inventada', async () => {
  const { a, av } = await analisar(fx('fallbacks.html'), 'acerto');
  assert.equal(a.feedback.classificacao.fonte, 'texto');
  assert.equal(a.feedback.classificacao.resultado, 'acerto');
  assert.equal(a.id.valor, 'pos-3-de-20');
  assert.equal(a.id.fragil, true);
  assert.equal(a.materia.valor, null);
  assert.match(av.materia, /^✘/);
});

test('HTML cru (salvo como "somente HTML") é detectado', async () => {
  const { cru } = await analisar(fx('cru.html'), 'antes');
  assert.equal(cru, true);
  const { cru: c2 } = await analisar(fx('antes.html'), 'antes');
  assert.equal(c2, false);
});

test('gerarMarkdown produz relatório sem o enunciado', async () => {
  const md = await page.evaluate((html) => {
    const ns = globalThis.StudyOSTracker;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return ns.relatorio.gerarMarkdown([{ cenario: 'erro', nomeArquivo: 'erro.html', analise: ns.analisador.analisarDocumento(doc, ns.PERFIS.tec) }], []);
  }, fx('erro.html'));
  assert.match(md, /Depois de errar/);
  assert.doesNotMatch(md, /Enunciado\./);
});
