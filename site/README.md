# Julius+ — protótipo de controle de gastos

Site de teste local ("cada centavo conta") inspirado nas funcionalidades mapeadas no APK do Oinc
(ver [análise](../docs/analise-oinc.md)). Marca, textos, ícones e código são
originais; nada foi copiado do app.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # checagem de tipos + build de produção
```

## Funcionalidades

| Módulo | O que faz | Referência no Oinc |
|---|---|---|
| Início | Saldo do mês, receitas × despesas, gastos por categoria, orçamento, meta, últimos 6 meses | `GetOrganizerHomeData` |
| Transações | Lançar, editar, buscar, filtrar, parcelar no crédito, recorrência, observação, lixeira com restaurar | `InsertManualCardTransaction`, `SoftRemove*`/`Restore*` |
| Orçamento | Limite total + limite por categoria, status (no ritmo/atenção/estourou), projeção do mês | `CreateBudget`, `CreateBudgetCategory`, `BudgetRebalance` |
| Contas a pagar | Boletos/contas fixas com dia de vencimento, estado (atrasada, vence em breve, paga) | `RegisterTrackedInvoice` (Central de Boletos) |
| Metas | Valor-alvo, prazo, quanto guardar por mês, guardar/retirar | `CreateGoal` |
| Insights | Retrospectiva do mês, pequenos gastos, assinaturas/recorrentes | `GetMontlhyWrapped`, `SmallExpensesPage`, `GetBankCardSubscriptions` |
| Ajustes | Categorias personalizadas, tema, modo discreto, backup/restauração | `CreateCustomCategory`, `Mask*` |

## Melhorias aplicadas em relação ao app analisado

1. **Local-first e sem rastreadores** — sem login, sem SDKs de analytics/crash;
   dados só no `localStorage` (o Oinc embarca Crashlytics + Sentry + Bugsnag + Facebook SDK).
2. **Seus dados são seus** — exportação CSV (compatível com Excel pt-BR) e backup/restauração JSON.
3. **Dinheiro em centavos inteiros** e parcelamento sem perder centavos (R$ 1.000 em 3× = 333,34 + 333,33 + 333,33).
4. **Ritmo do orçamento** — esperado até hoje e projeção de fim de mês, com alerta antes de estourar.
5. **Recorrentes em um clique** — lança no mês atual as contas fixas/receitas do mês anterior que faltam.
6. **Excluir todas as parcelas** de uma compra de uma vez, com desfazer.
7. **Modo discreto** (👁️) para esconder valores em público, também no leitor de tela.
8. **Acessibilidade** — diálogos nativos com foco preso e Esc, rótulos ARIA em gráficos e barras,
   link “pular para o conteúdo”, `prefers-reduced-motion`, navegação por teclado (atalho **N**).
9. **Tema claro/escuro** automático ou manual; layout responsivo com barra inferior no celular.
10. Validação de formulário que some assim que o campo é corrigido; contas com dia 31 viram o último dia do mês.

## Estrutura

```
src/
  types.ts              modelo de dados (Transaction, Budget, Bill, Goal…)
  lib/format.ts         moeda, datas locais, parcelas
  lib/store.tsx         estado global (useReducer) + persistência
  lib/selectors.ts      cálculos (resumo, categorias, ritmo, recap, recorrentes)
  lib/seed.ts           categorias padrão e dados de exemplo relativos à data atual
  components/           UI compartilhada e formulário de transação
  pages/                uma tela por módulo
```

## Identidade visual

Cores, ícone e fonte de título vêm da figurinha “Seu Centavo”
(`../images/Figurinha — Seu Centavo-html.zip`): verde `#1F9D6B`/`#1F7A55`,
azul-marinho `#2B3A67`/`#1C2748`, amarelo moeda `#F2C14E`/`#B9862A`, vermelho
faixa `#E35A4C`/`#C2453A` e a fonte **Bangers**. O ícone está em
`public/julius-icon.svg`.
