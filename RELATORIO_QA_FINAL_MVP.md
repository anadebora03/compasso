# Relatório de QA Final — Compasso v1.0.0 (Inspeção de Aprovação para Publicação)

**Tipo:** Auditoria manual read-only (QA Sênior + UX Reviewer + Product Designer). Nenhuma correção foi aplicada — este documento é exclusivamente diagnóstico.

**Metodologia:** (1) leitura integral de todas as "view functions" de `app.js` e de `style.css`/`sw.js`/`manifest.json`; (2) execução ao vivo do app num servidor estático local, com dados de exemplo e cenários vazios, incluindo fluxos reais de criar/editar/excluir registros via console/DOM; (3) três auditorias de código dedicadas (código morto, duplicações e terminologia; estrutura tela-a-tela; matriz de design system). Todos os achados citam `arquivo:linha`.

**Nota sobre screenshots:** a ferramenta de captura de tela do navegador de preview apresentou falha técnica (timeout) durante esta sessão e não pôde ser usada. Os achados abaixo foram verificados por leitura de código, inspeção de DOM renderizado e valores computados de CSS (`getComputedStyle`) em vez de captura visual — método mais preciso para medidas exatas (px, cor, opacidade), mas sem imagem anexada. Campo "Screenshot" preenchido como "Não disponível nesta sessão" em todos os itens.

**Legenda de Impacto:** 🔴 Alto · 🟠 Médio · 🟡 Baixo

---

## Sumário executivo

| Categoria | Alto | Médio | Baixo |
|---|---|---|---|
| Funcionalidade (CRUD ausente) | 1 | — | — |
| Mistura de tema (legado × Quiet Premium) | 1 | 2 | 1 |
| Terminologia inconsistente | — | 4 | 4 |
| Design System (botões/ícones/cards) | — | 3 | 5 |
| Código morto / duplicações técnicas | — | 2 | 8 |
| Acessibilidade | — | 2 | 1 |
| UX (loading/feedback) | — | 4 | 1 |

O achado de maior gravidade não é visual: **não existe edição nem exclusão individual de nenhum registro no app** (peso, aplicação, exame, compromisso, bioimpedância) — só "apagar todos os dados". Isso é uma lacuna funcional, não estética, e deveria ser resolvido antes da publicação ou conscientemente aceito como limitação conhecida da v1.0.0.

O segundo achado de maior gravidade é visual e concentrado: a tela **Premium** — a única tela nova desta fase do produto — mistura classes do tema legado (`.btn-outline`, `.badge-ico` verde) dentro de um layout Quiet Premium (navy), sendo a tela que mais evidencia "construído em fases" de todo o app.

---

## Achados Transversais (afetam múltiplas telas)

### T1 — Nenhum registro pode ser editado ou excluído individualmente
- **Tela:** Peso (Evolução/histórico), Aplicações, Exames, Agenda, Bioimpedância
- **Elemento:** Itens de lista (`.hist-item`, `.item`) em todas as telas de histórico
- **Problema encontrado:** Testei ao vivo (via `savePesagem()`) que cadastrar um novo registro funciona normalmente, mas não existe nenhuma função `editar*()`/`del*()`/`remover*()` no código para nenhum tipo de registro — confirmado por busca no arquivo inteiro. Os itens de histórico (`app.js:329` para aplicações, e equivalentes em peso/exames/agenda/bio) são `<div>` estáticos, sem `onclick`, sem gesto de swipe/long-press. A única forma de corrigir um registro errado (peso digitado errado, data errada, aplicação duplicada) é apagar **todos os dados da conta** (`resetAll()`, `app.js:1237`) e recomeçar do zero.
- **Impacto:** 🔴 Alto — é a lacuna que o próprio brief pediu para testar explicitly ("Editar. Excluir.") e ela não existe. Qualquer erro de digitação do usuário é permanente ou exige destruir todo o histórico.
- **Recomendação:** Adicionar edição/exclusão por item antes da publicação, ou documentar explicitamente como limitação conhecida da v1.0.0 (com um plano de correção para v1.0.1) — mas não deveria passar silenciosamente.
- **Screenshot:** Não disponível nesta sessão.

### T2 — Terceiro sistema de ícones/setas paralelo ao `icon()` central
- **Tela:** Onboarding, Login/Cadastro/Recuperar senha, todos os sheets, calendário de Aplicação, Relatório
- **Elemento:** `obIcon()` (`app.js:1295`), `OB_CHEV_DOWN` (`app.js:1296`), `CAL_CHEV_L`/`CAL_CHEV_R` (`app.js:1390-1391`), `AUTH_ARROW` (`app.js:2566`)
- **Problema encontrado:** Existem hoje **três** sistemas de ícone coexistindo: (1) `icon()` central (20px, stroke-width 2, 49 chamadas); (2) as quatro constantes acima (18px/16px, stroke-width 1.9), usadas em telas de auth/onboarding/calendário/voltar; (3) SVGs desenhados à mão em contextos isolados (ícone de cadeado no onboarding, `app.js:1355`). O mesmo conceito "seta para a esquerda/voltar" é desenhado de duas formas diferentes: `icon('chevron', false, true)` (espelhado via CSS) em `maisSubView` (`app.js:565`) vs. `CAL_CHEV_L` (path próprio) em `.ap-head`/`.cal-nav` (`app.js:696,918,1153,1431,1877,2556`) — visualmente quase idênticos, mas não idênticos (espessura e tamanho diferentes).
- **Impacto:** 🟠 Médio — sutil, mas é exatamente o tipo de detalhe que comunica "construído em fases" quando comparado lado a lado.
- **Recomendação:** Migrar as 4 constantes para usar `icon()` (ou documentar formalmente como uma família separada e intencional, ex. "ícones de navegação compacta").
- **Screenshot:** Não disponível nesta sessão.

### T3 — Radius "pequeno" com dois valores para o mesmo papel visual
- **Tela:** Todas (comparando componentes legado × premium)
- **Elemento:** `--r-sm:12px` (`style.css:10`, usado em `.stat`/`.medal`) vs. `--rd-sm:14px` (`style.css:32`, usado em `.glass-field .field-wrap`/`.csel-panel`/`.badge-glow`/`.mood-btn`)
- **Problema encontrado:** O "raio pequeno" do design system tem dois valores diferentes para telas legado vs. premium — exatamente o tipo de exemplo citado no brief ("dois tons/raios para o mesmo papel").
- **Impacto:** 🟡 Baixo — dificilmente perceptível isoladamente, mas contribui para a sensação de inconsistência ao navegar entre telas legado e premium.
- **Recomendação:** Documentar como diferença intencional entre temas (já existe precedente disso no projeto) ou unificar numa sprint de design system dedicada.
- **Screenshot:** Não disponível nesta sessão.

### T4 — Transições CSS fora do sistema de tokens `--dur-*`
- **Tela:** Diário (chips/botões), Proteína (ovos), Relatório (chip de período antigo, hoje morto), Bioimpedância (mapa corporal)
- **Elemento:** `.btn`/`.chip`/`.bmzone`/`.psq`/`.egg`/`.protcard .between svg`/`.pen>span`/`.pen2>span` (`style.css:172,184,218,334,338,343,157,212`)
- **Problema encontrado:** Depois da unificação de `--dur-fast`(.15s)/`--dur-base`(.25s)/`--ease-out` nos componentes premium mais recentes, sobraram pelo menos 6 valores de transição diferentes (.12s, .15s×4, .2s, .3s, .5s×2) cravados sem referenciar nenhum token — alguns coincidem numericamente com `--dur-fast` mas por acaso, não por referência.
- **Impacto:** 🟡 Baixo — imperceptível isoladamente, mas é dívida técnica real de uma migração incompleta.
- **Recomendação:** Trocar os valores literais pelos tokens correspondentes numa sprint futura de polimento (baixo risco, mudança só de CSS).
- **Screenshot:** Não disponível nesta sessão.

### T5 — Terminologia: mesmo recurso, nomes diferentes em cada tela
- **Tela:** Mais (hub), Timeline, Insights, Relatórios, Plano de ação
- **Elemento:** Rótulos de menu/título/benefício
- **Problema encontrado:**
  - **Plano de Ação (Title Case)** ainda aparece em `app.js:672` (`titulo:'Plano de Ação personalizado'`) e `app.js:693` (lista de benefícios Premium), enquanto o menu (`app.js:531`) e o título da tela (`app.js:640`) já usam "Plano de ação" (sentence case) — corrigidos numa sprint anterior, mas o texto de marketing da tela Premium ficou para trás.
  - **"Linha do tempo"** (menu, título da tela) vs. **"Timeline Inteligente"** (benefício Premium, `app.js:670,693`) — mesmo recurso, um nome em português e outro em inglês.
  - **Relatório**: "Relatório de Evolução" (menu, `app.js:540`) vs. "Relatórios" (cabeçalho da própria tela, `app.js:1878`) vs. "Relatórios em PDF" (benefício Premium) vs. "Relatório de evolução" (capa do PDF, `app.js:2322`, sentence case) vs. "Relatório" (`<title>` do PDF, `app.js:2176`, singular sem "de Evolução") — cinco variações para o mesmo recurso.
  - **"Insights"** (título da tela) vs. **"Insights automáticos"** (card de gate Premium na Home e benefício Premium).
- **Impacto:** 🟠 Médio — usuário que navega entre Home/Mais/Premium/PDF vê o mesmo recurso com nomes diferentes, quebrando a sensação de app unificado.
- **Recomendação:** Escolher um nome canônico por recurso e aplicá-lo em menu, título de tela, benefício Premium e PDF.
- **Screenshot:** Não disponível nesta sessão.

### T6 — Verbo de criação de registro sem padrão (Novo/Nova × Registrar × Adicionar)
- **Tela:** Aplicação, Evolução (Peso), Exames, Agenda, Bioimpedância
- **Elemento:** Título dos sheets (`<h2>`) vs. botão que os abre
- **Problema encontrado:** Cinco tipos de registro, três verbos diferentes sem padrão aparente: "Nova aplicação" (sheet, `app.js:919`) vs. botão "Registrar aplicação" (`app.js:307`); "Nova pesagem" (sheet e botão, consistente); "Adicionar exame" (sheet, `app.js:969`) vs. botão "Adicionar resultado" (`app.js:813`) — único que foge do padrão "Novo(a) X"; "Nova bioimpedância" (sheet) vs. "Registrar bioimpedância" (botão no estado vazio, `app.js:1802`) vs. "Nova medição" (botão no estado normal, `app.js:1822`) — o mesmo botão muda de nome dependendo se há ou não dados.
- **Impacto:** 🟠 Médio — o próprio brief cita esse exato tipo de inconsistência como exemplo a ser eliminado.
- **Recomendação:** Padronizar em "Novo(a) [registro]" para o título do sheet e "Registrar [registro]" para o botão que o abre, em todas as 5 telas.
- **Screenshot:** Não disponível nesta sessão.

### T7 — Mesmo botão ("Caneta") com três rótulos diferentes
- **Tela:** Início, Aplicação
- **Elemento:** Botão que abre `openSheet('caneta')`
- **Problema encontrado:** Mesmíssima ação, três textos: "Gerir" (Início, `app.js:249`), "Editar" (Aplicação, quando já há caneta, `app.js:317`), "Configurar caneta" (Aplicação, quando não há caneta ainda, `app.js:324`). O terceiro caso é aceitável (estado diferente = call-to-action diferente), mas "Gerir" vs. "Editar" para o mesmo estado em duas telas é inconsistência pura.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Unificar "Gerir" e "Editar" num só termo.
- **Screenshot:** Não disponível nesta sessão.

### T8 — "Meta" / "Alvo" / "Objetivo" para o mesmo conceito na mesma tela
- **Tela:** Calculadora
- **Elemento:** `calcView()`, array `targets` e rótulos
- **Problema encontrado:** `app.js:793` chama a linha de "Sua meta"; `app.js:799` fala em "objetivo" no subtítulo; `app.js:803` rotula cada item da lista como "Alvo: X kg" — três palavras para o mesmo conceito dentro da mesma tela, enquanto o resto do app usa consistentemente "meta" (`app.js:232,368`).
- **Impacto:** 🟡 Baixo
- **Recomendação:** Padronizar em "meta" (termo já dominante no restante do app).
- **Screenshot:** Não disponível nesta sessão.

### T9 — "Apagar" vs. "Remove" na mesma linha de UI
- **Tela:** Configurações → Dados
- **Elemento:** Item "Apagar todos os dados" (`app.js:1058`)
- **Problema encontrado:** O título do botão usa "Apagar" e a descrição logo abaixo usa "Remove" — dois verbos para a mesma ação, lado a lado.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Usar o mesmo verbo nas duas linhas.
- **Screenshot:** Não disponível nesta sessão.

### T10 — Ícone de sino usado para abrir Configurações
- **Tela:** Todas as telas com topbar (Início/Aplicação/Evolução/Mais)
- **Elemento:** `<button class="badge-ico" onclick="openSheet('perfil')" aria-label="Configurações">${icon('bell')}</button>` (`app.js:182`)
- **Problema encontrado:** O botão que abre Configurações/Perfil usa o ícone de sino (notificação), não um ícone de engrenagem/perfil. O `aria-label` diz "Configurações", mas o desenho sugere "notificações" — o mesmo ícone de sino é usado corretamente em Configurações → Notificações (`app.js:1095`) para o conceito certo, reforçando que na topbar ele está emprestado do lugar errado.
- **Impacto:** 🟠 Médio — é um ícone de topbar visto em praticamente toda tela do app; usuários podem tocar esperando uma lista de notificações e cair em Configurações.
- **Recomendação:** Trocar por um ícone de engrenagem/perfil.
- **Screenshot:** Não disponível nesta sessão.

### T11 — Sem estado de foco (`:focus-visible`) em nenhum botão
- **Tela:** Todas
- **Elemento:** `.btn`, `.btn-pill`, `.mais-item`, `.chip` e demais botões
- **Problema encontrado:** `style.css` define `:active` para vários componentes (`.btn:active`, `.btn-pill:active`, `.chip:active`, `.mais-item:active` etc.) mas nenhum `:focus`/`:focus-visible` para botões — só inputs de formulário (`.field input:focus`, `.glass-field .field-wrap:focus-within`) têm estado de foco definido. Navegação por teclado (Tab) em qualquer botão do app cai no outline padrão do navegador (inconsistente com o resto do design system) ou pode ficar invisível dependendo do navegador/SO.
- **Impacto:** 🟠 Médio — acessibilidade via teclado, relevante para aprovação de loja e para usuários com leitor de tela/navegação assistida.
- **Recomendação:** Adicionar `:focus-visible` consistente aos componentes de botão.
- **Screenshot:** Não disponível nesta sessão.

### T12 — Ações assíncronas sem feedback de carregamento
- **Tela:** Evolução (upload de foto), Relatórios, Configurações
- **Elemento:** `savePesagem()` (`app.js:1190`), `gerarRelatorio()` (`app.js:2478`), `ativarNotificacoes()` (`app.js:1106`), `doLogout()`
- **Problema encontrado:** Diferente do fluxo de autenticação (que usa `withAuthBtn()` consistentemente, desabilitando o botão e trocando o texto), estas quatro ações assíncronas não desabilitam o botão nem mostram spinner: `savePesagem()` mostra um `toast('Processando foto…')` mas o botão "Salvar pesagem" continua clicável durante o processamento; `gerarRelatorio()` mostra `toast('Gerando relatório…')` sem desabilitar "Gerar relatório em PDF" (múltiplos cliques são possíveis); `ativarNotificacoes()` não mostra nada enquanto aguarda a permissão do navegador; `doLogout()` idem.
- **Impacto:** 🟠 Médio — não impede o uso, mas permite duplo-clique/múltiplos disparos e destoa do padrão de loading já estabelecido no fluxo de auth.
- **Recomendação:** Reaproveitar o padrão `withAuthBtn()` (ou equivalente) nessas quatro funções.
- **Screenshot:** Não disponível nesta sessão.

### T13 — CSS morto herdado de telas/versões anteriores
- **Tela:** N/A (código, sem tela associada hoje)
- **Elemento:** `.bodyline` (`style.css:221`), `.btn-amber` (`style.css:175`), `a.linkish` (`style.css:371`), bloco `.nav-glass*` (`style.css:546-552`), `.periodo-btn*` (`style.css:352-356`), bloco `.pdf-overlay/.pdf-topbar/.pdf-scroll/.pdf-page/.pdf-actions/.pdf-share/.pdf-save/.pdf-close` (`style.css:357-366`), `.progress-dots*` (`style.css:523-525`), `.stat.good`/`.stat.warn` (`style.css:163-164`)
- **Problema encontrado:** Nenhuma dessas classes é referenciada em `app.js`. Destaque especial para o bloco `.pdf-*` (8 classes) — é o CSS completo de uma versão anterior do preview de PDF **dentro do próprio app** (overlay full-screen com topbar/scroll/ações), que foi substituída por abrir uma aba nova do navegador (`mostrarPreview()`, `app.js:2471`) sem remover o CSS antigo. Também há uma segunda implementação inteira e não utilizada da bottom nav premium (`.nav-glass`), concorrente com a `.nav` realmente usada.
- **Impacto:** 🟡 Baixo (não afeta o usuário final, mas é peso morto no bundle e confunde quem for manter o CSS)
- **Recomendação:** Remover as 9 classes/blocos mortos confirmados.
- **Screenshot:** Não disponível nesta sessão.

### T14 — Dados duplicados manualmente em vez de derivados de uma fonte única
- **Tela:** Evolução (Medidas), Bioimpedância, Diário, e o PDF de relatório
- **Elemento:** `BIOM` (`app.js:1786` vs. `app.js:2134`), `measures` (`app.js:396` vs. `app.js:2108`, **em ordem diferente**: cintura/quadril/abdômen/coxa/braço na tela vs. cintura/abdômen/quadril/braço/coxa no PDF), `SINTOMAS` (`app.js:449`) vs. `sintomasTodos` (`app.js:2060`, mesma lista sem "Sem sintomas", copiada à mão em vez de derivada por `.filter()`)
- **Problema encontrado:** As mesmas listas de indicadores/medidas/sintomas existem em dois formatos/lugares diferentes no arquivo. A ordem das medidas corporais diverge entre a tela Evolução e o PDF — um usuário que compara os dois pode notar que "Quadril" aparece antes de "Abdômen" num lugar e depois no outro.
- **Impacto:** 🟡 Baixo isoladamente, mas é risco de manutenção (mudar uma lista sem lembrar de mudar a outra) e a diferença de ordem é um detalhe real de inconsistência visível.
- **Recomendação:** Unificar numa única fonte de dados por lista.
- **Screenshot:** Não disponível nesta sessão.

---

## Achados por Tela

### Login
- **Tela:** Login
- **Elemento:** Botão "Criar conta" (`app.js:2584`) e, na tela de Cadastro, "Entrar" (`app.js:2607`)
- **Problema encontrado:** São `<button>` sem nenhuma classe, estilizados 100% via `style="color:...;background:none;border:none;padding:0;...cursor:pointer"` inline — funcionam como link, mas não usam nenhuma classe utilitária reaproveitável (ex. `.link-more`, já existente e usado em Início/Relatório).
- **Impacto:** 🟡 Baixo
- **Recomendação:** Extrair para uma classe reaproveitável.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Login
- **Elemento:** Botão voltar (`.cal-nav`, `app.js:2556`)
- **Problema encontrado:** Reaproveita `.cal-nav` (nome derivado de "navegação de calendário") como botão de "voltar" genérico em telas de auth — funciona, mas o nome da classe não corresponde ao papel semântico aqui.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Nenhuma ação obrigatória — documentar como reaproveitamento intencional de componente.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Login / Cadastro / Recuperar senha / Nova senha
- **Elemento:** Estado de carregamento dos botões de submit
- **Problema encontrado:** Nenhum problema — conferido ao vivo que `withAuthBtn()` desabilita o botão e troca o texto para "Entrando…"/"Criando conta…"/"Enviando…"/"Salvando…" de forma consistente nas 4 telas.
- **Impacto:** — (ponto positivo, não é um problema)
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Cadastro
- **Tela:** Cadastro
- **Elemento:** Validações (`doSignUp()`, `app.js:2671`)
- **Problema encontrado:** Nenhum problema encontrado — e-mail, tamanho mínimo de senha e confirmação de senha são validados com mensagens claras via `toast()`.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Onboarding
- **Tela:** Onboarding (`obView`, `app.js:1320`)
- **Elemento:** Botões "Começar minha jornada" / "Ver com dados de exemplo" (`app.js:1350,1354`)
- **Problema encontrado:** `startNew()`/`startExample()` não mostram nenhum feedback de carregamento — irrelevante na prática (são só gravações em `localStorage`, instantâneas), mas quebra o padrão visual de "todo botão de submit importante troca de estado" visto no fluxo de auth logo antes dele.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Nenhuma ação obrigatória.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Onboarding
- **Elemento:** Ícone de cadeado (`app.js:1355`)
- **Problema encontrado:** SVG desenhado à mão diretamente no template, sem passar por nenhum helper de ícone (nem `icon()`, nem `obIcon()`) — um quarto padrão isolado de ícone, usado uma única vez.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Nenhuma ação obrigatória (uso único, baixo risco).
- **Screenshot:** Não disponível nesta sessão.

### Home (Início)
- **Tela:** Início
- **Elemento:** Tela inteira
- **Problema encontrado:** É a **única tela-aba do app sem `.scr-title`/`.scr-sub`** — a tela abre direto no card `.hero`, sem nenhum título textual de tela. Todas as demais 14 telas cheias têm título padrão.
- **Impacto:** 🟡 Baixo — decisão de design plausivelmente intencional (a Home tem o próprio "hero" como identidade visual), mas é uma omissão real e sem exceção documentada no código.
- **Recomendação:** Confirmar se é intencional; se sim, documentar como exceção deliberada.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Início
- **Elemento:** Card "Caneta atual" (condicional a `pen` existir, `app.js:244`)
- **Problema encontrado:** Se o usuário não configurou a caneta, o card simplesmente não aparece — sem nenhuma mensagem/CTA. Isso contrasta com a tela Aplicação, que mostra um prompt explícito ("Configure sua caneta para acompanhar quantas aplicações restam" + botão) para o mesmo cenário.
- **Impacto:** 🟠 Médio — usuário novo pode nem perceber que existe uma funcionalidade de controle de caneta, já que ela só aparece depois de configurada.
- **Recomendação:** Adicionar o mesmo prompt já usado em Aplicação.
- **Screenshot:** Não disponível nesta sessão.

### Peso (parte de Evolução + sheet "pesar")
- **Tela:** Evolução → Peso / sheet "Nova pesagem"
- **Elemento:** CRUD completo
- **Problema encontrado:** Ver achado transversal **T1** — cadastro funciona (testado ao vivo com sucesso), edição e exclusão individuais não existem.
- **Impacto:** 🔴 Alto (já contabilizado em T1)
- **Recomendação:** Ver T1.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Evolução → Peso
- **Elemento:** Gráfico (`lineChartPremium`)
- **Problema encontrado:** Nenhum problema — empty state dedicado e correto ("Registre mais de uma pesagem para ver o gráfico.") quando há menos de 2 pesagens, testado ao vivo.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Sheet "Nova pesagem"
- **Elemento:** Upload de foto de progresso
- **Problema encontrado:** Ver achado transversal **T12** — `toast('Processando foto…')` existe, mas o botão "Salvar pesagem" não é desabilitado durante o processamento.
- **Impacto:** 🟠 Médio (já contabilizado em T12)
- **Recomendação:** Ver T12.
- **Screenshot:** Não disponível nesta sessão.

### Aplicações
- **Tela:** Aplicação
- **Elemento:** Histórico de aplicações, CRUD
- **Problema encontrado:** Ver achado transversal **T1** — mesmo cenário do Peso: cadastro funciona, sem edição/exclusão individual.
- **Impacto:** 🔴 Alto (já contabilizado em T1)
- **Recomendação:** Ver T1.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Aplicação
- **Elemento:** Empty states (histórico vazio, caneta não configurada)
- **Problema encontrado:** Nenhum problema — ambos os empty states existem e são claros, testado ao vivo com dados zerados.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Evolução (geral — abas Peso/IMC/Medidas/Fotos)
- **Tela:** Evolução → Medidas
- **Elemento:** Ordem de exibição das medidas corporais
- **Problema encontrado:** Ver achado transversal **T14** — ordem diverge do PDF (cintura/quadril/abdômen/coxa/braço vs. cintura/abdômen/quadril/braço/coxa).
- **Impacto:** 🟡 Baixo (já contabilizado em T14)
- **Recomendação:** Ver T14.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Evolução → Fotos
- **Elemento:** Empty state
- **Problema encontrado:** Nenhum problema — mensagem clara ("Nenhuma foto ainda. Uma foto por mês já mostra bastante diferença.").
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Timeline (Linha do tempo)
- **Tela:** Linha do tempo
- **Elemento:** Empty state e comportamento com dados reais
- **Problema encontrado:** Testado ao vivo com conta zerada (perfil recém-criado, sem nenhum registro): a tela mostra corretamente apenas "Início do tratamento" — sem falsos insights ou conquistas prematuras. Empty state textual dedicado existe para quando não há nem isso. Nenhum problema encontrado.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Linha do tempo
- **Elemento:** Nome do recurso
- **Problema encontrado:** Ver achado transversal **T5** ("Linha do tempo" vs. "Timeline Inteligente").
- **Impacto:** 🟠 Médio (já contabilizado em T5)
- **Recomendação:** Ver T5.
- **Screenshot:** Não disponível nesta sessão.

### Insights
- **Tela:** Insights
- **Elemento:** Empty state
- **Problema encontrado:** Testado ao vivo com conta recém-criada (zero dados, `dataInicio` = hoje): mostra corretamente "Registre alguns dias no diário para começarmos a encontrar padrões." Nenhum problema encontrado nesse fluxo.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Insights
- **Elemento:** Card fixo "Seu tratamento é conduzido por profissionais" (`careCard`)
- **Problema encontrado:** Usa `class="card" style="border:1.5px solid var(--green)"` — cor de borda cravada via token, mas a classe base `.card` já é do tema legado; não é uma mistura de tema, é reforço redundante de estilo inline sobre uma classe que já resolveria isso.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Mover a borda para uma variante de classe, se for um padrão repetido.
- **Screenshot:** Não disponível nesta sessão.

### Plano de ação
- **Tela:** Plano de ação
- **Elemento:** Empty state
- **Problema encontrado:** Testado ao vivo com conta recém-criada: mostra corretamente "Nenhuma ação pendente no momento — tudo em dia." Nenhum problema.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Plano de ação
- **Elemento:** Botão "Avançar" status
- **Problema encontrado:** Nenhum problema — `avancarStatusAcao()` é síncrono e local, sem necessidade real de loading state.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Relatórios
- **Tela:** Relatórios
- **Elemento:** Botão "Gerar relatório em PDF"
- **Problema encontrado:** Ver achado transversal **T12** — toast existe, botão não desabilita.
- **Impacto:** 🟠 Médio (já contabilizado em T12)
- **Recomendação:** Ver T12.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Relatórios
- **Elemento:** Nome do recurso em 5 lugares diferentes
- **Problema encontrado:** Ver achado transversal **T5**.
- **Impacto:** 🟠 Médio (já contabilizado em T5)
- **Recomendação:** Ver T5.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Relatórios (documento PDF gerado)
- **Elemento:** Paleta de cores do PDF (`buildPDF()`, `app.js:2177`)
- **Problema encontrado:** O PDF gerado é um documento HTML autônomo com seu próprio bloco `<style>` e tokens de cor completamente separados (`--navy:#16294A`, `--blue:#2E6FC9` etc., diversos `rgba()` cravados) — não reaproveita nenhum `var(--token)` do app principal. Também redesenha a logo (`app.js:2314`) e o ícone de "sparkle" à mão em vez de chamar `logoSVG()`/`icon()`.
- **Impacto:** 🟡 Baixo — o PDF abre numa aba separada, então não há colisão visual direta com o app, mas é um sistema de cores paralelo e completo que pode divergir sutilmente da paleta oficial ao longo do tempo.
- **Recomendação:** Nenhuma ação obrigatória para a v1.0.0 (documento isolado); considerar migrar para os tokens do app numa sprint futura.
- **Screenshot:** Não disponível nesta sessão.

### Premium
- **Tela:** Premium
- **Elemento:** Botões "Assinar plano mensal" (`app.js:724`) e "Restaurar compra" (`app.js:727`)
- **Problema encontrado:** Usam `class="btn btn-outline btn-block"` — família de botão do tema **legado** (`border:1.5px solid var(--line); color:var(--ink)`, tokens de cor clara) dentro de uma tela marcada como Quiet Premium (`TAB==='premium'` está em `premiumScreen`, `app.js:159`). O restante da tela usa corretamente `.btn-pill`. Esses dois botões devem renderizar com cores/bordas do tema claro sobre o fundo navy da tela.
- **Impacto:** 🔴 Alto — é a tela mais nova do produto (o "produto" que está sendo vendido) e o achado mais visível de "construído em fases" de todo o app; um QA/App Reviewer notaria isso imediatamente.
- **Recomendação:** Trocar para `.btn-pill.ghost.neutral` (ou variante equivalente já usada em outras telas premium, ex. login).
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Premium
- **Elemento:** Badge de status do plano atual (`app.js:704`)
- **Problema encontrado:** `class="badge-ico ${status==='active'?'':'amber'}"` — quando o status é `'active'`, renderiza `.badge-ico` **sem modificador**, ou seja, o badge verde do tema legado (`var(--green-soft)/var(--green-deep)`) dentro da tela navy.
- **Impacto:** 🟠 Médio
- **Recomendação:** Criar uma variante de badge com cor de sucesso do tema premium (ex. `--accent`) em vez de reaproveitar o verde legado.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Premium
- **Elemento:** Cabeçalho da tela (`.ap-head`/`.ap-title`, `app.js:696-698`)
- **Problema encontrado:** Usa o mesmo componente de cabeçalho do sheet "Nova aplicação" (nomeado com o prefixo `ap-`, de "Aplicação"), em vez do `.scr-title` que as demais telas premium por aba (Início/Aplicação/Evolução/Mais) usam.
- **Impacto:** 🟡 Baixo — funciona visualmente, mas é reaproveitamento de um componente batizado para outro contexto.
- **Recomendação:** Nenhuma ação obrigatória — documentar como reaproveitamento intencional (mesmo padrão de cabeçalho "com botão voltar circular" já usado em Relatórios).
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Premium
- **Elemento:** Badge "MAIS POPULAR" (`app.js:713`)
- **Problema encontrado:** `color:#fff` cravado inline em vez de `var(--tx-1)`.
- **Impacto:** 🟡 Baixo (mesmo valor final, só não usa o token)
- **Recomendação:** Trocar por `var(--tx-1)`.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Premium
- **Elemento:** Espaçamento entre cards, feedback do botão "Restaurar compra"
- **Problema encontrado:** Nenhum problema — `margin-bottom` dos 4 cards já uniformizado (14px) e o botão troca corretamente para "Validando…" durante `LICENSE.refresh()` (confirmado no código e ao vivo).
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Configurações
- **Tela:** Configurações
- **Elemento:** Cabeçalho da sheet (`<h2>Configurações</h2><p class="sub">`, `app.js:1119`) + `<div class="grab">` (`app.js:1118`)
- **Problema encontrado:** A sheet é tratada como premium (`SHEET==='perfil'` está na lista de sheets premium, `app.js:894`), mas usa o padrão de cabeçalho `<h2>/.sub` das sheets **legadas** (as demais sheets premium, como "aplicar", usam `.ap-head`/`.ap-title`). O `.grab` (alça de arrastar) também usa `var(--line)`, token de cor do tema claro, dentro do sheet navy.
- **Impacto:** 🟠 Médio — é a tela de configurações, visitada com frequência; a alça de arrastar clara sobre fundo navy é um detalhe visualmente perceptível.
- **Recomendação:** Ajustar a cor do `.grab` para um tom navy quando dentro de `.sheet-glass`, e avaliar padronizar o cabeçalho.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Configurações
- **Elemento:** Rodapé com versão
- **Problema encontrado:** Nenhum problema — "Compasso v1.0.0" exibido com contraste correto (`var(--tx-3)` sobre fundo navy, confirmado por `getComputedStyle`).
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

- **Tela:** Configurações → Dados
- **Elemento:** "Sair da conta" / "Apagar todos os dados"
- **Problema encontrado:** Ver achado transversal **T9** (inconsistência "Apagar" vs. "Remove") e **T12** (`doLogout()` sem loading state).
- **Impacto:** 🟡 Baixo / 🟠 Médio (já contabilizados)
- **Recomendação:** Ver T9/T12.
- **Screenshot:** Não disponível nesta sessão.

### Bottom Sheets (geral)
- **Tela:** Todos os 8 sheets (`menuadd`, `aplicar`, `pesar`, `caneta`, `exame`, `compromisso`, `bio`, `perfil`)
- **Elemento:** Abertura/animação/handle/altura/paddings/botões
- **Problema encontrado:** Nenhuma mistura de tema dentro de nenhuma sheet individual (cada uma usa consistentemente ou só classes legado ou só premium). Animação de abertura uniformizada (`.3s var(--ease-out)`) tanto em `.sheet` quanto `.sheet-glass`. Duas inconsistências estruturais: (1) a sheet "aplicar" é a única com cabeçalho `.ap-head` em vez de `<h2>/.sub`; (2) a sheet "perfil", apesar de marcada premium, usa o cabeçalho `<h2>/.sub` legado (ver achado específico de Configurações acima).
- **Impacto:** 🟡 Baixo (estrutural, não quebra nada)
- **Recomendação:** Nenhuma ação obrigatória além do já listado para Configurações.
- **Screenshot:** Não disponível nesta sessão.

### Modais
- **Tela:** N/A
- **Elemento:** N/A
- **Problema encontrado:** O app não tem modais centralizados (dialog no meio da tela) — todas as interações de sobreposição são bottom sheets ou o `confirm()` nativo do navegador (usado por `resetAll()`, `app.js:1238`). O uso de `confirm()` nativo para uma ação tão destrutiva ("apagar todos os dados") usa a caixa de diálogo do sistema operacional, com aparência totalmente fora do design system do app.
- **Impacto:** 🟠 Médio — é a única confirmação de ação destrutiva do app inteiro e não tem nenhuma identidade visual do Compasso.
- **Recomendação:** Substituir por uma confirmação em sheet, consistente com o resto do app.
- **Screenshot:** Não disponível nesta sessão.

### Toasts
- **Tela:** Global (`toast()`, `app.js:59`)
- **Elemento:** Duração da transição de saída
- **Problema encontrado:** Implementação única e centralizada (`toast()`), portanto visualmente consistente em todo o app — mas a transição de saída é `t.style.transition='.3s'` (JS inline, `app.js:61`), não referenciando `--dur-base`(.25s) nem nenhum outro token, e diverge por 50ms do valor mais próximo do sistema.
- **Impacto:** 🟡 Baixo
- **Recomendação:** Nenhuma ação obrigatória (diferença imperceptível); mencionar na dívida técnica de animação (ver T4).
- **Screenshot:** Não disponível nesta sessão.

### Empty States (consolidado)
- **Tela:** Insights, Plano de ação, Timeline, Aplicações, Exames, Agenda, Bioimpedância, Evolução (gráfico e medidas)
- **Elemento:** Mensagens de estado vazio
- **Problema encontrado:** Testados ao vivo com conta zerada — todos presentes e com texto específico ao contexto (nenhum genérico tipo "Nenhum dado"). Nenhum problema encontrado nesta categoria.
- **Impacto:** —
- **Recomendação:** Nenhuma.
- **Screenshot:** Não disponível nesta sessão.

### Loadings (consolidado)
- **Tela:** Ver T12
- **Elemento:** Ver T12
- **Problema encontrado:** Ver T12 — 4 pontos assíncronos sem feedback visual de carregamento, contra um padrão bem estabelecido (`withAuthBtn()`) já usado em outras 4 telas.
- **Impacto:** 🟠 Médio (já contabilizado em T12)
- **Recomendação:** Ver T12.
- **Screenshot:** Não disponível nesta sessão.

---

## Auditoria de Design System — resumo da matriz

(Detalhamento completo por componente disponível na auditoria de origem; resumo dos pontos acionáveis abaixo.)

| Componente | Situação |
|---|---|
| Botões | 2 famílias (`.btn*` legado / `.btn-pill*` premium) usadas corretamente na esmagadora maioria das telas — única exceção confirmada é a tela **Premium** (ver achado específico). 3 botões sem nenhuma classe (FAB de registrar, 2 links de auth). |
| Cards | `.card` (legado) e `.gcard` (premium) nunca se misturam numa mesma tela. `.glass-card` é uma terceira variante usada só no fluxo pré-login. |
| Inputs | `.field` (legado) e `.glass-field` (premium) nunca se misturam dentro do mesmo sheet — ponto positivo. |
| Títulos | `.scr-title`/`.scr-sub` usado consistentemente, exceto Início (sem título) e Premium (usa `.ap-title` em vez de `.scr-title`). |
| Ícones | Sistema central `icon()` (49 usos) + 3 sistemas paralelos menores (ver T2). |
| Sheets | Nenhuma mistura interna; 2 inconsistências estruturais de cabeçalho (sheets "aplicar" e "perfil", ver achados específicos). |
| Badges | `.badge-ico.rose` tem semântica 100% consistente (sempre "prioridade alta/negativo"); `.badge-ico.amber` tem semântica variável dependendo da tela (às vezes "atenção", às vezes puramente decorativo, às vezes "pendente/futuro") — vale revisão. |
| Gráficos | `lineChart()` (legado) e `lineChartPremium()` (premium) sempre usados na tela certa para seu tema — nenhuma inconsistência encontrada. |

---

## Conclusão

O Compasso está, em geral, **bem mais maduro do que um MVP em fases costuma estar** nesta altura — a grande maioria das telas (13 de 15 telas cheias, todos os 8 sheets, os 4 fluxos de autenticação) está internamente consistente dentro do seu próprio tema, com empty states e mensagens bem escritas. Os problemas reais que esta auditoria encontrou são, em ordem de gravidade:

1. Ausência de edição/exclusão individual de registros (funcional, não visual) — **T1**.
2. A tela Premium mistura classes legado/premium de forma visível — achado mais crítico de UI.
3. Um conjunto de inconsistências de terminologia (nomes diferentes para o mesmo recurso entre menu/tela/benefício Premium/PDF).
4. Débito técnico real, mas de baixo risco: CSS morto, ícones duplicados, tokens divergentes, dados duplicados manualmente — nada disso é visível ao usuário final, mas afeta manutenibilidade.

Nenhuma correção foi aplicada. Esta é a base para a próxima decisão do time: o que entra na v1.0.0 e o que fica documentado para v1.0.1.
