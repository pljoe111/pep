# Screen: My Campaigns

**Route:** `/my-campaigns`  
**Auth:** Required

---

## Purpose

A creator's personal dashboard showing every campaign they have created, with actions appropriate to each campaign's current status.

---

## What the Screen Shows

A list of the authenticated user's campaigns. Each entry shows:

- Campaign title (links to the campaign detail page).
- Current status.
- Whether the campaign is flagged for review.
- Current funding amount and goal.
- Funding progress as a percentage.

The list is filterable by status: All, Open, Funded, In Lab, Resolved.

---

## Actions Per Campaign

Actions available depend on the campaign's status.

| Status              | Available Actions                                                          |
| ------------------- | -------------------------------------------------------------------------- |
| `created`           | View, Edit (title + description only), Delete (only if zero contributions) |
| `funded`            | View                                                                       |
| `samples_sent`      | View                                                                       |
| `results_published` | View                                                                       |
| `resolved`          | View                                                                       |
| `refunded`          | View                                                                       |

**Edit** opens an inline form (or sheet) pre-filled with the current title and description. Samples, tests, and financial parameters cannot be changed after creation.

**Delete** requires an explicit confirmation step. It is only available for campaigns in `created` status with zero contributions raised.

---

## Navigating to Create

A "New Campaign" shortcut is available on this screen, navigating to `/create`.

---

## Empty State

If the user has no campaigns, a prompt is shown to create their first one.

---

## Notifications Surfaced Here

This screen does not generate notifications, but the list reflects real-time status changes that are triggered by notifications elsewhere:

- A campaign moving to `funded` (threshold crossed).
- A campaign moving to `resolved` (payout processed).
- A campaign moving to `refunded` (admin force-refund or auto-refund).

The creator learns of these events through the notification centre; this list shows the resulting updated status.
