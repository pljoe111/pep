```
You are working on PepLab — a React + TypeScript frontend (packages/fe).

## Stack
- React 18, TypeScript 5.3, Vite 5
- Tailwind CSS v4 (no config file — use @theme in index.css)
- React Router v7, TanStack Query v5, react-hook-form v7
- API types come from packages/api-client only — never define your own API shapes

## Hard Rules

### No external component libraries
No shadcn, MUI, Chakra, or any UI library.
All components live in packages/fe/src/components/ui/ and use Tailwind utilities directly.

### No direct API types
Never define interfaces that mirror API responses.
Always import from api-client.

### No direct env access
Never use import.meta.env.X in components.
Always go through config.ts.

### No icon libraries
All icons are inline SVG as JSX with active/inactive variants.

### No direct fetch calls
All server state goes through TanStack Query hooks.
All API calls go through the singleton clients in api/apiClient.ts.

## Colors — use semantic tokens only for UI chrome
--color-primary    #0D9488   → buttons, links, active nav, focus rings
--color-primary-d  #0F766E   → button hover/active
--color-primary-l  #CCFBF1   → ghost hover, tint backgrounds
--color-bg         #F5F4F1   → page background
--color-surface    #FFFFFF   → cards, modals, inputs
--color-surface-a  #FAFAF9   → secondary areas, secondary button hover
--color-border     #E7E5E4   → all borders and dividers
--color-text       #1C1917   → body text
--color-text-2     #78716C   → secondary: timestamps, descriptions
--color-text-3     #A8A29E   → tertiary: placeholders
--color-success    #059669
--color-warning    #D97706
--color-danger     #DC2626
--color-info       #2563EB

Use Tailwind palette (amber-, emerald-, red-, etc.) ONLY for Badge status variants.
Never use cold/blue-gray anywhere — all grays are warm stone family.

## Typography
- Hero numbers / wallet balance: text-4xl font-extrabold (800)
- Page headings: text-3xl font-bold (700)
- Campaign card titles: text-2xl font-bold (700)
- Section headings: text-xl font-semibold (600)
- Body: text-base font-normal (400)
- Secondary info: text-sm font-normal (400)
- Labels / badges: text-xs font-medium (500)
System UI font stack only — no web fonts.

## Layout & Spacing
- All pages wrap in AppShell (TopBar + BottomNav + PageContainer)
- BottomNav: Home, Create, My Campaigns, Wallet
- Cards, inputs, buttons: rounded-xl (12px) consistently
- All interactive elements: min-h-[44px] — no exceptions
- Mobile-first, target 375px screens
- Safe-area insets respected: env(safe-area-inset-bottom)

## Components — existing variants, don't invent new ones
Button: variant (primary/secondary/ghost/danger) × size (sm/md/lg) × loading + fullWidth
Badge: amber/blue/purple/indigo/green/red/gray/teal
sm buttons (h-36px) only in dense admin table rows — everywhere else 44px minimum

## Patterns
- Auth state → AuthContext only (useAuth hook)
- All other server state → TanStack Query
- Query keys → api/queryKeys.ts
- Mobile flows → Sheet (bottom drawer), not Modal
- Browsing lists → infinite scroll
- Admin/management lists → pagination
- Progress bar fill → teal-400 (#2DD4BF)

## Before marking anything done
- No TypeScript errors
- No eslint-disable in any form
- No hardcoded hex values — use semantic tokens or Tailwind palette
- No new UI primitives without adding to components/ui/
- Renders correctly at 375px width
```
