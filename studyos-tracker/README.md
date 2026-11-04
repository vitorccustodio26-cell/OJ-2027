# StudyOS Tracker (extensão Edge/Chrome, Manifest V3)

Acompanha sessões de questões no TEC Concursos e envia os dados ao StudyOS (`../index.html`).
Uso pessoal, instalada em modo desenvolvedor. **Somente leitura**, sem servidor, sem conta, sem rede.

## Status: Etapa 1 (verificação de seletores)
Nesta etapa a extensão **não conta questões nem tempo**. Ela só verifica se consegue ler a página.

## Instalar (modo desenvolvedor)
1. Edge: `edge://extensions` (Chrome: `chrome://extensions`).
2. Ative **Modo de desenvolvedor**.
3. **Carregar sem compactação** → escolha a pasta `studyos-tracker`.
4. Se uma aba do TEC já estava aberta, recarregue-a.

## Arquitetura
| Arquivo | Papel |
|---|---|
| `src/perfis.js` | Único lugar com seletores e textos de classificação, um perfil por site, várias estratégias por dado. |
| `src/nucleo.js` | Lógica pura (sem DOM, sem APIs da extensão), testada em Node. |
| `src/analisador.js` | Leitura do DOM (somente leitura) a partir de um `Document`. |
| `src/content.js` | Roda no TEC: só lê e manda mensagens. |
| `src/background.js` | Service worker: **único** que grava estado. |
| `src/popup/`, `src/paginas/` | Só leem o estado e mandam ações. |

Permissões: `storage` e acesso apenas a `https://*.tecconcursos.com.br/*` (via content script).
A CSP das páginas da extensão tem `connect-src 'none'`: elas não conseguem fazer requisições de rede.

## Testes
```bash
npm test                 # núcleo (Node) + analisador em Chromium com fixtures
npm run test:extensao    # carrega a extensão num Chromium e testa o diagnóstico ao vivo
node tools/analisar-arquivos.js antes=a.html acerto=b.html erro=c.html repetida=d.html
```
As fixtures em `tests/fixtures/` são **sintéticas**, montadas a partir das hipóteses, não de páginas reais.
