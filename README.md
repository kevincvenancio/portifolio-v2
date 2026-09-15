# Kevin Carvalho Venancio — Portfólio

Site de portfólio pessoal. Um conceito único conduz tudo: **o site é uma descida
por camadas de um sistema**. Você não rola uma página — você atravessa um volume,
da superfície (o nome, a interface) até o substrato (infraestrutura, dados) e de
volta à superfície (contato).

A frase que sustenta o projeto: *"Tudo o que você vê se apoia em algo que você não vê."*
É o argumento de posicionamento de um desenvolvedor **backend** transformado em
estrutura de navegação.

---

## As oito camadas

| # | Seção | Profundidade | O que acontece |
|---|-------|--------------|----------------|
| 00 | Superfície | 0 m | Nome em revelação por caractere, estratos em parallax, feixe de luz no shader |
| 01 | Manifesto | 180 m | Três declarações encadeadas, controladas por scroll, uma substituindo a outra |
| 02 | Origem | 620 m | Painel de identidade fixo (sticky) ao lado do texto que corre |
| 03 | Confiança | 1240 m | O diagrama do Open Gateway se desenha enquanto você lê |
| 04 | Domínio | 2100 m | Travessia horizontal de seis projetos, com parallax interno por cartão |
| 05 | Arsenal | 3400 m | Letreiros infinitos em três velocidades + grade de competências |
| 06 | Substrato | 4600 m | Contadores que sobem ao entrar em cena |
| 07 | Superfície | 5400 m | O retorno — a paleta reaquece e o contato aparece |

### A paleta tem temperatura

O acento muda de cor com a profundidade, no shader e no HUD ao mesmo tempo
(a curva `stopT()` é duplicada em `src/modules/gl.js` e `src/main.js` — se
mexer em uma, mexa na outra):

`âmbar` (superfície) → `osso` → `azul frio` → `turquesa` (o mais fundo) → `âmbar` (retorno)

O frio se sustenta por toda a travessia dos projetos e só cede perto do fim.

---

## Camadas de profundidade (z)

Seis planos independentes compõem a sensação de volume:

1. **Campo volumétrico (WebGL)** — ruído fbm com *domain warping* que desce com
   o scroll. Sem bibliotecas 3D: um shader de tela cheia escrito à mão.
2. **Poeira (canvas 2D)** — três planos de partículas, cada um com parallax próprio.
3. **Conteúdo (DOM)** — elementos com `data-par` correm em velocidades distintas.
4. **Vinheta**, **scanlines** e **grão** — texturas fixas por cima de tudo.

Nada disso usa imagem externa. Fundo, grão, logotipo e os **diagramas de cada
projeto** são gerados em código (`src/modules/art.js`) — cada projeto ganha o
desenho do próprio sistema: fluxo de pagamento, camadas de arquitetura, órbitas
e knapsack, segmentos de JWT, dispersão com regressão, e o leque de 25 lojas.

---

## Stack

- **Vite 5** — build estático, sem framework
- **GSAP 3.15 + ScrollTrigger** — linhas do tempo presas ao scroll
- **Lenis** — scroll suave sincronizado ao ticker do GSAP
- **WebGL 1 puro** + **Canvas 2D** — nenhuma dependência 3D
- Fontes **Archivo**, **Instrument Serif** e **JetBrains Mono**, servidas
  localmente (`public/fonts/`) — sem chamada a CDN

Build de produção: **~78 KB gzip** de JS + CSS.

---

## Comandos

```bash
npm install
npm run dev       # desenvolvimento em http://127.0.0.1:5178
npm run build     # gera dist/
npm run preview   # serve dist/ em http://127.0.0.1:4178
```

### Verificação visual automatizada

```bash
node tools/verify.mjs                          # contra o dev server
node tools/verify.mjs http://127.0.0.1:4178/   # contra o build
```

Percorre o site em 5 viewports (1920, 1440, 1280, 768, 390), parando em 16
pontos do scroll, e em cada um mede:

- **scroll horizontal** no documento;
- **transbordo lateral** de qualquer elemento sem ancestral que o corte;
- **texto realmente cortado** (descendente com texto, sem transform próprio,
  escapando de uma caixa com `overflow: hidden`);
- **tela vazia** — nenhum texto de conteúdo visível no viewport;
- **erros de console** e exceções de página.

Salva as capturas em `shots/` e o relatório em `shots/report.json`.
Sai com código 0 apenas se estiver tudo limpo.

Ferramentas auxiliares: `tools/shot.mjs` (capturas rápidas),
`tools/perf.mjs` (perfil por camada), `tools/perfgpu.mjs` (medição com GPU real).

---

## Decisões que não são óbvias

- **`overflow-x: clip`, não `hidden`**, em `html, body`. `hidden` cria um
  contêiner de rolagem e quebra `position: sticky` — do qual o site inteiro depende.
- **Sem `position: pin` do ScrollTrigger.** Todas as seções travadas usam
  `position: sticky`, que não insere *pin-spacer* nem precisa de `refresh` ao
  redimensionar. Mais previsível junto com o Lenis.
- **Máscaras de revelação têm a altura exata do bloco que desliza.** Se a máscara
  for mais alta que o bloco, o texto "escondido" continua aparecendo dentro dela.
  A entrelinha folgada acomoda hastes e descidas; a margem negativa devolve o
  espaçamento visual apertado.
- **O CSS não define os `transform` iniciais que o GSAP vai animar.** Quando os
  dois definem, o deslocamento é aplicado em dobro.
- **O grão não usa `mix-blend-mode`.** `overlay` e `soft-light` estouravam em
  blocos sólidos de ruído sobre elementos com `clip-path`. O ruído é gerado
  metade escuro, metade claro, e funciona com mistura normal.
- **Tipografia limitada também pela altura do viewport** (`min(vw, vh, px)`), e o
  título de contato pela **largura do contêiner** — o `.wrap` é limitado a
  `--maxw`, então dimensionar só por `vw` estoura em telas largas.
- **Um único `gsap.ticker`** move todas as camadas de canvas. Nenhum
  `requestAnimationFrame` paralelo. O laço pausa em aba oculta.

---

## Acessibilidade e degradação

- Respeita `prefers-reduced-motion`: desliga parallax, scroll suave e animações.
- Sem WebGL, o canvas se esconde e o site segue funcionando sobre o fundo sólido.
- Sem JavaScript, todo o conteúdo continua no HTML e legível.
- Texto dividido em caracteres/palavras mantém `aria-label` no elemento original.

---

## Deploy

Saída estática em `dist/` — serve em qualquer host. Na Vercel, o preset Vite já
resolve: build `npm run build`, diretório `dist`.
