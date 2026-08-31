# Reflex — Delivery Coordination System: Architecture & Implementation Plan

## Top-Level Overview

Reflex is a delivery coordination system for small Kenyan retailers. It replaces ad-hoc WhatsApp/phone call coordination with a structured, role-aware web application. Three personas — Retailer Staff, Dispatcher, and Rider — interact with a shared backend through views that expose only what their role needs. The full lifecycle of a delivery request (created → assigned → picked up → delivered with proof) is tracked in a database and surfaced in near-real-time via polling.

**Stack:** FastAPI (Python) · React (TypeScript) · TiDB (MySQL-compatible distributed SQL)
**Scope of this plan:** System design, ERD, architecture rationale, trade-offs, and an ordered build plan. No implementation code is written until the user approves this document.

---

## System Design Flow Diagram

See the Mermaid diagram in the companion chat response. The narrative flow is:

1. Retailer Staff authenticates → POSTs a new DeliveryRequest (status = `requested`)
2. Dispatcher GETs all `requested` deliveries → PATCHes one with a rider assignment (status = `assigned`)
3. Rider GETs their assigned deliveries → PATCHes their delivery to `picked_up` when collecting
4. Rider delivers → POSTs a scan/confirmation code → backend verifies, creates DeliveryConfirmation, PATCHes status to `delivered`
5. Retailer & Dispatcher poll GET /deliveries every 5 s → see updated status without manual refresh

---

## Entity-Relationship Diagram (ERD)

### Entities

#### User
| Column | Type | Notes |
|---|---|---|
| id | UUID / BIGINT PK | auto-generated |
| name | VARCHAR(120) | |
| phone | VARCHAR(20) UNIQUE | |
| role | ENUM('retailer_staff','dispatcher','rider') | |
| hashed_password | VARCHAR(255) | bcrypt hash |
| created_at | DATETIME | server default NOW() |

#### DeliveryRequest
| Column | Type | Notes |
|---|---|---|
| id | UUID / BIGINT PK | auto-generated |
| customer_name | VARCHAR(120) | |
| customer_phone | VARCHAR(20) | |
| address | TEXT | free-text delivery address |
| item_description | TEXT | |
| status | ENUM('requested','assigned','picked_up','delivered') | default 'requested' |
| created_by | FK → User.id | NOT NULL — the retailer staff who logged the request |
| assigned_rider | FK → User.id | NULL until dispatcher assigns |
| created_at | DATETIME | server default NOW() |
| updated_at | DATETIME | auto-updated on PATCH |

#### DeliveryConfirmation
| Column | Type | Notes |
|---|---|---|
| id | UUID / BIGINT PK | auto-generated |
| delivery_id | FK → DeliveryRequest.id | UNIQUE (one confirmation per delivery) |
| scanned_code | VARCHAR(255) | the raw value read from the QR/barcode |
| confirmed_at | DATETIME | server default NOW() at insert time |

### Relationships

- One **User** (retailer_staff) → creates many **DeliveryRequests** (`created_by`)
- One **User** (rider) → is assigned to many **DeliveryRequests** (`assigned_rider`)
- One **DeliveryRequest** → has at most one **DeliveryConfirmation** (`delivery_id` UNIQUE)

### Status State Machine

```
requested → assigned → picked_up → delivered
```

Status transitions are enforced server-side. A PATCH that would skip a step (e.g. requested → delivered) is rejected with HTTP 422.

---

## Architecture Document

### 1. Why This Stack

**FastAPI**
FastAPI is a modern Python framework that generates OpenAPI docs automatically, enforces request/response schemas via Pydantic, and runs on async ASGI (Uvicorn). For a system where the primary operations are simple CRUD plus status-transition logic, FastAPI's built-in validation and documentation output is a strong fit. The team has prior experience with it (consistent with the evaluation track), which reduces ramp-up risk.

**React (TypeScript)**
React gives a component model that maps naturally onto the three role-based views (Retailer form, Dispatcher dashboard, Rider queue). TypeScript adds compile-time safety on the API contract, catching shape mismatches before they reach production. The React polling loop (`setInterval` + `fetch`) is trivially simple to implement and reason about.

**TiDB**
TiDB is MySQL-compatible, so it can be accessed with standard MySQL drivers (SQLAlchemy + PyMySQL / aiomysql). Its distributed architecture means the schema will scale horizontally if Reflex grows, without a schema migration away from a single-instance MySQL. For this project, it is used as a single logical database; the distribution capability is available if needed. Foreign keys, ENUMs, and UNIQUE constraints all work as expected with MySQL-compatible syntax.

### 2. Polling vs. WebSockets/SSE — Explicit Trade-off

**Decision:** The frontend polls `GET /deliveries` (or `GET /deliveries/{id}`) every 5 seconds to detect status changes.

**Why this was chosen:**
At this scale (a handful of concurrent dispatchers and riders per shop), polling generates negligible server load. A 5-second lag in status visibility is acceptable — a dispatcher does not need sub-second notification that a rider has picked up a parcel. Polling is stateless, requires no connection-lifecycle management on the server, works correctly behind any standard reverse proxy, and is easy to test and debug.

**What changes at scale:**
| Scale | Recommended approach | Reason |
|---|---|---|
| Dozens of concurrent users | SSE (Server-Sent Events) | Server pushes updates; client holds one long-lived HTTP connection. Reduces redundant GET traffic. FastAPI supports SSE natively with `StreamingResponse`. One-way push is sufficient here — the client never needs to send data over the same channel. |
| Hundreds of users + bidirectional control messages | WebSockets | Genuine two-way messaging (e.g. dispatcher sends a re-route instruction directly to a rider's open connection). Higher infra complexity; requires sticky routing or a pub/sub broker behind load balancers. |

Polling is the correct first step. SSE is the natural next step if polling load becomes measurable.

### 3. Role-Based Access Control (RBAC)

Every API request carries a JWT issued at login. The JWT payload includes `user_id` and `role`. A FastAPI dependency (`get_current_user`) decodes and validates the token on every protected route.

| Endpoint | Allowed roles | Notes |
|---|---|---|
| POST /deliveries | retailer_staff | `created_by` is set from JWT, not from request body |
| GET /deliveries | retailer_staff, dispatcher | Returns all deliveries |
| PATCH /deliveries/{id}/assign | dispatcher | Sets `assigned_rider`, status → assigned |
| GET /deliveries/mine | rider | Returns only deliveries where `assigned_rider = current_user.id` |
| PATCH /deliveries/{id}/status | rider | Allowed transitions: assigned → picked_up |
| POST /deliveries/{id}/confirm | rider | Submits scanned code, triggers delivered transition |

Returning wrong-role requests with HTTP 403. Attempting a disallowed status transition returns HTTP 422.

### 4. QR/Confirmation Scan — Server-Side Verification

At delivery time the rider opens their Rider view on a phone and either:
- scans a customer-held QR code using the device camera (via a browser QR-scan library such as `html5-qrcode`), or
- manually enters a short alphanumeric confirmation code the customer shows them.

The scanned/entered value is POSTed to `POST /deliveries/{id}/confirm` with body `{ "scanned_code": "..." }`.

**Server-side verification logic:**
1. Look up the DeliveryRequest by `id`. Confirm it is in `picked_up` status and the `assigned_rider` matches the authenticated rider (prevents a different rider confirming someone else's delivery).
2. The `scanned_code` is compared against the expected value for that delivery. The expected code is generated deterministically when the DeliveryRequest is created (e.g. `HMAC-SHA256(secret_key, delivery_id)` truncated to 8 alphanumeric characters), stored in the DeliveryRequest row, and embedded in the QR image rendered in the Retailer/Dispatcher view. The rider never sees the expected code until delivery — the customer holds the QR printout or the retailer shows it at pickup.
3. If codes match: create a `DeliveryConfirmation` row, set `DeliveryRequest.status = delivered`, return HTTP 200.
4. If codes do not match: return HTTP 422 with a clear error message. Do not change status.

This pattern is directly analogous to an event check-in scan: the attendee holds a QR; the scanner verifies it server-side; attendance is recorded atomically.

### 5. Trade-offs

#### Trade-off 1 — Polling vs. Real-Time Push
**What it is:** Status updates reach the Retailer/Dispatcher dashboard with up to a 5-second lag because the UI polls rather than receiving pushed events.
**Why it was accepted:** At this scale, 5-second lag has no operational cost. Polling is simple to implement, simple to test, and requires no server-side connection state.
**What changes with more time:** Implement SSE on `GET /deliveries/stream`. The React client replaces `setInterval` with an `EventSource`. Server CPU and network traffic both decrease for the same result.

#### Trade-off 2 — No Offline Support for Riders
**What it is:** Riders must have active mobile data to update delivery status or submit a confirmation scan. In areas with poor Safaricom/Airtel coverage this creates a gap where a rider has physically delivered a parcel but cannot record it.
**Why it was accepted:** Implementing a Service Worker + IndexedDB offline queue is significant extra scope. For an MVP the assumption is that riders are in areas with at least 2G data at delivery points.
**What changes with more time:** Add a PWA offline layer — status updates are queued locally and synced when connectivity returns. The server must then handle out-of-order or delayed confirmation events gracefully (idempotency keys).

#### Trade-off 3 — Single Database Instance, No Redundancy
**What it is:** The system runs against a single TiDB instance (or logical cluster). There is no read replica, no automated failover tested at the application layer, and no backup schedule configured in this plan.
**Why it was accepted:** For an MVP serving a small number of shops, a single instance is operationally simple and sufficient. TiDB's internal architecture does provide some fault tolerance at the storage layer, but this is not configured or verified here.
**What changes with more time:** Add a read replica for polling-heavy GET queries, configure automated backups, and add a health-check endpoint so a load balancer can fail over to a standby instance.

#### Trade-off 4 — No Handling for Rider Going Inactive Mid-Delivery
**What it is:** Once a delivery is in `assigned` or `picked_up` status, there is no automatic mechanism to detect if a rider goes offline, drops the delivery, or becomes unreachable. The parcel is in limbo.
**Why it was accepted:** Building a heartbeat/timeout system (rider sends a ping every N minutes; system flags deliveries as "stale") is out of scope for the MVP.
**What changes with more time:** Add a `last_seen_at` field on User, updated with each authenticated request. A background job (APScheduler or Celery beat) scans for deliveries where `assigned_rider.last_seen_at` is stale and alerts the dispatcher.

---

## Build Sub-Tasks

### Sub-Task 1 — Project Scaffolding
**Intent:** Create the top-level directory structure, environment configuration, and dependency manifests for both backend and frontend so subsequent tasks have a consistent foundation.
**Expected Outcomes:**
- `/backend` directory with a `pyproject.toml` (or `requirements.txt`) listing FastAPI, Uvicorn, SQLAlchemy, PyMySQL, python-jose, passlib[bcrypt], pydantic-settings
- `/frontend` directory with a React + TypeScript project (Vite scaffold)
- A root `.env.example` listing required environment variables: `DATABASE_URL`, `JWT_SECRET`, `DELIVERY_CODE_SECRET`, `ALLOWED_ORIGINS`
- A root `docker-compose.yml` (optional but useful for local TiDB) with a TiDB service
**Todo List:**
1. Create `/backend` folder and `requirements.txt`
2. Create `/frontend` folder with Vite + React + TypeScript template
3. Write `.env.example` with all required variables
4. Write `docker-compose.yml` with TiDB service (port 4000)
**Relevant Context:** TiDB uses MySQL wire protocol; DATABASE_URL uses `mysql+pymysql://` scheme
**Status:** [x] done — scaffolded backend (FastAPI + Pydantic settings + CORS + /health), frontend (Vite + React + TypeScript), docker-compose.yml (TiDB), .env.example, .gitignore

---

### Sub-Task 2 — Database Models & Migrations
**Intent:** Define SQLAlchemy ORM models for User, DeliveryRequest, DeliveryConfirmation and create the Alembic migration to produce the schema in TiDB.
**Expected Outcomes:**
- `backend/app/models.py` with all three ORM classes, constraints, and relationships as specified in the ERD
- `backend/alembic/` migration that creates all three tables on a fresh TiDB instance
- Status ENUM and role ENUM enforced at the database layer
**Todo List:**
1. Initialise Alembic (`alembic init`)
2. Write `models.py` (User, DeliveryRequest, DeliveryConfirmation) with FK constraints, UNIQUE on `DeliveryConfirmation.delivery_id`
3. Generate and review the initial migration
4. Verify migration applies cleanly to TiDB
**Relevant Context:** TiDB is MySQL-compatible; use `mysql+pymysql` dialect. ENUM columns map to SQLAlchemy `Enum` type.
**Status:** [x] done — ORM models in `backend/app/models/models.py`; `database.py` with `get_db` dependency; Alembic initialised with `alembic.ini`, `env.py`, and migration `0001_initial_schema.py`

---

### Sub-Task 3 — Authentication (JWT Login)
**Intent:** Implement the login endpoint and the `get_current_user` dependency so all subsequent protected routes can enforce role-based access.
**Expected Outcomes:**
- `POST /auth/login` accepts `{phone, password}`, returns a signed JWT containing `user_id` and `role`
- `get_current_user` FastAPI dependency decodes and validates the token; raises HTTP 401 if invalid/expired
- Passwords stored as bcrypt hashes; `POST /auth/register` (internal/seeding use) hashes on write
**Todo List:**
1. Write `backend/app/auth.py` with password hashing helpers and JWT encode/decode
2. Write `backend/app/routers/auth.py` with `/auth/login` and `/auth/register` routes
3. Write `get_current_user` dependency
4. Write unit tests for token encode/decode and login endpoint
**Relevant Context:** Use `python-jose[cryptography]` for JWT, `passlib[bcrypt]` for password hashing
**Status:** [x] done — `app/auth.py` (hash/verify/JWT), `app/dependencies.py` (`get_current_user`), `app/schemas.py` (Pydantic models), `app/routers/auth.py` (`POST /auth/register`, `POST /auth/login`), router wired into `main.py`

---

### Sub-Task 4 — Delivery Request API (CRUD + Status Transitions)
**Intent:** Implement all delivery-related endpoints with role enforcement and status-transition validation.
**Expected Outcomes:**
- `POST /deliveries` (retailer_staff only) — creates request, generates confirmation code, sets status = requested
- `GET /deliveries` (retailer_staff, dispatcher) — returns all deliveries with current status
- `PATCH /deliveries/{id}/assign` (dispatcher only) — sets assigned_rider, status → assigned
- `GET /deliveries/mine` (rider only) — returns deliveries assigned to authenticated rider
- `PATCH /deliveries/{id}/status` (rider only) — transitions assigned → picked_up; rejects invalid transitions with 422
- `POST /deliveries/{id}/confirm` (rider only) — verifies scanned_code, creates DeliveryConfirmation, transitions picked_up → delivered
- All endpoints return HTTP 403 if called by wrong role
**Todo List:**
1. Write Pydantic schemas for request/response bodies
2. Write `backend/app/routers/deliveries.py` with all six endpoints
3. Implement status-transition guard function
4. Implement confirmation code generation (HMAC-SHA256) and verification
5. Write integration tests for each endpoint covering role-enforcement and transition-guard cases
**Relevant Context:** Confirmation code = `HMAC-SHA256(DELIVERY_CODE_SECRET, str(delivery_id))` as 8-char hex prefix
**Status:** [x] done — `app/delivery_utils.py` (code gen/verify), `app/routers/deliveries.py` (all 6 endpoints + transition guard), `app/routers/users.py` (`GET /users?role=rider`), all routers wired into `main.py`

---

### Sub-Task 5 — Frontend: Retailer Staff View
**Intent:** Build the React page for retailer staff to log new delivery requests and see a read-only status list of their own requests.
**Expected Outcomes:**
- Login page (phone + password, stores JWT in memory/localStorage)
- New Delivery form (customer name, phone, address, item description) that POSTs to `/deliveries`
- Delivery list that GETs `/deliveries` and polls every 5 seconds, showing status badges
- QR code displayed for each delivery (generated client-side from the confirmation code returned by the API) so the customer can hold it at delivery time
**Todo List:**
1. Set up React Router with `/login`, `/retailer`, `/dispatcher`, `/rider` routes
2. Build `LoginPage` component
3. Build `NewDeliveryForm` component
4. Build `DeliveryList` component with 5-second polling
5. Integrate a QR-code rendering library (e.g. `qrcode.react`) to display the confirmation code
**Relevant Context:** Role-based routing — redirect to correct view after login based on JWT `role` claim
**Status:** [x] done — `LoginPage`, `RetailerPage` (form + polling list + confirmation code display), shared `api.ts`, `AuthContext.tsx`, `StatusBadge.tsx`, `types.ts`, `App.tsx` with role-guarded routes

---

### Sub-Task 6 — Frontend: Dispatcher View
**Intent:** Build the React page for dispatchers to see open requests and assign them to riders.
**Expected Outcomes:**
- Dashboard listing all `requested` deliveries with 5-second polling
- Rider selector (dropdown populated from `GET /users?role=rider`) and Assign button per delivery
- PATCH to `/deliveries/{id}/assign` on assignment; list refreshes immediately
**Todo List:**
1. Build `DispatcherDashboard` component
2. Build `AssignDeliveryModal` / inline form with rider dropdown
3. Wire PATCH call and optimistic UI update
**Relevant Context:** Rider list endpoint (`GET /users?role=rider`) needs to be added to backend in this task
**Status:** [x] done — `DispatcherPage.tsx` with open/in-progress/delivered sections, rider dropdown, assign PATCH, 5-second polling

---

### Sub-Task 7 — Frontend: Rider View
**Intent:** Build the React page for riders showing their assigned deliveries and enabling status updates and proof-of-delivery scanning.
**Expected Outcomes:**
- List of deliveries assigned to the logged-in rider (polls `GET /deliveries/mine` every 5 seconds)
- "Mark Picked Up" button — PATCHes status to `picked_up`
- "Scan / Enter Code" interface — uses `html5-qrcode` for camera scan or a text input fallback; POSTs to `/deliveries/{id}/confirm`
- Delivered deliveries shown as greyed-out/complete
**Todo List:**
1. Build `RiderDashboard` component
2. Add QR scanner using `html5-qrcode`
3. Add manual code entry fallback input
4. Wire confirm POST and handle success/error states
**Relevant Context:** Camera access requires HTTPS in production; test on localhost is fine with most browsers
**Status:** [x] done — `RiderPage.tsx` with pick-up action, `html5-qrcode` camera scanner (dynamic import), manual code fallback, confirm POST

---

### Sub-Task 8 — End-to-End Testing & Deployment Config
**Intent:** Validate the complete delivery lifecycle with an automated test, and produce a production-ready deployment configuration.
**Expected Outcomes:**
- One Pytest end-to-end test that exercises the full lifecycle: create user (3 roles), log in as retailer, create delivery, log in as dispatcher, assign, log in as rider, pick up, confirm with correct code, verify `delivered` status
- `Dockerfile` for backend (FastAPI + Uvicorn)
- `Dockerfile` for frontend (Vite build + nginx serve)
- Updated `docker-compose.yml` wiring all three services
- `README.md` covering local setup, env vars, and how to run migrations
**Todo List:**
1. Write Pytest lifecycle test using `TestClient` against an in-memory SQLite DB (or test TiDB instance)
2. Write `backend/Dockerfile`
3. Write `frontend/Dockerfile`
4. Update `docker-compose.yml` to include backend and frontend services
5. Write `README.md`
**Relevant Context:** SQLAlchemy's `create_engine` with `check_same_thread=False` works for SQLite in tests; swap DATABASE_URL in CI
**Status:** [x] done — `backend/tests/test_lifecycle.py` (full lifecycle + role enforcement + wrong code tests), `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` updated with all 3 services + healthcheck, `README.md`

---

## Named Trade-offs Summary

| # | Trade-off | Accepted because | Fix at scale |
|---|---|---|---|
| 1 | Polling (5s) instead of push | Simple; negligible load at this scale | SSE → WebSockets |
| 2 | No offline support for riders | PWA offline queue is out of MVP scope | Service Worker + IndexedDB sync queue |
| 3 | Single DB instance, no redundancy | Sufficient for MVP; TiDB has internal fault tolerance | Read replica + automated backups + health-check failover |
| 4 | No rider inactivity detection | Heartbeat/timeout system is out of MVP scope | `last_seen_at` + background staleness checker |
