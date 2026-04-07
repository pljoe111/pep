# Screen: My Account

**Route:** `/account`  
**Auth:** Required

---

## Purpose

Personal account settings. The user manages their identity, credentials, email verification, and notification preferences.

---

## What the Screen Shows

### Profile

- Username (editable).
- Email address (read-only display; shown with verified / unverified status).
- Account creation date.

### Email Verification

If the user's email is not yet verified, this section is prominent and actionable. It shows:

- A clear statement that email verification is required to contribute to campaigns.
- A "Resend verification email" action. Rate-limited to prevent abuse.
- Once verified, this section disappears or changes to a confirmed state.

### Change Password

A form with the following fields:

- Current password.
- New password.
- Confirm new password.

Submitting updates the password. All existing sessions other than the current one are invalidated.

### Notification Preferences

The user can control which notification types they receive and through which channels (in-app, email).

Configurable events include:

- Campaign funded (creator).
- Campaign locked (contributor).
- Samples shipped (contributor).
- COA rejected (creator).
- COA approved (creator).
- Campaign resolved (both roles).
- Campaign refunded (both roles).
- Deposit confirmed.
- Withdrawal sent / failed.

---

## Actions

| Action                        | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| Update username               | Changes the display name. Must be unique across the platform.         |
| Resend verification email     | Sends a new email verification link.                                  |
| Change password               | Requires the current password. Invalidates other sessions on success. |
| Save notification preferences | Persists which channels (in-app / email) are active per event type.   |
| Log out                       | Clears the session and navigates to the login screen.                 |

---

## Notes

- Changing the username is reflected immediately everywhere it is displayed (campaign cards, contribution lists, etc.).
- There is no account deletion flow in scope at this time.
- Avatar / profile image is not in scope; initials-based avatar is derived from username automatically.
