# JuliusPlus

App web de controle de gastos pessoais — **Julius+**, “cada centavo conta”.

| Pasta | Conteúdo |
|---|---|
| [`site/`](site/README.md) | O app (Vite + React + TypeScript). Cadastro de primeiro acesso salvo no Supabase. |
| [`docs/analise-oinc.md`](docs/analise-oinc.md) | Análise estática do APK do Oinc usada como referência de funcionalidades. |
| `images/` | Design da figurinha “Seu Centavo” (ícone e paleta). |
| `scripts/` | Script para extrair um APK instalado via adb. |

O APK analisado **não** é versionado (`apk/` está no `.gitignore`).

## Rodar localmente

```bash
cd site
cp .env.example .env.local   # preencha com a URL e a chave publicável do Supabase
npm install
npm run dev
```

## Infra

- **Supabase** — projeto `JuliusPlus` (sa-east-1), tabela `public.cadastros`
  com RLS: o site só consegue inserir; leitura apenas pelo painel.
- **Vercel** — projeto `juliusplus`, diretório raiz `site/`, variáveis
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
