# Equyty

A personal finance app: connect your accounts through Plaid, and Equyty imports your transactions, categorizes them with Claude, and turns them into cash flow, budgets, recurring bills, goals and plain-English advice.

**Stack:** SvelteKit 2 (Svelte 5 runes) · TypeScript · Supabase (Postgres, Auth, RLS) · Plaid · Anthropic Claude · Vercel

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Net worth trend, spending pace against last month, budget health, top categories, upcoming bills, recent activity, and a review queue |
| **Accounts** | Balances grouped by type, net worth history, and connection health with one-click Plaid reconnect |
| **Transactions** | Search and filters, inline recategorization, bulk edit, notes, excluding a transaction from reports, and "Always for {merchant}" rules |
| **Cash Flow** | Monthly income against expenses, with drill-down into any month |
| **Reports** | Sankey cash-flow diagram (by category and group, by group, or by category) with a table view, plus spending and income breakdowns and top merchants |
| **Budget** | Monthly budgets you edit inline. Copy last month, or fill from your 3-month averages |
| **Recurring** | Subscriptions and bills detected by Plaid, a normalized monthly cost, and a 30-day timeline |
| **Goals** | Savings goals with progress, contributions and the monthly amount needed to hit a target date |
| **Investments** | Holdings, cost basis, unrealized gain and allocation (requires the Plaid Investments product) |
| **Advice** | Insights and next steps from Claude, built from aggregate data only |

### How categorization works

New transactions pass through three steps in order:

1. **Your rules.** When you recategorize a transaction, you can choose "Always for {merchant}". That saves a rule and applies it to your past transactions from the same merchant.
2. **Claude.** The model sees your actual category list and your past manual corrections as examples, so it learns your preferences. It returns structured output (guaranteed-valid category ids plus a confidence level). Low-confidence results are flagged for review.
3. **Plaid's taxonomy.** This is the deterministic fallback used when AI is unavailable.

Categories you set by hand are never overwritten, even when a pending transaction posts.

## Security model

- **Row Level Security on every table.** Policies scope rows to `auth.uid()`. Composite foreign keys `(id, user_id)` make it impossible to reference another user's category, account or item.
- **Service role key is server-only.** It's imported only in `src/lib/server/supabase-admin.ts`, and SvelteKit refuses to bundle `$lib/server/*` into client code. User-facing reads go through a per-request client that uses the anon key and the user's session, so RLS always applies.
- **Plaid-mirrored data is read-only to users.** Items, accounts, transactions, holdings and recurring streams are written only by the server. Column-level grants let the browser change only safe fields, such as a transaction's category or notes and an account's display name, never an amount or balance.
- **Plaid access tokens are encrypted at rest** with AES-256-GCM, in a table that has RLS enabled, no policies, and all privileges revoked from `anon` and `authenticated`.
- **Plaid webhooks are verified.** The ES256 JWT is checked against Plaid's published key, it must be less than 5 minutes old, and the SHA-256 of the body must match.
- **Hardening:** a strict CSP with per-request nonces, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: private, no-store` on authenticated pages. `/api/cron/sync` requires a bearer secret and uses a constant-time comparison. Redirect targets are validated as same-origin paths.
- **Minimal data sent to the AI.** Categorization sends descriptions, amounts and dates, never account numbers. Advice sends monthly aggregates only.

The migration was exercised against real Postgres with 32 isolation tests covering cross-user reads and writes, column grants, the secrets table, anonymous access and cascades.

## Setup

### 1. Install

```bash
npm install
cp .env.example .env   # then fill it in
```

### 2. Supabase

All of Equyty's tables, functions and types live in their own **`equyty` schema**, so the app can share a Supabase project (such as a team dev database) with other apps. The migration creates objects only inside `equyty`. It adds no triggers to the shared `auth.users` table and changes no privileges elsewhere. A new user's profile and default categories are created by `equyty.ensure_user_setup()` the first time they open the app.

1. **Apply the schema.** On a project that other apps also use, don't use `supabase db push`: it expects the remote migration history to match this repo's `supabase/migrations` exactly. Run the SQL directly, wrapped in a transaction:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   { echo "begin;"; cat supabase/migrations/20260927000000_init.sql; echo "commit;"; } > /tmp/equyty.sql
   npx supabase db query --remote -f /tmp/equyty.sql
   ```
   On a project that holds only Equyty, `npx supabase db push` works too.
2. **Expose the schema to the API:** go to **Project Settings → Data API → Exposed schemas** and add `equyty`, keeping the schemas already listed. Until you do, every query fails with `PGRST106 Invalid schema: equyty`.
3. **Authentication → URL Configuration:** set **Site URL** to your deployed URL, then add `http://localhost:5173/**` and `https://<your-app>.vercel.app/**` to **Redirect URLs**.
4. Optional: to use token-hash links instead of the default PKCE links, set the *Confirm signup* email template to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. `/auth/confirm` handles both kinds of link.
5. Optional: after changing the schema, regenerate types with
   `npx supabase gen types typescript --linked --schema equyty > src/lib/supabase/database.types.ts`.

> **Shared auth:** apps on the same Supabase project share one set of users. Any account on that project can sign in to Equyty, but it only ever sees its own Equyty data.

### 3. Plaid

1. Create keys at [dashboard.plaid.com](https://dashboard.plaid.com), then set `PLAID_CLIENT_ID`, `PLAID_ENV=sandbox` and `PLAID_SANDBOX_SECRET` (plus `PLAID_PRODUCTION_SECRET` when you go live). The secret matching `PLAID_ENV` is used; `PLAID_SECRET` is a fallback.
2. Generate the token-encryption key with `openssl rand -base64 32` and put the result in `PLAID_TOKEN_ENCRYPTION_KEY`.
   **Keep this key safe.** If you lose it, every stored bank connection has to be re-linked.
3. Set `PLAID_WEBHOOK_URL=https://<your-app>/api/plaid/webhook`. Webhooks need a public URL, so use a tunnel such as ngrok for local development.
4. For production OAuth banks, register `https://<your-app>/plaid/oauth` under **Allowed redirect URIs** and set `PLAID_REDIRECT_URI`.
5. To test in sandbox, pick any institution in Link and sign in with `user_good` / `pass_good`.
6. To show investments, your Plaid account needs the Investments product. Leave `PLAID_OPTIONAL_PRODUCTS=investments` set, or clear it if you don't have that product.

### 4. Anthropic

Set `ANTHROPIC_API_KEY`. The default model is `claude-opus-5`, which you can override with `ANTHROPIC_MODEL`. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled. Without a key the app still works, and categorization falls back to Plaid's taxonomy.

### 5. Run

```bash
npm run dev      # http://localhost:5173
npm run check    # svelte-check + TypeScript
npm run build    # production build (Vercel adapter)
```

### 6. Deploy to Vercel

1. Import the repo into Vercel. The framework is detected automatically.
2. Add every variable from `.env.example` under **Project → Settings → Environment Variables**. Only the two `PUBLIC_*` values are exposed to the browser.
3. Add `CRON_SECRET`. The daily safety-net sync in `vercel.json` calls `/api/cron/sync`, and webhooks handle updates in real time.
4. Update `PLAID_WEBHOOK_URL`, `PLAID_REDIRECT_URI` and the Supabase URLs to the production domain.

## Project structure

```
src/
├── hooks.server.ts            # Supabase session, auth guard, security headers
├── app.css                    # Design tokens (light/dark), base components
├── lib/
│   ├── server/                # ⚠️ server-only: never bundled for the browser
│   │   ├── supabase-admin.ts  # service-role client
│   │   ├── plaid.ts           # Plaid client + Link tokens
│   │   ├── sync.ts            # accounts, transactions (cursor sync), recurring, holdings
│   │   ├── categorize.ts      # rules → Claude → Plaid fallback
│   │   ├── insights.ts        # AI advice from aggregates
│   │   ├── crypto.ts          # AES-256-GCM token encryption
│   │   └── guards.ts          # requireUser / requireOwnedItem / readJson
│   ├── components/            # UI + charts (Sankey, columns, lines, bar lists)
│   ├── supabase/              # typed browser client, Database types, DB_SCHEMA
│   ├── finance.ts             # income/expense aggregation model
│   └── icons.ts               # Material Symbols registry (font is subset to these)
├── routes/
│   ├── (auth)/                # login, signup, forgot-password
│   ├── (app)/                 # authenticated app (dashboard, reports, …)
│   └── api/                   # plaid/*, sync, categorize, insights, cron
supabase/migrations/           # equyty schema: tables, RLS, grants, RPCs, default categories
```

## Design notes

- **Type:** [Geist](https://fonts.google.com/specimen/Geist) for everything, with tabular numerals in tables. **Icons:** Material Symbols Rounded, subset through `icon_names=` so the font stays small.
- **Charts** use a categorical palette checked for color-vision-deficiency separation in both light and dark mode. Every chart has direct labels or a tooltip, and the Sankey has a table view.
- Light and dark themes follow the OS, with a manual override in the user menu.
