# Rider CRUD — Dispatcher Dashboard Plan

## Top-Level Overview

Extend the existing Riders tab on the Dispatcher dashboard with full CRUD: the dispatcher can already **Create** riders. This plan adds **Read** (already present as a list), **Update** (edit name/phone + reset password with copy button), and **Delete** (with active-delivery guard + confirmation prompt).

**Stack touch-points:**
- Backend: 2 new endpoints on `/users/riders/{id}` — PATCH (update) and DELETE
- Frontend: extend `DispatcherPage.tsx` Riders tab only — inline edit form per rider card + delete button
- Docs: one new CRUD flow diagram exported to `docs/rider-crud-flow.png`

**Non-goals:**
- No role change (riders stay riders)
- No bulk operations
- No separate page or route

---

## Sub-Tasks

### Sub-Task 1 — Backend: PATCH and DELETE /users/riders/{id}

**Intent:**
Add two dispatcher-only endpoints:
- `PATCH /users/riders/{id}` — update `name` and/or `phone`; optionally reset password (if `reset_password: true` in body, generate a new `rider-XXXX` and return `temp_password`)
- `DELETE /users/riders/{id}` — delete the rider; **blocked with HTTP 409** if the rider has any delivery with status `assigned` or `picked_up`

**Expected Outcomes:**
- `PATCH /users/riders/{id}` accepts `{ "name"?: str, "phone"?: str, "reset_password"?: bool }` (all optional)
- On name/phone update: returns updated `UserOut` (no temp_password unless reset_password=true)
- On `reset_password=true`: generates new `rider-XXXX`, stores bcrypt hash, returns `RiderCreatedOut` (includes `temp_password`)
- Returns HTTP 404 if rider id not found or not a rider role
- Returns HTTP 409 if phone already taken by another user
- `DELETE /users/riders/{id}` returns HTTP 204 on success
- Returns HTTP 409 with message "Rider has active deliveries and cannot be removed" if any delivery for that rider has status `assigned` or `picked_up`
- Returns HTTP 404 if rider not found

**Todo List:**
1. Add `RiderUpdateRequest` schema to `backend/app/schemas.py`: `name: Optional[str]`, `phone: Optional[str]`, `reset_password: bool = False`
2. Add `PATCH /users/riders/{id}` to `backend/app/routers/users.py` — dispatcher-only, partial update, conditional password reset
3. Add `DELETE /users/riders/{id}` to `backend/app/routers/users.py` — dispatcher-only, active-delivery guard queries `DeliveryRequest` for `assigned_rider_id == id AND status IN (assigned, picked_up)`

**Relevant Context:**
- `backend/app/routers/users.py` — add both endpoints alongside existing GET and POST
- `backend/app/models/models.py` — `DeliveryRequest` model has `assigned_rider_id` and `status` (use `DeliveryStatus.assigned` and `DeliveryStatus.picked_up`)
- `backend/app/schemas.py` — add `RiderUpdateRequest` in the Users section
- `RiderCreatedOut` already has `temp_password` field — reuse it for the reset-password response path
- `UserOut` — reuse as return type for normal update (no password reset)
- Pattern: dispatcher role check is already in `POST /users/riders` — copy the same guard

**Status:** [ ] pending

---

### Sub-Task 2 — Frontend: Edit and Delete UI on Rider cards

**Intent:**
Each rider card in the Riders tab gets two new action buttons: **Edit** and **Delete**. Clicking Edit expands an inline edit form below the rider card (same card, no modal). The form pre-fills current name and phone, has a "Reset Password" button, and Save/Cancel actions. Clicking Delete shows a browser `confirm()` prompt (if no active deliveries) or an inline error (if blocked by backend 409).

**Expected Outcomes:**
- Each rider card has "Edit" (blue text button) and "Delete" (red text button) on the right side, replacing the static "Rider" badge
- Clicking Edit opens an inline form within the card:
  - Name input (pre-filled)
  - Phone input (pre-filled)
  - "Reset Password" button — calls PATCH with `reset_password: true`; on success shows the new `rider-XXXX` in a green monospace box with a **Copy** button (uses `navigator.clipboard.writeText`)
  - "Save" button — calls PATCH with updated name/phone
  - "Cancel" button — collapses the form, discards changes
- Clicking Delete: calls `window.confirm("Remove [rider name]? This cannot be undone.")` → on confirm, calls DELETE; on backend 409, shows inline red error "This rider has active deliveries and cannot be removed"
- After successful edit: rider list refreshes, card collapses back to read view
- After successful delete: rider list refreshes, card disappears
- Styling: Edit button `color: "#1d4ed8"`, Delete button `color: "#dc2626"`, both `background: none, border: none, cursor: pointer, fontSize: 13, fontWeight: 600` — consistent with existing inline style pattern

**Todo List:**
1. Add `editingRiderId: number | null` state and `editForm: { name: string; phone: string }` state to track which card is in edit mode
2. Add `resetPasswordResult: Record<number, string>` state to hold the newly generated temp password per rider (cleared when edit form closes)
3. Add `riderActionError: Record<number, string>` state for per-card error messages (delete blocked, save conflict, etc.)
4. Add `handleSaveRider(id)` — calls `api.patch("/users/riders/{id}", { name, phone })`, refreshes riders, closes edit form
5. Add `handleResetPassword(id)` — calls `api.patch("/users/riders/{id}", { reset_password: true })`, stores `temp_password` in `resetPasswordResult[id]`
6. Add `handleDeleteRider(id, name)` — `window.confirm` → calls `api.delete` (need to add `delete` method to `api.ts`) → on 409, set `riderActionError[id]`
7. Add `delete` method to `frontend/src/api.ts`: `delete: <T>(path: string) => request<T>("DELETE", path)`
8. Rewrite rider list card JSX to show edit/delete buttons and conditionally render the inline edit form

**Relevant Context:**
- `frontend/src/pages/DispatcherPage.tsx` — Riders tab section is the only area that changes
- `frontend/src/api.ts` — add `delete` method alongside existing get/post/patch
- Inline edit pattern: follow `RetailerPage.tsx` (product stock edit) — same inline expand pattern already exists in the codebase
- `navigator.clipboard.writeText(text)` for the copy button — no library needed
- `window.confirm()` for delete confirmation — already used pattern in RetailerPage

**Status:** [ ] pending

---

### Sub-Task 3 — Docs: CRUD flow diagram

**Intent:**
Generate a sequence diagram image showing the full CRUD lifecycle (Create, Read/List, Update name/phone, Reset Password, Delete with guard) and commit it to `docs/` alongside the existing diagrams. This ensures the docs folder reflects the current implemented state of the Riders feature.

**Expected Outcomes:**
- `docs/rider-crud-flow.png` exists and shows the dispatcher→frontend→backend→TiDB sequence for all 5 operations: list, create (existing), edit, reset password, delete (with guard branch)
- `docs/ProjectRequirementsDocument.md` table in section 12 updated to reference the new diagram
- `docs/ProjectRequirementsDocument.md` API surface table in section 8 updated with the two new endpoints

**Todo List:**
1. Render the CRUD flow Mermaid diagram to a PNG and save as `docs/rider-crud-flow.png`
2. Update section 8 API surface table in `docs/ProjectRequirementsDocument.md` with `PATCH /users/riders/{id}` and `DELETE /users/riders/{id}`
3. Update section 12 Diagrams table with the new file reference

**Relevant Context:**
- `docs/` already contains: `design.png`, `erd.png`, `ridersdesign.png`, `DispercherRiderFlow.png`
- Diagram tool: generate using a Mermaid-to-PNG approach or produce a matching dark-theme sequence diagram consistent with existing docs images
- The diagram must clearly show the delete guard branch: one path for no active deliveries (204) and one for blocked (409)

**Status:** [ ] pending

---

## CRUD Operation Summary

| Operation | Endpoint | Guard | Frontend trigger |
|---|---|---|---|
| Create | `POST /users/riders` | dispatcher role | Add Rider form (existing) |
| Read | `GET /users?role=rider` | dispatcher role | Auto-fetched on tab open + after mutations |
| Update name/phone | `PATCH /users/riders/{id}` | dispatcher role | Save button in inline edit form |
| Reset password | `PATCH /users/riders/{id}` with `reset_password: true` | dispatcher role | Reset Password button in inline edit form |
| Delete | `DELETE /users/riders/{id}` | dispatcher role + no active deliveries | Delete button + window.confirm |

## Named Decisions

| Decision | Choice | Reason |
|---|---|---|
| Edit UI pattern | Inline expand within card | No modal needed; consistent with RetailerPage product edit pattern already in codebase |
| Delete guard | HTTP 409 from backend if active deliveries | Server enforces the rule — not just a frontend check; prevents accidental orphaning |
| Password reset UX | Button within edit form, shows result in green monospace box with Copy button | Dispatcher may reset without changing name/phone — separate action makes intent clear |
| Copy button | `navigator.clipboard.writeText` | No library; works on HTTPS (Railway is HTTPS) |
| Confirm prompt for delete | `window.confirm()` | Consistent with existing product delete in RetailerPage; no extra modal component needed |
