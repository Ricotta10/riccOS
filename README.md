# RiccOS: Sua Vida Financeira Clara

Atue como um Designer UI/UX de nível sênior especializado em Web Apps e Dashboards SaaS modernos. Crie a interface completa do sistema de gestão financeira pessoal chamado **RiccOS**.

O design deve ser limpo, extremamente funcional, intuitivo e com foco em alta usabilidade (Clean Dashboard Style, tons neutros, elementos bem espaçados, bordas arredondadas suaves e tipografia moderna).

---

## 1. ESTRUTURA GLOBAL E NAVEGAÇÃO

- **Sidebar (Esquerda):**

  * **Topo:** Logotipo e título "**RiccOS**".

  * **Menu de Navegação:**

    * 📊 **Visão Geral**

    * 💸 **Transações**

    * 🎯 **Metas**

    * 📈 **Relatórios**

- **Topbar (Cabeçalho Superior):**

  * Seletor de mês/ano com setas de navegação (ex: `< Agosto / 2026 >`).

  * Badge de status rápido do mês atual com resumo do Saldo.

  * Avatar do perfil do usuário no canto direito.

---

## 2. PÁGINA 1: VISÃO GERAL (DASHBOARD)

A tela principal do sistema, focada na leitura rápida do mês selecionado.

- **Linha de Cards de Resumo (Topo - Grid de 4 Colunas):**

  * **Entradas:** Valor total das receitas no mês (destaque em cor verde).

  * **Saídas:** Valor total das despesas no mês (destaque em cor vermelha/alerta).

  * **Balanço:** Resultado líquido do mês (Verde para positivo, Vermelho para negativo).

  * **Pendente:** Valor total acumulado de contas que ainda vencem até o fim do mês.

- **Corpo Principal (Layout em 2 Colunas - 60% / 40%):**

  * **Coluna Esquerda (60%):**

    * Card com gráfico de rosca/donut mostrando a distribuição de **Gastos por Categoria**.

    * Abaixo do gráfico, lista compacta com as 5 categorias de maior consumo no mês.

  * **Coluna Direita (40%):**

    * Card de **Próximos Vencimentos** com uma tabela compacta listando os próximos lançamentos (Data, Descrição, Valor e Tag de Status `Pendente` / `Pago`).

---

## 3. PÁGINA 2: TRANSAÇÕES (LANÇAMENTOS)

Central completa para listagem, manipulação e cadastro de movimentações.

- **Barra Superior de Ações:**

  * Campo de busca por texto/descrição.

  * Filtros em dropdown: **Tipo** (_Todas, Receitas, Despesas_), **Categoria** e **Status** (_Pago, Pendente_).

  * Botão de ação `➕ Adicionar Lançamento`.

- **Tabela de Dados (Data Table):**

  * Colunas: `Data` | `Descrição` | `Categoria / Subcategoria` | `Tipo` | `Frequência` (_Pontual, Recorrente, Parcelado x/y_) | `Valor` | `Status` | `Ações`.

  * Status exibido como badges clicáveis para alternar rapidamente entre `Pago` e `Pendente`.

  * Menu de ações na linha: Editar e Excluir.

- **Modal de Cadastro ("Nova Transação"):**

  * **Toggle no topo:** `[ Despesa ]` / `[ Receita ]`.

  * **Campos:**

    * Descrição (Texto)

    * Valor (Moeda)

    * Data de Vencimento (DatePicker)

    * Categoria (Dropdown)

    * Subcategoria (Dropdown condicionado à Categoria selecionada)

    * Frequência (Radio buttons: `Pontual`, `Recorrente`, `Parcelado`)

    * _Se Parcelado for selecionado:_ Exibir campo numérico para "Quantidade de Parcelas".

    * Checkbox de Status: `[x] Já está pago/recebido`.

---

## 4. PÁGINA 3: METAS & TETOS DE GASTOS

Área focada no controle do orçamento mensal (Budgeting).

- **Header:** Card com resumo do **Orçamento Global do Mês** (Soma dos tetos vs. Total já comprometido).

- **Grid de Cards por Categoria (3 colunas):**

  * Cada card representa uma Categoria (Moradia, Alimentação, Lazer, etc.) contendo:

    * Ícone e Nome da Categoria.

    * Valor atual gasto vs. Teto cadastrado (ex: `R$ 800,00 de R$ 1.000,00`).

    * **Barra de Progresso Visual dinâmica:**

      * Cor **Verde**: até 75% consumido.

      * Cor **Amarela**: 76% a 99% consumido.

      * Cor **Vermelha**: 100% ou mais (exibir badge de alerta `Teto Excedido`).

    * Botão secundário de edição rápida `Ajustar Teto`.

---

## 5. PÁGINA 4: RELATÓRIOS & HISTÓRICO CONSOLIDADO

Espaço para análise comparativa de meses passados e projeção futura.

- **Barra de Filtros de Período:** Seletor de intervalo (`Últimos 3 meses`, `Últimos 6 meses`, `Ano Atual`).

- **Gráfico Principal:** Gráfico de barras comparativo mês a mês mostrando a evolução de **Receitas vs. Despesas**.

- **Tabela de Histórico Consolidado Mensal:**

  * Linhas por mês passado contendo: `Mês/Ano` | `Total Receitas` | `Total Despesas` | `Resultado Líquido` | `Variação %`.

- **Quadro de Projeção Futura:**

  * Card com o valor total já comprometido para os próximos 3 a 6 meses baseado em despesas recorrentes e parcelas vincendas.

This project was built with RiccOS.

## Build with RiccOS

Continue developing this project in RiccOS.

- **Ship faster**: describe what you want to build and RiccOS handles the code.
- **Stay in sync**: every change made in RiccOS is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into RiccOS, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
