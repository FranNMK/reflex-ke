# Add Rider — Dispatcher Dashboard Feature Plan

## Top-Level Overview

The Dispatcher dashboard needs a dedicated **"Riders" panel** where a dispatcher can see all current riders and add new ones. The backend already has `POST /auth/register` which handles user creation. The frontend needs a new tab-style panel on the Dispatcher page with a form (name + phone only) that calls register, auto-generates a default password, and refreshes the rider list immediately after success.

**Scope:**
- Backend: one small change — make `POST /auth/register` accessible to authenticated dispatchers (currently it is open/unprotected, but we need to confirm it stays accessible or gets guarded)
- Frontend: extend `DispatcherPage.tsx` with a fourth panel ("Riders"), a form with name + phone, auto-generated password display, and a live rider list

**Non-goals:**
- No password change/reset flow
- No delete/deactivate rider
- No email notifications
- No separate page/route — it lives entirely within the existing Dispatcher dashboard

**UI navigation:** Tab-based. The existing Open Requests / In Progress / Delivered sections become tabs. "Riders" is the fourth tab. Clicking a tab shows only that panel — all others are hidden.

**Password format:** `rider-XXXX` where XXXX is a 4-digit random number (e.g. `rider-4821`). Easy to read aloud and type on a phone.

---

## Sub-Tasks

### Sub-Task 1 — Backend: auto-generate default password in register endpoint

**Intent:**
The dispatcher provides only a name and phone number. The backend must generate a secure default password, register the rider, and return the plain-text password once (so the dispatcher can share it). The existing `POST /auth/register` endpoint requires a `password` field in the request body — we need a new dispatcher-facing endpoint (or an override flag) that generates the password server-side and returns it in the response.

The cleanest approach: add `POST /users/riders` — a dispatcher-only endpoint that accepts `{name, phone}`, generates a random 8-character alphanumeric password, calls the same user-creation logic, and returns `{id, name, phone, role, temp_password}`. This keeps the existing `/auth/register` unchanged.

**Expected Outcomes:**
- `POST /users/riders` endpoint exists, protected by `dispatcher` role
- Accepts `{ "name": "...", "phone": "..." }`
- Returns `{ "id": ..., "name": "...", "phone": "...", "role": "rider", "temp_password": "..." }`
- Returns HTTP 409 if phone already registered
- `temp_password` is a random 8-character alphanumeric string (e.g. `Rd4kX9mP`)
- Password is stored as a bcrypt hash; the plain-text is returned once and never stored

**Todo List:**
1. Add `RiderCreateRequest` schema (`name: str`, `phone: str`) and `RiderCreatedOut` schema (extends `UserOut` with `temp_password: str`) to `backend/app/schemas.py`
2. Add `POST /users/riders` to `backend/app/routers/users.py`, guarded by `dispatcher` role via `get_current_user` dependency
3. Implement random password generation: `f"rider-{secrets.randbelow(9000) + 1000}"` — produces `rider-1000` through `rider-9999`

**Relevant Context:**
- `backend/app/routers/users.py` — add the new endpoint here alongside existing `GET /users`
- `backend/app/schemas.py` — add new schemas at the bottom of the Users section
- `backend/app/auth.py` — `hash_password()` is the function to call
- `backend/app/dependencies.py` — `get_current_user` dependency for role enforcement
- Pattern to follow: `POST /deliveries` in `deliveries.py` — uses `get_current_user`, checks role, returns typed response

**Status:** [x] done — `RiderCreateRequest` + `RiderCreatedOut` schemas in `schemas.py`; `POST /users/riders` in `routers/users.py`; deployed and verified on live Railway backend (rider-8016 temp password generated, new rider logged in successfully)

---

### Sub-Task 2 — Frontend: "Riders" panel on Dispatcher dashboard

**Intent:**
Add a fourth panel to `DispatcherPage.tsx` alongside the existing three (Open, In Progress, Delivered). The panel has two parts:
1. **Add Rider form** — name input, phone input, "Add Rider" button with loading state
2. **Rider list** — shows all current riders (re-uses the already-fetched `riders` state), refreshes immediately after a successful add

When a rider is successfully added, show the generated `temp_password` clearly so the dispatcher can copy and share it. The password reveal stays visible until the dispatcher adds another rider or navigates away.

**Expected Outcomes:**
- "Riders" tab/panel header appears alongside "Open Requests", "In Progress", "Delivered"
- Form has: Name field, Phone field, "Add Rider" button
- Button shows "Adding…" during the request and is disabled
- On success: form clears, temp password displayed in a highlighted box ("Share this password with the rider: `Rd4kX9mP`"), rider list updates immediately
- On error (e.g. phone already exists): inline error message shown in red
- Rider list shows name, phone for each rider with a count badge
- Styling matches existing inline CSS pattern in `DispatcherPage.tsx`

**Todo List:**
1. Convert the three existing sections (Open Requests, In Progress, Delivered) into a tab-based UI — add `activeTab` state (`"open" | "inprogress" | "delivered" | "riders"`), render tab bar at top, show only the active tab's content
2. Add state for the Riders panel: `newRiderName`, `newRiderPhone`, `addingRider`, `addRiderError`, `addRiderSuccess` (holds `{name, temp_password}` or null)
3. Add `addRider()` function that calls `api.post<RiderCreated>("/users/riders", {name, phone})` and on success refreshes `riders` by calling `fetchRiders()` immediately
4. Add the Riders tab content — Add Rider form + rider list — styled consistently with existing inline CSS patterns

**Relevant Context:**
- `frontend/src/pages/DispatcherPage.tsx` — the only file to change
- `frontend/src/api.ts` — `api.post<T>(path, body)` pattern to use
- Existing `riders` state is already populated via `GET /users?role=rider` — reuse it
- Password reveal box: style like the `error` style but in green/blue to indicate success — use `background: "#f0fdf4"`, `border: "1px solid #86efac"`, `color: "#166534"`

**Status:** [x] done — `DispatcherPage.tsx` converted to 4-tab layout (Open Requests / In Progress / Delivered / Riders); Add Rider form with name+phone inputs, loading state, green temp-password success box, and immediate rider list refresh; deployed to Railway

---

## Design Diagram

See chat response for the Mermaid flow diagram showing the add-rider interaction.

---

## Named Decisions

| Decision | Choice | Reason |
|---|---|---|
| New endpoint vs. modify existing register | New `POST /users/riders` | Keeps `/auth/register` unchanged; enforces dispatcher-only access cleanly |
| Password format | `rider-XXXX` 4-digit number | Easy to read aloud and type on a phone |
| Dashboard navigation | Tab-based, replaces scrolling sections | Cleaner UX; one focused view at a time |
| Where temp password is shown | Green highlight box in the Riders tab | Stays visible until next action; no separate modal needed |
| Rider list refresh | Immediate re-fetch after successful add | Consistent with polling pattern already used for deliveries |
