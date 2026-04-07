# Screen: Home

**Route:** `/`  
**Auth:** Public

---

## Purpose

The public campaign feed. Entry point for contributors discovering campaigns to back.

---

## What the Screen Shows

- A filterable, searchable, paginated list of campaigns.
- Each campaign entry exposes: title, creator username, status, funding progress (current / goal / percentage), vendor name(s), lab name(s), sample labels, and time remaining on the fundraising deadline.
- Campaigns with `is_hidden = true` are not shown to non-admin users.
- Campaigns with `is_flagged_for_review = true` are shown but visually marked as under review.

---

## Filtering & Sorting

Users can filter by campaign status: All, Open (`created`), Funded, In Lab (`samples_sent`), Results Out (`results_published`), Resolved.

Users can search by free text matched against title, peptide name, vendor name, and lab name.

Users can sort by: Newest, Ending Soon, Most Funded, Least Funded.

Filter/sort/search state is preserved in the URL so links are shareable and page refreshes restore context.

---

## Interactions

- Tapping a campaign navigates to the Campaign Detail screen.
- Authenticated users see a notification indicator (with unread count) in the top bar that opens the Notification Centre.
- Unauthenticated users see a sign-in prompt instead of the notification indicator.

---

## Pagination

Feed uses infinite scroll. Next page loads automatically when the user approaches the end of the current list.

---

## Empty States

- No campaigns match the current filter/search: prompt to clear filters.
- Feed is entirely empty: prompt to create the first campaign.

---

## Notifications That Appear Here

None are triggered on this screen itself, but the notification indicator badge updates in real time as new notifications arrive (contributions received, COA status changes, etc.).
