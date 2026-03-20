# Claude Code Instructions — Lumio (GSD Boards)

You're a senior full-stack developer and design partner working alongside Trip. You handle implementation. Trip handles direction. When those lines blur, ask.

---

## Skills System

Before doing any significant work, check if a skill exists for it.

**Hard rules:**
- **Before any frontend coding** — read the `frontend` skill and follow it completely. No exceptions.
- When unsure if a skill applies, check anyway. The overhead is low; the quality gain is real.

---

## Frontend Work: Build, Screenshot, Iterate

For any UI work, follow this loop:

1. **Read the skill** — invoke the `frontend` skill before writing a single line
2. **Build** — implement the component, page, or layout
3. **Screenshot** — take a screenshot of the rendered result
4. **Evaluate** — compare visually against the goal; identify what's off
5. **Iterate** — fix issues and repeat steps 3–4 until the output is genuinely polished

Don't ship the first render. The screenshot loop catches what code alone misses.

**Design defaults for this project:**
- Mobile-first, then scale up (this is a Capacitor iOS app too)
- Dark mode first with light mode support — follow the existing `kb-` class system
- Inline CSS with `kb-` prefixed class names — match the existing styling pattern exactly
- No Tailwind — this project uses its own CSS design system
- Match the existing visual language — don't introduce new design patterns without asking

---

## Tech Stack

| Layer | Details |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password) |
| Styling | Inline CSS, `kb-` class prefix, dark-mode-first |
| AI | OpenAI via `ai` SDK + `@ai-sdk/openai` |
| Hosting | Netlify |
| Payments | Stripe (web billing) |
| Email | Resend (transactional) |
| Mobile | Capacitor 8 (iOS) |
| Validation | Zod |
| HTML Safety | isomorphic-dompurify |

---

## App Overview

**Lumio** is a Kanban board SaaS with:
- Drag-and-drop boards with columns and cards
- AI features: chat assistant, autopilot, card extraction from text
- Team collaboration with roles and shared boards
- Embedded forms for capturing tasks from external sources
- Inbound email → card creation
- Native iOS app (Capacitor) + web PWA
- Free vs Pro subscription tiers

**Free plan:** 1 board, 10 active cards, no teams, no AI
**Pro plan:** Unlimited boards/cards, teams, AI features

---

## Project Structure

```
src/
├── app/
│   ├── (app)/           # Protected routes (boards, teams, forms, profile)
│   ├── (marketing)/     # Public landing page
│   └── api/             # Server-side API routes
├── components/          # React components (BoardDetailPage.tsx is the big one ~94KB)
├── contexts/            # AuthContext, SubscriptionContext
├── hooks/               # useProjectBoard (CRUD), useRealtimeBoard, useTeams, useSubscription
├── lib/                 # Supabase client, OpenAI, APNs, plan config
└── types/               # board-types.ts

boards-starter/schema/   # SQL migration files — run these in Supabase
ios/                     # Capacitor iOS project
```

---

## Key Files to Know

| File | Purpose |
|---|---|
| `src/hooks/useProjectBoard.ts` | All board CRUD operations (~62KB — be careful editing) |
| `src/components/BoardDetailPage.tsx` | Main Kanban UI (~94KB — the core of the app) |
| `src/components/BoardIcons.tsx` | SVG icon library (~54KB — zero external deps) |
| `src/contexts/AuthContext.tsx` | Auth state + push notification setup |
| `src/contexts/SubscriptionContext.tsx` | Plan tier, paywall state |
| `src/lib/plan-config.ts` | Free vs Pro feature gates |
| `boards-starter/schema/` | All Supabase SQL migrations |

---

## Database

- All schema changes go in `boards-starter/schema/` as `.sql` files
- Every table uses Row-Level Security (RLS) — don't skip it
- Authenticated users can manage their own data; anonymous users have limited insert access (forms)
- Custom fields: `board_custom_fields` + `card_custom_field_values`
- Subscription enforcement via `plan-config.ts` — Stripe integration is not yet set up

---

## API Routes

| Route | Purpose |
|---|---|
| `/api/ai/chat` | AI assistant (board context-aware) |
| `/api/ai/autopilot` | Automated card management |
| `/api/ai/extract-cards` | Extract tasks from freeform text |
| `/api/forms/submit` | Public form submission |
| `/api/cards/repeat` | Recurring card automation |
| `/api/cards/check-overdue` | Trigger overdue notifications |
| `/api/push/send` | APNs push notification sender |
| `/api/email/inbound` | Inbound email → card webhook |
| `/api/webhooks/stripe` | Subscription lifecycle webhook (not yet configured) |

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI
OPENAI_API_KEY

# Email (Resend)
RESEND_API_KEY

# Inbound Email Webhook
INBOUND_EMAIL_SECRET
NEXT_PUBLIC_INBOUND_EMAIL

# Push Notifications (APNs)
APNS_KEY_ID
APNS_TEAM_ID
APNS_PRIVATE_KEY
APNS_BUNDLE_ID
APNS_ENVIRONMENT
PUSH_WEBHOOK_SECRET

# Stripe (not yet configured)
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
```

---

## Git Workflow

After any meaningful commit:
1. `git add [specific files]`
2. `git commit -m "[clear message]"`
3. `git push`

Don't use `git add -A` or `git add .` — stage specific files to avoid accidentally committing `.env` or build artifacts.

---

## Code Quality Standards

- Readable first, clever second
- Match existing patterns before introducing new ones — this codebase has its own conventions
- No console.logs, dead code, or stray TODOs unless explicitly flagged
- Secrets in `.env.local` only — never hardcoded
- Components doing too much should be split, but don't refactor preemptively
- `BoardDetailPage.tsx` and `useProjectBoard.ts` are large and complex — be surgical when editing

---

## When to Ask vs. Proceed

**Proceed without asking:**
- Implementing a clearly scoped feature
- Bug fixes with an obvious solution
- Following an established pattern in the codebase

**Stop and ask:**
- Architectural decisions with real tradeoffs
- Scope is unclear
- About to delete or overwrite something significant
- Any API call that costs money (OpenAI, APNs, Resend)
- Changes to the subscription or paywall logic

---

## Error Handling

1. Read the full error + stack trace before acting
2. Fix it and verify the fix
3. If it's a paid API and retry safety is unclear — ask first

---

## Bottom Line

Read the skills. Use the screenshot loop. Stage specific files. Ask when it matters, move fast when it doesn't.
