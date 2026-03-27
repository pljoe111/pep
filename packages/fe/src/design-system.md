# PepLab Design System

## Brand

**Name:** PepLab  
**Tagline:** Community-funded science. Verified results.  
**Short name:** PepLab (PWA short_name: PepLab)

**Reasoning:** "Pep" is an abbreviation for peptide, and "Lab" signals science, testing, and verified results. Together it reads as active, participatory, and community-oriented — not a clinical service or crypto project.

---

## Color Palette

| Role            | Name            | Hex       | Tailwind Token      |
| --------------- | --------------- | --------- | ------------------- |
| Primary         | Teal            | `#0D9488` | `--color-primary`   |
| Primary Dark    | Teal Dark       | `#0F766E` | `--color-primary-d` |
| Primary Light   | Teal Light      | `#CCFBF1` | `--color-primary-l` |
| Background      | Warm Off-White  | `#F5F4F1` | `--color-bg`        |
| Surface         | White           | `#FFFFFF` | `--color-surface`   |
| Surface Alt     | Warm Gray 50    | `#FAFAF9` | `--color-surface-a` |
| Border          | Stone 200       | `#E7E5E4` | `--color-border`    |
| Text Primary    | Warm Near-Black | `#1C1917` | `--color-text`      |
| Text Secondary  | Stone 500       | `#78716C` | `--color-text-2`    |
| Text Tertiary   | Stone 400       | `#A8A29E` | `--color-text-3`    |
| Success         | Emerald 600     | `#059669` | `--color-success`   |
| Warning         | Amber 600       | `#D97706` | `--color-warning`   |
| Danger          | Red 600         | `#DC2626` | `--color-danger`    |
| Info            | Blue 600        | `#2563EB` | `--color-info`      |
| Funded-progress | Teal 400        | `#2DD4BF` | (inline)            |

**Reasoning:**

- **Teal primary** — warm enough to feel community-driven, scientific enough to signal precision. Not amber (too casual) or pure blue (too bank-like). Teal is the sweet spot.
- **Warm off-white background** — `#F5F4F1` avoids clinical pure-white while keeping readability high. Matches Reddit's warm content-focused feel.
- **Stone grays for text** — warm undertone keeps the palette cohesive.
- **High-contrast text** — `#1C1917` on `#F5F4F1` satisfies WCAG AA at all text sizes.

### Campaign Status → Badge Color Mapping

| Status              | Badge Color |
| ------------------- | ----------- |
| `created`           | Amber       |
| `funded`            | Blue        |
| `samples_sent`      | Purple      |
| `results_published` | Indigo      |
| `resolved`          | Green       |
| `refunded`          | Red         |

### Verification Status → Badge Color Mapping

| Status              | Badge Color |
| ------------------- | ----------- |
| `pending`           | Gray        |
| `code_found`        | Green       |
| `code_not_found`    | Amber       |
| `manually_approved` | Green       |
| `rejected`          | Red         |

---

## Typography

Base: System UI stack — `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`  
Font is not web-loaded to keep bundle small and ensure first render is fast.

| Scale  | Size | Weight | Line Height | Usage                        |
| ------ | ---- | ------ | ----------- | ---------------------------- |
| `4xl`  | 36px | 800    | 1.1         | Hero numbers, wallet balance |
| `3xl`  | 30px | 700    | 1.2         | Page headings                |
| `2xl`  | 24px | 700    | 1.25        | Campaign card titles         |
| `xl`   | 20px | 600    | 1.3         | Section headings             |
| `lg`   | 18px | 600    | 1.4         | Card sub-headings            |
| `base` | 16px | 400    | 1.5         | Body text, descriptions      |
| `sm`   | 14px | 400    | 1.5         | Secondary info, timestamps   |
| `xs`   | 12px | 500    | 1.4         | Labels, badges               |

**Reasoning:** Large sizes for campaign titles and money amounts keep everything legible on a phone held at arm's length. The weight scale (400 → 800) creates strong hierarchy without needing color shifts.

---

## Spacing Scale

Tailwind default scale is used. Key values:

| Token | px  | Usage                                |
| ----- | --- | ------------------------------------ |
| `1`   | 4   | Icon gaps, tight inline elements     |
| `2`   | 8   | Badge internal padding               |
| `3`   | 12  | Input padding (y), small card gaps   |
| `4`   | 16  | Standard component padding           |
| `5`   | 20  | Card padding (mobile)                |
| `6`   | 24  | Section padding                      |
| `8`   | 32  | Large section gaps                   |
| `10`  | 40  | Minimum tap target size (44px ≈ p-3) |
| `16`  | 64  | Page-level vertical rhythm           |

**Reasoning:** Generous spacing avoids cramped UI. Cards use 20px padding to breathe. All interactive targets meet the 44×44px minimum.

---

## Component Decisions

### Pagination: Infinite Scroll (Home) vs Pages (Admin/Wallet)

- **Home page uses infinite scroll** — contributors are browsing, not looking for a specific item. Swipe-to-load-more matches mobile native patterns.
- **Admin, Wallet, and Campaign contributions use page-based pagination** — admins need to jump to specific records; wallet transactions have clear page-numbered history.

### Mobile Sheet Pattern

- Contribute, deposit QR, and admin modals use `Sheet` (slides from bottom) on mobile
- On desktop (md+) these become centered modals
- Backdrop click always dismisses

### Form Keyboard Types

- Amount inputs: `inputMode="decimal"`
- Solana addresses: `inputMode="none"` (prevents mobile autocorrect/autocomplete)
- Email: `type="email"` (triggers email keyboard)

---

## Installed Packages

| Package                  | Version | Reason                                        |
| ------------------------ | ------- | --------------------------------------------- |
| `@tanstack/react-query`  | v5      | Server state management, caching, refetch     |
| `react-hook-form`        | latest  | Form state, validation, uncontrolled inputs   |
| `qrcode.react`           | latest  | Render deposit address as QR code             |
| `tailwindcss`            | v4      | Utility-first styling                         |
| `@tailwindcss/vite`      | v4      | Vite plugin for Tailwind v4                   |
| `vite-plugin-pwa`        | latest  | PWA manifest, service worker, offline support |
| `prettier`               | latest  | Code formatting (required by eslint config)   |
| `eslint-plugin-prettier` | latest  | Enforces prettier as eslint rule              |

---

## PWA Configuration

- **App name:** PepLab
- **Short name:** PepLab
- **Theme color:** `#0D9488` (primary teal)
- **Background color:** `#F5F4F1` (warm off-white)
- **Display mode:** standalone
- **Icon:** SVG of beaker/flask symbol — fits the lab/science theme
- **Offline fallback:** `/offline` route shown for data routes when network unavailable
- **Campaign feed stale time:** 5 minutes (TanStack Query `staleTime: 300_000`)
