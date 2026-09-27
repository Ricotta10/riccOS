# RICC OS — Regras do Projeto

Este repositório é o app **RICC OS** (TanStack Start + Supabase + PWA). As automações
do RICC OS vivem em uma instância n8n **compartilhada com outros clientes**. As regras
abaixo existem para evitar qualquer alteração acidental fora do escopo do RICC OS.

---

## 1. n8n — Escopo de atuação (REGRA CRÍTICA)

A instância n8n (`https://n8n.omniautomacoes.com.br`) é compartilhada. Existem 4 pastas
na raiz do projeto pessoal:

| Pasta                  | ID da pasta         | Pode mexer? |
|------------------------|---------------------|-------------|
| **RICC OS**            | `ePGBJ9fJsNLo5zYJ`  | ✅ **SIM**  |
| OMNI AUTOMAÇÕES        | `Rd0CDe7L50bJqZ7w`  | ❌ NUNCA    |
| GRUPO VISI MARKETING   | `V3WvqGJCfWwYcQDE`  | ❌ NUNCA    |
| DRA LIVIA              | `HoeR4bXskKVOBGsY`  | ❌ NUNCA    |

### Regras absolutas

1. **Só criar, editar, ativar, desativar, executar ou excluir workflows que pertençam à pasta `RICC OS`.**
2. **Nunca** tocar em workflows de outros clientes — nem para "corrigir", "melhorar", "padronizar" ou "testar". Se o usuário pedir explicitamente, **avisar que está fora do escopo do RICC OS e pedir confirmação antes**.
3. **Nunca** mover, renomear ou excluir pastas de outros clientes.
4. **Nunca** criar, editar ou excluir credenciais (`n8n_manage_credentials`) que não sejam exclusivas do RICC OS. Credenciais podem ser compartilhadas entre workflows de clientes diferentes.
5. **Nunca** rodar `n8n_audit_instance`, `n8n_autofix_workflow` ou operações em massa que afetem a instância inteira sem confirmação explícita do usuário.
6. **Todo workflow novo do RICC OS deve ser criado com `parentFolderId: "ePGBJ9fJsNLo5zYJ"`** e receber a tag `RICC OS` (ID `8YF2LRWjiO7a26hV`).
7. Leitura (listar, ver estrutura, ver execuções) de outros workflows é permitida **apenas para consulta**, nunca como base para alteração.

### Como identificar um workflow do RICC OS

A API do n8n **não informa em qual pasta um workflow está**. Portanto, considere um
workflow como pertencente ao RICC OS **somente se atender às duas condições**:

- O nome começa com `{emoji}Ricc OS |` (ex.: `🟢Ricc OS | Financeiro - ...`), **E**
- Possui a tag `RICC OS`.

Se houver qualquer dúvida se um workflow pertence ao RICC OS → **não mexer, perguntar**.

### Workflows atuais do RICC OS

| ID                  | Nome                                          | Status |
|---------------------|-----------------------------------------------|--------|
| `TePr3ZKHrd0EIijg`  | `🟢Ricc OS | Operação - Central de Comando por Voz` (antigo "Financeiro - Salvar Transações") | 🟢 Publicado (voz da Central; `Roteador de Domínio` separa Financeiro / Academia / Alimentação / Outro — Financeiro e Alimentação têm fluxo (Alimentação cria a refeição `processando` e chama o sub-workflow `Registrar Refeição`), Academia é placeholder; parcelado vira N linhas no nó `RESULTADO FINAL`) |
| `Qg4qY07wPI9HC8k6`  | `🟢Ricc OS | Financeiro - Gerar Metas com IA` | 🟢 Publicado |
| `PlwBzdIQVUFQ3rm9`  | `🟢Ricc OS | Financeiro - Gerar Insights de Gastos` | 🟢 Publicado (roda toda segunda 7h; envia push reaproveitando a credencial `Supabase - Ricc OS`) |
| `TiXgtApZDQzt6G16`  | `🟢Ricc OS | Financeiro - Lançar Compra Wallet` | 🟢 Publicado (webhook `riccos-wallet-compra` chamado pela automação "Transação" do Atalhos do iPhone; header `X-Riccos-Token` via credencial `Ricc OS - Webhook Wallet`) |
| `Fu6fdrAVnSQk9Wru`  | `🟢Ricc OS | Financeiro - Alertas de Metas` | 🟢 Publicado (todo dia 9h; push quando meta passa de 80%, estoura ou fica em risco pelo ritmo; dedupe em `alertas_enviados`; nó `Calcular Alertas` espelha `src/lib/month-pace.ts` — **mudar nos dois lugares**) |
| `7MVoHOmk6bk8BnuR`  | `🟢Ricc OS | Alimentação - Registrar Refeição` | 🟢 Publicado (webhook `riccos-alimentacao-refeicao` chamado pelo app com `{ refeicao_id }` + gatilho de sub-workflow para a voz; lê a refeição `processando`, a IA separa itens/kcal/macros/qualidade e grava pela RPC `alimentacao_salvar_refeicao`) |
| `2DYpU6YQ5OJIOgcs`  | `🟢Ricc OS | Alimentação - Gerar Protocolo` | 🟢 Publicado (webhook `riccos-alimentacao-protocolo` com `{ protocolo_id }`; agente monta o plano de 60 dias e ativa pela RPC `alimentacao_ativar_protocolo`; push ao terminar) |
| `dEdq4pKVu5roiGZ5`  | `🟢Ricc OS | Alimentação - Lembretes` | 🟢 Publicado (cron `5,35 * * * *`; push de "hora de comer" após `protocolo_intervalo_max_h` sem registro, só acordado, e aviso de renovação do protocolo em D-7/D-3/D0; dedupe em `alertas_enviados` com chaves `alim_*`) |
| `4OEkNbWP6Cc4dUzj`  | `🟢Ricc OS | Alimentação - Relatório Semanal` | 🟢 Publicado (segunda 7h30; nó `Calcular Semana` espelha `computeDailyStats`/`summarizeDays` de `src/lib/alimentacao.ts` — **mudar nos dois lugares**; grava `alimentacao_relatorios` + push) |

> Atualize esta tabela sempre que criar ou remover um workflow do RICC OS.

---

## 2. n8n — Padrão de nomenclatura dos workflows

Todo workflow segue **exatamente** este formato (sem espaço entre o emoji e o nome):

```
{emoji}{Cliente} | {Área} - {Nome da automação}
```

Para o RICC OS o cliente é sempre `Ricc OS`:

```
🟢Ricc OS | Financeiro - Salvar Transações
🟡Ricc OS | Financeiro - Categorizar com IA
🔴Ricc OS | Operação - Backup Diário
```

### Emoji de status (obrigatório como primeiro caractere)

| Emoji | Significado   | Quando usar |
|-------|---------------|-------------|
| 🟢    | **Publicado** | Workflow ativo (`active: true`) e em produção. |
| 🟡    | **Rascunho**  | Workflow em desenvolvimento/testes. Ainda não está pronto para produção (normalmente `active: false`). |
| 🔴    | **Desativado**| Workflow que já esteve em produção mas foi desligado (`active: false`), ou que foi descontinuado. |

### Regras do emoji

- **Todo workflow novo nasce como 🟡 (rascunho)** e `active: false`. Só vira 🟢 quando o usuário confirmar a publicação.
- **Ao ativar** um workflow (`active: true`) → renomear para 🟢.
- **Ao desativar** um workflow que estava em produção → renomear para 🔴.
- O emoji deve **sempre refletir o estado real**. Se encontrar um workflow do RICC OS com emoji divergente do status (`active`), avisar o usuário e propor a correção — não corrigir silenciosamente.
- Nunca usar outros emojis ou omitir o emoji.

### Áreas usadas

Use a área que melhor descreve o domínio da automação. Áreas já em uso na instância:
`Financeiro`, `Comercial`, `Operação`. Crie novas apenas se nenhuma existente servir.

---

## 3. Supabase

- Projeto: `https://ehjsbzjkyukssobtywpx.supabase.co` (ref `ehjsbzjkyukssobtywpx`).
- Este projeto Supabase é **exclusivo do RICC OS** — pode ser usado livremente.
- Tabelas atuais (schema `public`, todas com RLS habilitado): `usuarios`, `categorias`,
  `subcategorias`, `transacoes`, `metas`, e as do minigame: `missoes` e `temporadas`
  (estas duas com políticas `user_id = auth.uid()`; as antigas usam a política ampla "Liberar Acesso").
- `transacoes.transacao_origem` (`manual`|`voz`|`wallet`), `transacao_revisada` (false = fila de revisão
  das compras da Wallet em `wallet-review.tsx`), `transacao_chave_externa` (dedupe, índice único parcial) e
  `transacao_estabelecimento_original` (nome cru da Wallet, antes de apelido/IA).
- `estabelecimentos_apelidos` (RLS `user_id = auth.uid()`): mapeia nome cru → nome amigável + categoria.
  `apelido_padrao` = `normalizeMerchant(trecho)` (sem acento, minúsculo, só `[a-z0-9]`), casa por "contém" e o
  mais longo vence. A mesma normalização vive no nó `Decidir Ação` do workflow Wallet — **mudar nos dois lugares**.
  UI em `merchant-aliases.tsx` (botão "Apelidar" na revisão e "Apelidos" em Transações).
- **Reserva** (RLS `user_id = auth.uid()`): `reservas` (1 por usuário: `reserva_alvo`, `reserva_saldo_inicial`)
  e `reserva_movimentos` (`aporte`|`resgate`, valor sempre positivo). Aportes/resgates **não** são receita nem
  despesa — ficam fora de metas, missões e sobra. Cálculos em `src/lib/reserva.ts`, UI em `reserva-card.tsx`
  (Visão Geral: sobra do período → guardado → sem destino).
- `alertas_enviados` (RLS só leitura do dono; escrita pelo n8n com service role): chave única
  `{nivel}:{categoria_id}:{AAAA-MM}` por usuário, para cada alerta de meta sair uma vez por período.
  A Alimentação usa as chaves `alim_lembrete:{instante}` e `alim_protocolo:{protocolo_id}:{d7|d3|d0}`.
- **Alimentação** (todas com RLS `user_id = auth.uid()`; ver seção 6):
  `alimentacao_protocolos` (respostas do formulário + plano da IA; **um único `ativo` por usuário**, validade
  60 dias, status `gerando|ativo|erro|substituido`), `refeicoes` (status `processando|ok|erro`, origem
  `texto|voz|checkin`, qualidade `boa|ok|ruim`, motivo do erro), `refeicao_itens` (os totais de kcal/macros
  da refeição são mantidos por **trigger** a partir dos itens — não gravar totais à mão),
  `medidas_corporais` e `alimentacao_relatorios` (só leitura do dono; escrita pelo n8n).
  RPCs `alimentacao_salvar_refeicao` e `alimentacao_ativar_protocolo` são **só service role** (n8n).
- Inserts sempre com `user_id: user.id` (auth), seguindo `store.tsx`.
- **Compra parcelada:** o valor informado é o **total** da compra; `addTransaction` divide com
  `splitInstallments` (`finance-data.ts`, centavos que sobram vão nas primeiras parcelas) e grava
  uma linha por mês com o mesmo `transacao_parcela_id`. O nó `RESULTADO FINAL` do workflow
  Central de Comando por Voz replica essa lógica — **mudar nos dois lugares**.
- Antes de alterar schema, inspecione as tabelas existentes (`list_tables` verbose).
- Toda tabela nova **deve ter RLS habilitado** e políticas definidas.
- Prefira `apply_migration` (com nome descritivo em snake_case) a `execute_sql` para DDL.
- Após mudanças de DDL, rodar `get_advisors` (security) e reportar ao usuário.
- Nunca rodar `DELETE`/`TRUNCATE`/`DROP` sem confirmação explícita do usuário.

---

## 4. Design System do app (UI)

Definido em `src/styles.css` (tokens) e nos componentes de `src/components/ui` e
`src/components/riccos`. **Toda tela nova deve usar os tokens e componentes existentes.**

- **Paleta oficial (única):** `#000000` (preto), `#CFFFE2` (mint), `#A2D5C6` (sage),
  `#F6F6F6` (snow). Expostas como `--brand-black/mint/sage/snow` e utilitários
  `bg-brand-mint`, `text-brand-snow` etc. **Não introduzir outras cores de marca.**
  Únicas exceções: `success`/`danger`/`warning` (leitura financeira) e os tokens `--chart-1..8`.
- **Nunca hardcodar cores** (`bg-emerald-500`, `#6366F1`, `text-slate-300`…). Usar sempre
  tokens semânticos: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`,
  `bg-primary`, `bg-accent`, `border`, `text-success`, `bg-danger-soft`… Em gráficos
  (Recharts) usar `chartColors` / `chartTooltipStyle` de `src/lib/finance-data.ts`.
- **Fonte:** Poppins, exclusivamente (`font-sans` já resolve). Não usar `font-mono` nem
  outras famílias. Números financeiros sempre com `tabular-nums`.
- **Temas:** claro e escuro via classe `dark` no `<html>` (`ThemeProvider`/`ThemeToggle`
  em `src/components/riccos/theme.tsx`, chave `riccos_theme` no localStorage, padrão escuro).
  Painéis que são **sempre pretos** (sidebar, painel de marca do login) recebem a classe
  `dark` no wrapper para que os tokens internos sigam o tema escuro.
- **Raio:** base `--radius: 1rem`. Convenção: botões/inputs `rounded-xl`, cards `rounded-2xl`,
  diálogos `rounded-3xl`, badges `rounded-full`. Nada de `rounded-md`/`rounded-sm` em novos elementos.
- **Sombras:** apenas `shadow-soft` (elevação padrão) e `shadow-glow` (destaque mint).
- **Marca:** usar `LogoMark`, `LogoTile` e `Wordmark` de `src/components/riccos/brand.tsx`.
  A marca é renderizada por CSS mask (`/public/logo-mask.png`) e herda a cor do texto.
  Arquivos derivados: `logo-black.png`, `logo-mint.png`, ícones PWA e `favicon.ico`.
  **Nunca usar os ícones `Bot`/`Sparkles` do lucide como identidade** — o "robô" foi
  substituído pelo núcleo de voz (`voice-core.tsx`) e pela marca RR.
- **Central de Comando (`/`) é o assistente geral do Rodrigo**, não uma tela financeira:
  nenhum texto, regra ou atalho específico de finanças nela (o financeiro é só o primeiro módulo).
  Manter a tela limpa: saudação, núcleo de voz, estado da gravação e o `ScoreBadge` discreto.
- **O RiccOS se apresenta como assistente pessoal, não como app financeiro.** Vale para a
  Central de Comando e também para o **login** (`login.tsx`) e qualquer texto de marca:
  headline, destaques e rodapé falam do assistente e dos módulos, nunca de entradas, saídas,
  metas ou relatórios.
- **Componentes compartilhados obrigatórios:** `PageHeader` (título de página),
  `StatCard` (KPIs), `Badge` com variantes `success|warning|destructive`, `Button`
  (variantes `default|outline|secondary|ghost|glow`, tamanhos `sm|default|lg|icon|icon-sm`).
- **Mobile é obrigatório:** todo layout novo precisa funcionar em 375px. Header mobile
  (`glass`), bottom nav flutuante com o núcleo central e listas em cards (não tabelas)
  abaixo de `md`. Tabelas desktop devem ocultar colunas secundárias em `md`/`lg`.
- **Navegação por módulo** (`modules` em `app-shell.tsx`): a bottom nav é
  **Financeiro · Alimentação · (núcleo) · Missões · Menu** — cada módulo leva à sua `home` e as páginas
  dele aparecem como abas no topo no mobile (`ModuleTabs`). Na sidebar, um grupo por módulo + "Progresso"
  (Missões). Não adicionar um 6º item na bottom nav: módulo novo (ex.: Treino) entra em `modules` e a
  barra é revista com o usuário. `PushToggle` é o controle de notificações reutilizável em qualquer página.
- **Colapsar a sidebar** (`SidebarBrandHeader` em `app-shell.tsx`): o controle vive no cabeçalho,
  nunca solto no meio do menu. Expandido = botão fantasma `«` à direita da marca; colapsado = o
  próprio tile da marca vira `»` no hover/foco. No drawer mobile o botão não aparece.

## 5. Minigame ("Missões") — placar de todos os módulos

Regras em `src/lib/gamification.ts` (funções puras), estado em
`src/components/riccos/gamification.tsx` (`useGamification`), UI em `src/routes/missoes.tsx`
e widgets em `season-widgets.tsx` (`ScoreCard` na Visão Geral, `ScoreBadge` na Central).

- **Temporada = mês do filtro global** (mesmo `month/year` do `PeriodFilter`, com dia de corte).
- **Missões automáticas** (calculadas dos lançamentos/metas, nunca persistidas): fechar no azul (100),
  contas em dia (100), gastar menos que o mês anterior (80), renda comprometida ≤ 70% (60),
  ≥ 10 lançamentos (30) e uma por meta de categoria definida no mês (40 cada).
- **Missões de Alimentação** (`computeAlimentacaoMissions`, ids `auto-alim-*`, só em períodos com
  protocolo): proteína batida em 20 dias (100), registro em 25 dias (60), ≤ 4 refeições fora do plano (80),
  ≤ 3 puladas (60), média de kcal na faixa ±10% (60), 4 pesagens (30). As de "no máximo" só valem com
  registro em ≥ 15 dias (para não ganhar pontos sem registrar). A página Missões agrupa por módulo.
- **Missões manuais**: tabela `missoes`, criadas/marcadas pelo usuário (5–500 pts).
- **Faixas** por % do total possível: Bronze ≥ 45%, Prata ≥ 65%, Ouro ≥ 85% (`FAIXA_THRESHOLDS`).
- **Fechamento** (`closeSeason`): grava `temporadas` com snapshot das missões, pontos e faixa.
  Temporada fechada é **somente leitura** (usa o snapshot, não recalcula). `reopenSeason` apaga a linha.
  `closePastSeasons` fecha em lote os meses passados que ainda têm dados em aberto.
- **XP/nível** = soma de `temporada_pontos` de todas as temporadas fechadas (`LEVELS`);
  **streak** = temporadas consecutivas mais recentes com faixa ≥ Bronze.
- **Sem recompensas/prendas**: o jogo é só missões, pontos, faixa e XP (removido em 23/09/2026 a
  pedido do usuário, no app e no banco — tabela `recompensas` e colunas
  `temporada_recompensa_id`/`temporada_prenda_id` dropadas). Não reintroduzir catálogo, sorteio
  ou punição sem ele pedir.
- Ao mudar regras/pontos, manter `computeAutoMissions` pura e atualizar esta seção.

## 6. Módulo Alimentação

Rotas em `src/routes/alimentacao/` (Diário `/alimentacao`, Relatórios, Corpo, Protocolo), regras puras em
`src/lib/alimentacao.ts`, estado em `src/components/riccos/alimentacao-store.tsx` (`useAlimentacao`) e
componentes em `alimentacao-widgets.tsx`.

- **Protocolo**: formulário → linha `gerando` → webhook do n8n → agente gera metas (kcal/macros/água),
  rotina (mínimo de refeições, intervalo máximo, janelas), cardápio com opções e critérios 🟢🟡🔴. Vale
  60 dias; perto do fim o n8n avisa por push para responder de novo (pré-preenchido com as respostas
  anteriores e a última medição).
- **Registro**: texto no Diário ou voz na Central → linha `processando` → n8n calcula e marca `ok`
  (ou `erro`, com "tentar de novo"). Check-in grava direto uma opção do cardápio. Editar a quantidade de
  um item recalcula na proporção (`scaleItem`). Refeição `ruim` pede o motivo (fome, ansiedade…).
- **Análise é semanal**: refeições puladas = dias com registro abaixo do mínimo do protocolo, só em dias
  já encerrados (ele pode lançar depois com outro horário); registros com < 90 min de intervalo contam
  como uma refeição. Dia sem nenhum registro é "sem registro", não "pulado".
- Sem nada de treino por enquanto (módulo Academia vem depois).

## 7. Segurança

- `.mcp.json` contém tokens (Supabase access token e API key do n8n). **Nunca** commitar
  este arquivo nem exibir seus valores em respostas. Ele deve estar no `.gitignore`.
- Nunca colocar credenciais hardcoded em nós do n8n — usar sempre credenciais do n8n
  ou variáveis de ambiente.
