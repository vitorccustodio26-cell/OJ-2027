'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PERFIS, perfilPorHost } = require('../src/perfis.js');
const n = require('../src/nucleo.js');
const P = PERFIS.tec;

test('normalizarTexto remove acentos, caixa e espaços extras', () => {
  assert.equal(n.normalizarTexto('  Você   ACERTOU! '), 'voce acertou!');
  assert.equal(n.normalizarTexto(null), '');
});

test('tokensDeClasse quebra por espaço, hífen e sublinhado', () => {
  assert.deepEqual(n.tokensDeClasse('msg-acerto foo_bar'), ['msg', 'acerto', 'foo', 'bar']);
});

test('sinalPorClasses usa token inteiro e trata ambiguidade como null', () => {
  assert.equal(n.sinalPorClasses('questao-enunciado-mensagem-resolucao mensagem-acerto', P), 'acerto');
  assert.equal(n.sinalPorClasses('alert alert-danger', P), 'erro');
  assert.equal(n.sinalPorClasses('acerto erro', P), null);
  // "certificado" não é o token "certo"; "terror" não é "erro"
  assert.equal(n.sinalPorClasses('certificado terror', P), null);
  assert.equal(n.sinalPorClasses('', P), null);
});

test('sinalPorTexto compara sem acento e sem caixa', () => {
  assert.equal(n.sinalPorTexto('VOCÊ ACERTOU!', P), 'acerto');
  assert.equal(n.sinalPorTexto('Voce errou. Gabarito: C', P), 'erro');
  assert.equal(n.sinalPorTexto('Resposta registrada', P), null);
});

test('classificarResultado respeita a prioridade classes > ícone > texto', () => {
  assert.deepEqual(n.classificarResultado({ classes: 'acerto', icone: 'erro', texto: 'erro' }), { resultado: 'acerto', fonte: 'classes', conflito: true });
  assert.deepEqual(n.classificarResultado({ classes: null, icone: 'erro', texto: 'erro' }), { resultado: 'erro', fonte: 'icone', conflito: false });
  assert.deepEqual(n.classificarResultado({ classes: null, icone: null, texto: 'acerto' }), { resultado: 'acerto', fonte: 'texto', conflito: false });
  assert.deepEqual(n.classificarResultado({ classes: null, icone: null, texto: null }), { resultado: null, fonte: null, conflito: false });
  assert.deepEqual(n.classificarResultado(undefined), { resultado: null, fonte: null, conflito: false });
});

test('perfilPorHost reconhece o TEC e ignora outros sites', () => {
  assert.equal(perfilPorHost('www.tecconcursos.com.br').id, 'tec');
  assert.equal(perfilPorHost('tecconcursos.com.br').id, 'tec');
  assert.equal(perfilPorHost('tecconcursos.com.br.evil.com'), null);
  assert.equal(perfilPorHost('example.com'), null);
});
