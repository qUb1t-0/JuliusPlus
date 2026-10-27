# Análise do APK Oinc 2.46.0

Fonte: APK extraído do Galaxy S23 do usuário (instalado pela Play Store).
Ferramentas: REA (`inspect_android_package`, evidência
`ev_235a23898c588394fd7475be43bee43ae1596a7a792295a260dd6fb29f8c39c4`) e um
parser próprio da tabela de strings do bytecode Hermes (v96).

> Tudo abaixo é **análise estática**: nada foi executado nem observado em rede.
> "Observado" = está no artefato. "Inferido" = dedução a partir dos nomes.

## Identidade

| Campo | Valor |
|---|---|
| Pacote | `br.com.useoinc.oincapp` |
| Versão | 2.46.0 (versionCode 2019) |
| SDK | min 24 (Android 7) · target 36 |
| SHA-256 base.apk | `1c0cab7341bfa04a8ae257e7e28f990a5affbf1f84d9d6ce8c04965fa67e137e` |
| Classes / recursos | 11.217 / 1.283 |

## Stack técnica (observado)

- **React Native + Expo** (Expo Router, `expo-updates` com OTA ligado), JS em
  **Hermes bytecode** (`assets/index.android.bundle`, 14 MB, 65.359 strings).
- **API GraphQL** — 62 queries, 91 mutations, 1 subscription embutidas no bundle.
  Valores monetários trafegam como `Int` (centavos, inferido).
- Armazenamento local: **MMKV**; Room (via WorkManager).
- Notificações: Firebase Messaging + **Notifee** (lembretes agendados) + **Customer.io** (push e in-app).
- Observabilidade: Firebase Crashlytics/Performance, **Sentry**, **Bugsnag** (três ferramentas de crash ao mesmo tempo).
- Marketing/atribuição: Firebase Analytics, Facebook SDK, Install Referrer, AdServices.
- Login: e-mail/senha, Google Sign-In, Facebook, Apple (`LoginOauth`, `OauthRegister`).
- Segurança: biometria (`USE_BIOMETRIC`).
- Chat de suporte: Dialogflow em WebView (`app.useoinc.com.br/get_dialogflow_webview`).
- Deep link: esquema `oincapp://`.
- Open Finance: **Klavi** (`CreateLinkKlavi`, `ConnectBankKlavi`) para conectar bancos e cartões.

## Funcionalidades (módulos)

| Módulo | Telas/componentes observados | Operações GraphQL |
|---|---|---|
| **Início / Organizador** | `HomeScreen`, `ContainerHome`, `CardDashboard`, `CardBalance` | `GetOrganizerHomeData`, `GetOrganizerMainData`, `GetLatestTransactions` |
| **Transações / Extrato** | `ExtractPage`, `StatementScreen`, `TransactionDetailPage`, `EditTransactionPage`, `FilterTransactionsPage`, `DeletedTransactionsPage` | `InsertManualCardTransaction` (parcelas, recorrência), `Update*TransactionCategory`, `Update*TransactionObservation`, `SoftRemove*`/`Restore*` (lixeira), `Mask*`/`Unmask*` (ocultar) |
| **Categorias** | `CategoriesPage`, `CustomCategoryManager`, `CategorySpendingChart` | `GetDefaultCategoriesV2` (grupo → categorias com emoji), `Create/Update/DeleteCustomCategory`, `GetAggregatedCategories`, `GetCategoryHistoricalTotal` |
| **Orçamento** | `BudgetPage`, `NewBudgetPage`, `BudgetRebalance*`, `BudgetCategoryProgressItem`, `ConfigureBudgetSubcategories` | `CreateBudget(limit)`, `CreateBudgetCategory`, `UpdateBudget*`, `ResetAllBudgetCategory` |
| **Metas** | `ConfigureGoalsMeta`, `CardGoalPremium` | `CreateGoal(name, quantity, emoji)` |
| **Central de Boletos** | — | `RegisterTrackedInvoice(title, dueDay, emoji, value)`, `GetAllTrackedInvoice`, `ListSuggestedInvoices`, campo `payed` |
| **Assinaturas detectadas** | `SubscriptionPage` | `GetBankCardSubscriptions` (+ `totalSubscriptionExpenses`) |
| **Pequenos Gastos** | `SmallExpensesPage` | compras abaixo de R$ 50 no mês |
| **Cartões** | `CardSummaryPage`, `CardLimitOverviewPage` | `AddCreditCard`, `ListAllCards`, `SetDefaultCard` |
| **Receitas** | — | `GetOrganizerRevenue` (média salarial, total recebido) |
| **Cofrinho (poupança)** | `CofrinhoSetup*`, `CofrinhoTransfer*`, `CofrinhoTrocadinho*` | arredondamento (`StartRoundup`, `ChangeRoundUpModifier` = multiplicador), poupança semanal/mensal automática, Pix/TED (`RequestPixWithDraw`, `RequestDeposit`), `SmartTransfer*`, rendimento ligado à Selic (`UserGetSelic`) |
| **Retrospectiva mensal** | — | `GetMontlhyWrapped`: corrida de categorias, maior/menor gasto, dia mais caro, evolução da meta |
| **Onboarding com quiz** | `QuizzMonthlySpendPage`, `QuizzCategoryPage`, `QuizzCardFrequencyPage`, `QuizzScorePage` | `SetUserNewOnboardingQuizResponse` (gera nota final) |
| **Premium** | `SubscriptionPage`, `AnnualPlanModal`, `CouponModal` | R$ 12,90/mês · R$ 24,90/mês · R$ 1.068/ano (strings), cupons e promoções |

Abas observadas nas strings: **Transações · Orçamento · Meta · Cofrinho · Central de Boletos · Investimentos · Configurações**.

## Modelo de dados (inferido das operações)

```
Transaction   { id, amount:int(centavos), category, date, description,
                paymentType, installmentNumber, installments, recurrently,
                observation, manually, removed(soft), masked }
Category      { group, description, emoji }            # padrão + personalizada
Budget        { id, limit, categories: BudgetCategory[] }
BudgetCategory{ id, category, alias, limit, status }
Goal          { name, quantity(valor-alvo), emoji }
TrackedInvoice{ id, title, emoji, value, dueDay, dueDate, payed, observations }
Subscription  { id, title, amount, date, imageUri }
Wrapped       { categoriesRace[], maxValueTransaction, minValueTransaction,
                maxDayAmount, transactionsCounter, initial/finalBalance, ... }
```

## Pontos de atenção observados (oportunidades para o seu app)

1. **Três SDKs de crash** (Crashlytics + Sentry + Bugsnag) e vários de
   marketing — peso e superfície de privacidade grandes para um app financeiro.
2. Permissões amplas e antigas: `WRITE/READ_EXTERNAL_STORAGE`,
   `SYSTEM_ALERT_WINDOW`, `BROADCAST_CLOSE_SYSTEM_DIALOGS`.
3. Erros de digitação persistidos na API (`GetMontlhyWrapped`,
   `GetGerenalOrganizer`, `initalBalance`, `payed`, `MoustExpended`) — sinal de
   contrato de API sem revisão; no seu projeto vale versionar e revisar o schema.
4. Quase todas as funções dependem de conexão bancária (Open Finance) e de
   servidor; não há modo offline/local evidente.

## Lacunas

- O bytecode Hermes não foi decompilado (apenas a tabela de strings), então a
  lógica de cálculo (ex.: nota do quiz, regra do arredondamento) é desconhecida.
- Lista de categorias padrão vem do servidor (não está no APK).
- Endpoint GraphQL não foi identificado nas strings verificadas.
