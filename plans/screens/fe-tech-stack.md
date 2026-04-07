# Frontend Tech Stack

Current tools used in `packages/fe`.

---

## Core

| Tool       | Version | Role                      |
| ---------- | ------- | ------------------------- |
| React      | 18      | UI framework              |
| TypeScript | 5.3     | Language                  |
| Vite       | 5       | Build tool and dev server |

---

## Styling

| Tool         | Version | Notes                                                                                                                                              |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind CSS | v4      | No config file. All theme tokens (colors, fonts, spacing) declared via `@theme` in `index.css`. Utilities generated from that theme automatically. |

No external component library. No shadcn, MUI, Chakra, or any other UI kit. All UI primitives (Button, Card, Modal, Sheet, Badge, Input, etc.) are hand-built and live in `packages/fe/src/components/ui/`.

No icon library. All icons are inline SVG written as JSX directly in components.

---

## Routing

| Tool         | Version | Notes                                                                                                                                                                    |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React Router | v7      | Client-side routing. Routes defined in `packages/fe/src/routes/index.tsx`. Two route guards: `ProtectedRoute` (requires auth) and `AdminRoute` (requires `admin` claim). |

---

## Data Fetching & Server State

| Tool                      | Version   | Notes                                                                                                                                                                                                       |
| ------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Query            | v5        | All server data goes through Query hooks. Query keys centralised in `queryKeys.ts`.                                                                                                                         |
| Axios                     | v1.6      | HTTP client. A shared `axiosInstance` handles base URL, JWT attachment, and 401 → silent refresh → retry.                                                                                                   |
| Auto-generated API client | workspace | `packages/api-client` is generated from the BFF's OpenAPI spec (tsoa). Never edited manually. FE imports all API types and request functions from here — no manually defined API shapes anywhere in the FE. |

---

## Forms

| Tool            | Version | Notes                                                                                              |
| --------------- | ------- | -------------------------------------------------------------------------------------------------- |
| react-hook-form | v7      | Used for all multi-field forms. Validation is declared inline on register calls or via Controller. |

---

## Auth State

Auth lives in React Context (`AuthContext`), not TanStack Query. Tokens are stored in `localStorage` so they survive page refresh and are accessible synchronously by the Axios interceptor.

---

## PWA

| Tool            | Notes                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| vite-plugin-pwa | Generates service worker and web app manifest.                                                                          |
| Workbox         | NetworkFirst cache strategy. All API responses cached (max 200 entries, 24h TTL). Offline fallback route at `/offline`. |

Manifest: standalone display mode, portrait orientation, theme colour matches brand primary.

---

## Miscellaneous

| Tool         | Notes                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| qrcode.react | Used only for rendering the Solana deposit address QR code on the Wallet page. |

---

## What Is Explicitly Not Used

- No external component library (shadcn, MUI, Chakra, Radix, etc.)
- No icon library (Heroicons, Lucide, FontAwesome, etc.)
- No CSS-in-JS
- No web fonts (system UI font stack only)
- No global state manager (Redux, Zustand, Jotai) — TanStack Query handles all server state; React Context handles auth
