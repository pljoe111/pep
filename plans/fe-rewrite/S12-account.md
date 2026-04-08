# S12 — AccountPage Rewrite

**Depends on:** S02 (notification center must be built so TopBar already has the bell)  
**Unlocks:** nothing downstream (final story)

---

## Purpose

Decompose `src/pages/AccountPage.tsx` (151 lines) into a feature folder with proper separation between profile, email verification, password change, and notification preferences. Also adds the **Logout** action prominently at the bottom.

---

## Update `src/routes/index.tsx`

Change the `AccountPage` import to:

```ts
import AccountPage from '../pages/account/AccountPage';
```

---

## Files to Create

```
src/pages/account/
├── AccountPage.tsx                    ← NEW (thin orchestrator)
└── components/
    ├── ProfileSection.tsx             ← NEW
    ├── EmailVerificationSection.tsx   ← NEW
    ├── ChangePasswordForm.tsx         ← NEW
    └── NotificationPrefsForm.tsx      ← NEW
```

---

## Hooks to Use

### Existing

```ts
useAuth(); // from src/hooks/useAuth.ts — provides user, logout
```

### Add to `src/api/hooks/useUser.ts` (create this file if it doesn't exist)

```ts
// src/api/hooks/useUser.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { userApi } from '../apiClient'; // check singleton name in apiClient.ts

export function useUpdateUsername() {
  // PATCH /users/me/username  { username: string }
  // invalidates queryKeys.auth.me on success
}

export function useChangePassword() {
  // PATCH /users/me/password  { currentPassword, newPassword }
}

export function useResendVerificationEmail() {
  // POST /auth/resend-verification
}

export function useNotificationPreferences() {
  // GET /users/me/notification-preferences  → NotificationPreferencesDto
}

export function useUpdateNotificationPreferences() {
  // PUT /users/me/notification-preferences  → NotificationPreferencesDto
  // invalidates queryKeys.auth.me on success
}
```

Check `src/api/apiClient.ts` for the actual API singleton name (likely `usersApi` and `authApi`). Check `packages/common/src/dtos/user.dto.ts` for the exact DTO shapes.

---

## 1. `AccountPage.tsx` (orchestrator)

```tsx
<AppShell>
  <PageContainer>
    <h1 className="text-3xl font-bold text-text mb-6">My Account</h1>

    <ProfileSection />
    <EmailVerificationSection />
    <ChangePasswordForm />
    <NotificationPrefsForm />

    {/* Logout — always at bottom */}
    <div className="pt-4 pb-8">
      <Button
        variant="ghost"
        fullWidth
        size="md"
        onClick={logout}
        className="text-danger hover:bg-red-50"
      >
        <LogOut size={16} className="mr-2" />
        Log Out
      </Button>
    </div>
  </PageContainer>
</AppShell>
```

- `logout` comes from `useAuth()`
- `LogOut` icon from lucide-react

Each section is visually separated with `mb-6`. Sections are self-contained — they manage their own loading, error, and form state internally.

---

## 2. `ProfileSection.tsx`

Displays and allows editing of the username.

```tsx
// No props — reads from useAuth()
```

**Layout:**

```
┌────────────────────────────────────────────────────┐
│  Profile                                           │
│  ─────                                             │
│  [Avatar — initials from username — large]         │
│                                                    │
│  Username                                          │
│  [ currentUsername input ]    [ Save ]             │
│                                                    │
│  Email          carlos@example.com                 │
│  Account created  Jan 15, 2025                     │
└────────────────────────────────────────────────────┘
```

**Behaviour:**

- `Avatar` from `src/components/ui/Avatar` at size `lg` (or largest available prop)
- Username input: pre-filled with `user.username`; editable; `min-h-[44px]`
- "Save" button: `variant="primary" size="sm"` (in a row with the input); disabled when value matches current username or is empty
- Calls `useUpdateUsername()` mutation on save; success toast `"Username updated"`; invalidates auth query so TopBar and other components refresh
- Email: read-only `text-sm text-text-2`; prefixed with label
- Account created: read-only `text-sm text-text-3`; `formatDate(user.createdAt)` from `src/lib/formatters`
- Section heading: `text-xl font-semibold text-text mb-4` with a `divider` below (a `1px border-b border-border`)

---

## 3. `EmailVerificationSection.tsx`

Only visible when the user's email is **not** yet verified.

```tsx
// No props — reads from useAuth()
```

**When email is verified:** render nothing (`return null`)

**When email is NOT verified:**

```
┌────────────────────────────────────────────────────┐
│  ⚠ Email Verification Required                     │
│  ─────────────────────────────                     │
│  Your email is not verified. You must verify your  │
│  email to contribute to campaigns.                 │
│                                                    │
│  Verification email sent to: carlos@example.com    │
│                                                    │
│  [ Resend verification email ]                     │
│                                                    │
│  (After verifying, refresh the page.)              │
└────────────────────────────────────────────────────┘
```

**Styling:**

- Container: `bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6`
- Heading: `text-sm font-semibold text-amber-800` with `AlertTriangle` icon (lucide-react)
- Body: `text-sm text-amber-700`
- "Resend" button: `Button variant="secondary" size="md" fullWidth`
  - Calls `useResendVerificationEmail()` mutation
  - After success: button temporarily disabled with label "Email sent ✓" for 60 seconds (use `useState<number>(0)` cooldown countdown via `setInterval`)
  - Error: toast with error message
  - Rate limit error (HTTP 429): toast `"Please wait before requesting another email."`
- Note below button: `text-xs text-amber-600 text-center`

---

## 4. `ChangePasswordForm.tsx`

```tsx
// No props — uses useChangePassword()
```

**Layout:**

```
Change Password
───────────────

Current password     [ ••••••••  👁 ]
New password         [ ••••••••  👁 ]
Confirm new password [ ••••••••  👁 ]

[ Change Password ]
```

**Behaviour:**

- Use `react-hook-form` for all 3 fields
- Each password input has a show/hide toggle (`Eye` / `EyeOff` from lucide-react) — local state per field
- Validation:
  - `currentPassword`: required
  - `newPassword`: required, min 8 chars
  - `confirmPassword`: must match `newPassword` — use `watch('newPassword')` in the validate function
- On submit: call `useChangePassword({ currentPassword, newPassword })`
- Success: toast `"Password changed. Other sessions have been signed out."` + reset form
- Error 401 / wrong password: set form error on `currentPassword` field: `"Incorrect current password"`
- `Button variant="primary" fullWidth size="lg"` below form; `loading` while mutation in-flight
- Section heading same style as ProfileSection

---

## 5. `NotificationPrefsForm.tsx`

```tsx
// No props — uses useNotificationPreferences() and useUpdateNotificationPreferences()
```

**What to render:**

A list of toggleable notification events. Each row has:

- Event label
- Two toggles: **In-app** and **Email**

```
Notification Preferences
────────────────────────

Event                            In-app   Email
─────────────────────────────────────────────────
Campaign funded (creator)          [✓]      [✓]
Campaign locked (contributor)      [✓]      [✓]
Samples shipped (contributor)      [✓]      [✓]
COA rejected (creator)             [✓]      [✓]
COA approved (creator)             [✓]      [✓]
Campaign resolved                  [✓]      [✓]
Campaign refunded                  [✓]      [✓]
Deposit confirmed                  [✓]      [✓]
Withdrawal sent / failed           [✓]      [✓]

[ Save Preferences ]
```

**Toggle component:**
Use a simple styled `<input type="checkbox">`:

```tsx
<label className="relative flex items-center cursor-pointer">
  <input type="checkbox" className="sr-only" checked={...} onChange={...} />
  <div className={`w-10 h-6 rounded-full transition-colors ${
    checked ? 'bg-primary' : 'bg-border'
  }`}>
    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ml-0.5 ${
      checked ? 'translate-x-4' : 'translate-x-0'
    }`} />
  </div>
</label>
```

(A custom CSS toggle built with Tailwind — no external package.)

**Behaviour:**

- Load preferences with `useNotificationPreferences()`
- Local form state mirrors the DTO; changes are tracked locally
- "Save Preferences" button: `variant="primary" fullWidth size="lg"`; disabled when no changes; calls `useUpdateNotificationPreferences(payload)` on click
- Success toast: `"Notification preferences saved"`
- Loading skeleton: while fetching initial prefs, show a `Spinner` centred in the section

**DTO Shape** (from `packages/common/src/dtos/user.dto.ts` — verify exact field names):

```ts
interface NotificationPreferencesDto {
  campaign_funded_in_app: boolean;
  campaign_funded_email: boolean;
  campaign_locked_in_app: boolean;
  campaign_locked_email: boolean;
  samples_shipped_in_app: boolean;
  samples_shipped_email: boolean;
  coa_rejected_in_app: boolean;
  coa_rejected_email: boolean;
  coa_approved_in_app: boolean;
  coa_approved_email: boolean;
  campaign_resolved_in_app: boolean;
  campaign_resolved_email: boolean;
  campaign_refunded_in_app: boolean;
  campaign_refunded_email: boolean;
  deposit_confirmed_in_app: boolean;
  deposit_confirmed_email: boolean;
  withdrawal_in_app: boolean;
  withdrawal_email: boolean;
}
```

Always use the actual generated API client types — the names above are illustrative.

---

## Acceptance Criteria

- [ ] ProfileSection shows avatar, editable username, read-only email and join date
- [ ] Saving a username change shows success toast and updates the displayed name
- [ ] `EmailVerificationSection` is hidden when email is verified; visible with amber styling when not
- [ ] Resend button has 60-second cooldown after sending
- [ ] `ChangePasswordForm` validates all 3 fields; confirm must match new password
- [ ] Wrong current password sets form error on that specific field
- [ ] Success toast on password change; form resets
- [ ] `NotificationPrefsForm` loads prefs from API; toggle switches work; "Save" is disabled when no changes made
- [ ] Saving prefs shows success toast
- [ ] Logout button appears at the bottom with red text; clicking it calls `logout()` from `useAuth`
- [ ] All sections have consistent heading styling (`text-xl font-semibold`)
- [ ] Zero TypeScript errors, no `any`, no hardcoded hex
