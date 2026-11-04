'use strict';
// Analisa páginas salvas do TEC com o MESMO código da página de diagnóstico.
// Uso: node tools/analisar-arquivos.js antes=arq1.html acerto=arq2.html erro=arq3.html repetida=arq4.html
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const pares = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return i > 0 ? [a.slice(0, i), a.slice(i + 1)] : ['outro', a]; });
  if (!pares.length) { console.error('Uso: node tools/analisar-arquivos.js antes=arq.html acerto=arq.html ...'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', (r) => r.abort()); // nada sai para a rede
  await page.setContent('<html><body></body></html>');
  for (const f of ['perfis.js', 'nucleo.js', 'analisador.js', 'relatorio.js']) await page.addScriptTag({ path: path.join(__dirname, '..', 'src', f) });
  const entradas = pares.map(([cenario, arq]) => ({ cenario, nomeArquivo: path.basename(arq), html: fs.readFileSync(arq, 'utf8') }));
  const md = await page.evaluate((entradas) => {
    const ns = globalThis.StudyOSTracker;
    const itens = entradas.map((e) => {
      const doc = new DOMParser().parseFromString(e.html, 'text/html');
      return { cenario: e.cenario, nomeArquivo: e.nomeArquivo, meta: { tamanhoTextoCorpo: doc.body ? doc.body.textContent.length : 0 }, analise: ns.analisador.analisarDocumento(doc, ns.PERFIS.tec) };
    });
    return ns.relatorio.gerarMarkdown(itens, []);
  }, entradas);
  console.log(md);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
