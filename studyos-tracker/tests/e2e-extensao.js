'use strict';
// Teste de ponta a ponta: carrega a extensão num Chromium real, serve a fixture
// SINTÉTICA spa.html no endereço do TEC (sem tocar a rede) e confere o
// diagnóstico ao vivo. Uso: npm run test:extensao
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const ext = path.join(__dirname, '..');
  const perfilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sot-'));
  const ctx = await chromium.launchPersistentContext(perfilDir, {
    headless: true, channel: 'chromium',
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext]
  });
  const externas = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://www.tecconcursos.com.br/')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(__dirname, 'fixtures', 'spa.html'), 'utf8') });
    if (!/^https?:/.test(u)) return route.continue();
    externas.push(u);
    return route.abort();
  });

  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];

  // Liga o diagnóstico pelo popup (aberto como aba).
  const popup = await ctx.newPage();
  await popup.goto('chrome-extension://' + id + '/src/popup/popup.html');
  await popup.waitForSelector('#diag:not([disabled])');
  await popup.check('#diag');
  await popup.waitForTimeout(300);

  const tec = await ctx.newPage();
  await tec.goto('https://www.tecconcursos.com.br/questoes/1001');
  await tec.waitForTimeout(800);
  await tec.click('#alt');
  await tec.click('#resolver');
  await tec.waitForTimeout(600);
  await tec.click('#proxima');
  await tec.waitForTimeout(1500);

  const diag = await ctx.newPage();
  await diag.goto('chrome-extension://' + id + '/src/paginas/diagnostico.html');
  await diag.waitForTimeout(500);
  const md = await diag.inputValue('#markdown');
  const { log } = await diag.evaluate(() => chrome.runtime.sendMessage({ tipo: 'diag:log' }));
  const tipos = log.map((e) => e.tipo);
  console.log(tipos.join(', '));

  assert.ok(tipos.includes('carregou'));
  assert.ok(tipos.includes('clique-alternativa'));
  assert.ok(tipos.includes('clique-resolver'));
  const fb = log.find((e) => e.tipo === 'feedback-inserido');
  assert.equal(fb.dados.resultado, 'erro');
  const troca = log.find((e) => e.tipo === 'questao-mudou');
  assert.deepEqual([troca.dados.de, troca.dados.para], ['1001', '1002']);
  assert.ok(tipos.includes('url-mudou'));
  assert.match(md, /Trocas de questão SEM recarregar \(SPA\): \*\*1\*\*/);
  assert.equal(new Set(log.map((e) => e.instancia)).size, 1, 'não deve ter recarregado');

  // Popup lê a página atual.
  await tec.bringToFront();
  const r = await popup.evaluate(async () => {
    const abas = await chrome.tabs.query({});
    for (const a of abas) { try { return await chrome.tabs.sendMessage(a.id, { tipo: 'diag:analisarAgora' }); } catch (e) {} }
  });
  assert.equal(r.analise.id.valor, '1002');
  assert.equal(r.analise.materia.valor, 'Português');

  // Desligar para de registrar.
  await popup.uncheck('#diag');
  await popup.waitForTimeout(300);
  const antes = log.length;
  await tec.click('#proxima');
  await tec.waitForTimeout(800);
  const depois = (await diag.evaluate(() => chrome.runtime.sendMessage({ tipo: 'diag:log' }))).log.length;
  assert.equal(depois, antes, 'diagnóstico desligado não registra');

  assert.deepEqual(externas, [], 'nenhuma requisição externa');
  await ctx.close();
  console.log('OK: e2e da extensão passou');
})().catch((e) => { console.error(e); process.exit(1); });
