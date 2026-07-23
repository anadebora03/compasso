# Compasso — Release Checklist (v1.0.0 Release Candidate)

Checklist de publicação do Compasso, montado ao final do Sprint R a partir de três auditorias
completas do código (tipografia/copy, ícones/espaçamento/bordas/sombras, assets/animações/
manifest/versionamento) mais verificação manual dos pontos de segurança e versionamento.

## Identidade

- [x] Nome do app consistente em todo lugar: `manifest.json` (`name`/`short_name`), `index.html`
      (`<title>`, `apple-mobile-web-app-title`), rodapé de Configurações — todos "Compasso".
- [x] Ícones: 192×192 e 512×512, cada um com par `maskable` (`icons/icon-*.png`,
      `icons/icon-*-maskable.png`), mais `favicon-32`/`favicon-16`/`favicon.ico`/
      `apple-touch-icon.png`. Nenhum ícone órfão ou duplicado encontrado na auditoria.
- [x] Splash/tema: `theme_color`/`background_color` do `manifest.json` e o
      `<meta name="theme-color">` do `index.html` alinhados com a paleta navy real da tela de
      boas-vindas (`#0B1526`/`#0F1D35`) desde a Sprint Q — sem mais o flash verde/bege antigo.
- [x] `manifest.json`: campos essenciais presentes (`id`, `name`, `short_name`, `description`,
      `start_url`, `scope`, `display`, `orientation`, `icons`). Campos opcionais como
      `screenshots`/`shortcuts` foram deliberadamente **não adicionados** nesta sprint — exigiriam
      capturas de tela reais ou novos pontos de entrada, fora do escopo de "sem funcionalidade
      nova".

## Técnica

- [x] Service Worker (`sw.js`): cache do app shell + funcionamento offline básico, sem
      dependências externas, sem build step.
- [x] `CACHE_VERSION` alinhado com a versão real do produto (`v1.0.0`) — força atualização de
      cache em quem já tem o app instalado.
- [x] Build limpa: projeto é 100% zero-build por design (arquivo único `app.js` + módulos ES em
      `js/`, sem bundler/transpiler) — confirmado, não é uma lacuna.
- [x] Versionamento: `sw.js` (`CACHE_VERSION`), `manifest.json` (`version`) e um comentário de
      release no topo de `app.js` agora identificam consistentemente "Compasso v1.0.0". Antes
      desta sprint não existia nenhum identificador de versão real no projeto.

## Segurança

- [x] Console limpo: nenhum `console.log` de debug esquecido (o único já existente,
      `js/supabase.js`, foi removido na Sprint Q); só `console.error` legítimo em pontos de
      falha real.
- [x] Sem `TODO`/`FIXME`/`debugger` no código — confirmado via busca em todos os `.js` do
      projeto (o único resultado da busca era a palavra portuguesa "todo/toda" dentro de um
      comentário, não um marcador de pendência).
- [x] Nenhuma chave privada exposta — `js/config.js` só expõe a **anon key** pública do
      Supabase, que é o uso correto e esperado dessa chave (protegida por RLS no banco, não por
      sigilo da chave).

## Produto

Telas revisadas nesta sprint e nas anteriores (Sprint Q/R), sem pendência conhecida:

- [x] Onboarding / Boas-vindas
- [x] Login, Cadastro, Recuperação de senha
- [x] Home / Aplicação / Evolução (tema Quiet Premium)
- [x] Diário do dia
- [x] Mais (hub) — Minha jornada, Linha do tempo, Conquistas, Insights, Plano de ação,
      Bioimpedância, Exames, Estatísticas, Calculadora, Agenda
- [x] Relatórios (geração de PDF)
- [x] Configurações (perfil, preferências, notificações, dados, assinatura)
- [x] Premium (planos, benefícios, restaurar compra)

## Pendências conhecidas (fora do escopo desta sprint, documentadas)

- Sincronização entre dispositivos das preferências de notificação/licença continua limitada a
  `localStorage` local — mesma limitação já documentada nas Sprints K/P.
- Sprawl de espaçamento (`margin-top`/`margin-bottom`) fora do escopo pontual corrigido nesta
  sprint, e diferenças de peso/tipografia entre os temas Legado e Quiet Premium — documentadas
  como técnica intencional/débito técnico para uma sprint de design system dedicada, não como
  bugs de publicação.
