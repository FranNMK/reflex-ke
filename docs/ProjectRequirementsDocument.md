# Reflex — Project Requirements Document (PRD)

**Version:** 1.1
**Status:** Implementation complete
**Companion files:** [`design.png`](./design.png) · [`erd.png`](./erd.png) · [`../reflex-plan.md`](../reflex-plan.md)

---

## 1. Problem Statement

Small Kenyan retailers — electronics shops, pharmacies, hardware stores — currently coordinate deliveries over WhatsApp messages and phone calls. This creates three concrete operational problems:

1. **No status visibility.** The retailer who logged a delivery has no way to know whether the parcel is in transit or has been delivered without calling the rider directly.
2. **No proof of delivery.** There is no record that a specific rider delivered a specific parcel to a specific customer. Disputes cannot be resolved.
3. **No dispatcher coordination.** When multiple deliveries are open simultaneously, the person assigning riders has no structured view — they work from memory or a shared chat thread that mixes multiple conversations.

Reflex replaces this with a structured, role-aware web application that tracks every delivery from creation to confirmed completion.

---

## 2. Product Overview

Reflex is a lightweight delivery coordination system. It is not a logistics platform or a mapping product. It does one thing well: it gives three types of users a single, shared view of a delivery's lifecycle, with each user seeing exactly the controls appropriate to their role and nothing more.

The system supports a linear delivery lifecycle:

```
requested → assigned → picked_up → delivered
```

Every transition is triggered by a deliberate action from the correct role. Status changes are visible to all parties within seconds via polling. Delivery completion is proven by a QR/code scan verified server-side — not by a rider self-reporting.

---

## 3. Personas & Roles

### 3.1 Retailer Staff
A shop employee who receives a customer's delivery request in person or by phone and logs it into the system.

- Creates new delivery requests.
- Sees the live status of all deliveries from their store.
- Receives a QR code per delivery to hand to the customer (used at proof-of-delivery).
- Cannot assign riders or update delivery status.

### 3.2 Dispatcher
A coordination employee (or senior staff member) responsible for allocating riders to open delivery requests.

- Sees all open (`requested`) deliveries across the store.
- Assigns a specific rider to a delivery, moving its status to `assigned`.
- Sees live status updates as riders progress through deliveries.
- Cannot create deliveries or scan confirmation codes.

### 3.3 Rider
A delivery person who physically moves parcels from the shop to the customer's address.

- Sees only deliveries assigned to them.
- Marks a delivery as `picked_up` when they collect the parcel from the shop.
- At the customer's door, scans or enters the confirmation code the customer holds (originally generated when the delivery was created and given to the customer as a QR code).
- The successful scan moves the delivery to `delivered` and records a `DeliveryConfirmation` entry as proof.

---

## 4. User Journeys

These journeys are fixed. They define the exact sequence of interactions the system must support.

### Journey 1 — Retailer Staff Logs a Delivery
1. Staff logs in with phone number and password.
2. Staff fills in the New Delivery form: customer name, customer phone, delivery address, item description.
3. Staff submits the form.
4. System creates the delivery with status `requested` and generates a confirmation code.
5. A QR code (encoding the confirmation code) is displayed on-screen. Staff prints or shows this to the customer.
6. The delivery appears in the staff's delivery list with a `Requested` status badge.

### Journey 2 — Dispatcher Assigns a Rider
1. Dispatcher logs in.
2. Dispatcher sees all deliveries with status `requested` on their dashboard (auto-refreshing every 5 seconds).
3. Dispatcher selects a delivery, picks an available rider from a dropdown, and clicks Assign.
4. System updates the delivery status to `assigned` and records the assigned rider.
5. The delivery moves out of the `requested` list and into `assigned` state.

### Journey 3 — Rider Picks Up a Delivery
1. Rider logs in.
2. Rider sees only deliveries assigned to them (auto-refreshing every 5 seconds).
3. Rider clicks "Mark Picked Up" when they collect the parcel from the shop.
4. System updates status to `picked_up`.

### Journey 4 — Rider Delivers and Scans Proof
1. Rider arrives at the customer's address.
2. Customer presents the QR code (received from the retailer at step 5 of Journey 1).
3. Rider uses the in-app QR scanner (or types the code manually as a fallback) and submits it.
4. System verifies the scanned code server-side against the expected code for that delivery.
5. On match: system creates a `DeliveryConfirmation` record and updates status to `delivered`.
6. On mismatch: system returns an error; status does not change.

### Journey 5 — Retailer/Dispatcher See Updated Status
1. The retailer's and dispatcher's dashboards poll `GET /deliveries` every 5 seconds.
2. When any delivery's status changes (assigned, picked_up, delivered), the updated badge appears on the next poll — no manual refresh needed.

---

## 5. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The system must support three distinct user roles: `retailer_staff`, `dispatcher`, `rider`. |
| FR-02 | Authentication must use phone number and password. Passwords must be stored as bcrypt hashes. Sessions must use signed JWTs. |
| FR-03 | A `retailer_staff` user must be able to create a delivery request with: customer name, customer phone, address, item description. |
| FR-04 | Every new delivery must be assigned a deterministic confirmation code (HMAC-SHA256 of a secret key and the delivery ID) at creation time. |
| FR-05 | A `dispatcher` must be able to view all deliveries with status `requested` and assign any of them to a `rider`. |
| FR-06 | A `rider` must only be able to see deliveries assigned to them. They must not see deliveries assigned to other riders. |
| FR-07 | Status transitions must be strictly ordered: `requested → assigned → picked_up → delivered`. Any attempt to skip a step must be rejected with HTTP 422. |
| FR-08 | The `delivered` transition must only be triggered by a successful proof-of-delivery scan. It must not be triggerable by a direct status PATCH. |
| FR-09 | The system must verify the scanned confirmation code server-side before recording delivery. |
| FR-10 | A `DeliveryConfirmation` record (scanned_code, confirmed_at) must be created atomically with the `delivered` status update. |
| FR-11 | The frontend must poll for delivery status updates at least every 5 seconds without requiring a manual page refresh. |
| FR-12 | Each role must be restricted to its own endpoints. Requests from the wrong role must return HTTP 403. |

---

## 6. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Latency:** Status visibility lag must be no more than 5 seconds under normal conditions (polling interval). |
| NFR-02 | **Security:** JWTs must be signed with a secret key stored in environment variables, never in code. Confirmation codes must be derived via HMAC, not random UUIDs, so they are reproducible and verifiable without storing them redundantly. |
| NFR-03 | **Compatibility:** The rider view must function on a standard Android mobile browser (Chrome for Android). Camera QR scanning must work without a native app installation. |
| NFR-04 | **Database:** All writes within a single delivery status transition (status update + confirmation record) must be atomic (single transaction). |
| NFR-05 | **Availability:** The system is designed for a single shop or small fleet. There is no high-availability or multi-region requirement at MVP. |

---

## 7. Data Model Summary

Three entities. See [`erd.png`](./erd.png) for the full diagram.

### User
Stores all three roles in a single table. Identified by phone number (unique). Role determines what endpoints and views are accessible.

### DeliveryRequest
The central record. Holds all delivery details, current status, references to the creating staff member (`created_by`) and the assigned rider (`assigned_rider`, nullable until assignment). Also stores the `confirmation_code` generated at creation.

### DeliveryConfirmation
Created exactly once per delivery, at the moment the rider successfully scans the proof code. Contains the raw scanned value and the confirmed timestamp. The `delivery_id` column has a UNIQUE constraint — a delivery cannot be confirmed twice.

---

## 8. API Surface (Summary)

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/auth/login` | any | Authenticate, receive JWT |
| POST | `/auth/register` | (seeding) | Create a user account |
| POST | `/deliveries` | retailer_staff | Log a new delivery request |
| GET | `/deliveries` | retailer_staff, dispatcher | List all deliveries |
| PATCH | `/deliveries/{id}/assign` | dispatcher | Assign a rider |
| GET | `/deliveries/mine` | rider | List deliveries assigned to me |
| PATCH | `/deliveries/{id}/status` | rider | Update to picked_up |
| POST | `/deliveries/{id}/confirm` | rider | Submit scanned code, trigger delivered |
| GET | `/users?role=rider` | dispatcher | List available riders for dropdown |

---

## 9. Architecture Decisions (Summary)

Full rationale is in [`../reflex-plan.md`](../reflex-plan.md). Key decisions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | FastAPI (Python) | Pydantic validation, auto OpenAPI docs, async support, team familiarity |
| Frontend framework | React + TypeScript | Component model maps to role views; TypeScript enforces API contract |
| Database | TiDB (MySQL-compatible) | Standard MySQL tooling; horizontally scalable without schema migration |
| Real-time updates | Polling every 5 seconds | Stateless; zero persistent connection complexity; lag acceptable at this scale |
| Proof of delivery | Server-side HMAC code verification | Tamper-resistant; no client-side trust required; atomic with status update |

---

## 10. Named Trade-offs

These are accepted limitations of the MVP, each with an explicit upgrade path.

### T-1: Polling vs. Real-Time Push
The 5-second polling interval means status updates are not instant. At this user scale (handful of dispatchers/riders per shop) the lag has no operational impact. When polling load becomes measurable, the natural upgrade is **SSE** (`EventSource` client, `StreamingResponse` server) — one-way push that requires no protocol change. Full **WebSockets** are only warranted if bidirectional messaging (e.g. dispatcher sends live re-route instructions to a rider's open connection) becomes a requirement.

### T-2: No Offline Support for Riders
Riders must have mobile data to record status updates. In areas with intermittent Safaricom/Airtel coverage, a rider could physically deliver a parcel but be unable to confirm it until data returns. The upgrade path is a **PWA offline queue**: status updates are stored in IndexedDB and synced when connectivity resumes, with server-side idempotency keys to handle delayed or duplicate submissions.

### T-3: Single Database Instance, No Redundancy
One TiDB instance handles all reads and writes. TiDB's internal architecture provides some fault tolerance at the storage layer, but no application-level failover is configured. The upgrade path is a **read replica** for polling-heavy GET queries, scheduled automated backups, and a `/health` endpoint for load-balancer failover detection.

### T-4: No Rider Inactivity Detection
Once a delivery is `assigned` or `picked_up`, there is no mechanism to flag it as stale if the rider goes offline or unreachable. The parcel sits in an unresolvable in-flight state. The upgrade path is a `last_seen_at` timestamp on User (updated with each authenticated request) and a **background staleness checker** (APScheduler or Celery beat) that alerts the dispatcher when a delivery has been in-progress without a rider heartbeat for a configurable timeout.

---

## 11. Out of Scope (MVP)

The following are explicitly not part of this build:

- Multi-shop / multi-tenant support
- Delivery routing or mapping integration
- Push notifications (SMS, email, browser push)
- Rider location tracking (GPS)
- Payment processing or cash-on-delivery recording
- Admin panel for user management
- Delivery cancellation or re-assignment flows
- Automated reporting or analytics dashboards
- Native mobile applications (iOS/Android)

---

## 12. Diagrams

| Diagram | File |
|---------|------|
| System Design Flow | [`design.png`](./design.png) |
| Entity-Relationship Diagram | [`erd.png`](./erd.png) |
