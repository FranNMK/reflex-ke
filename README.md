# Reflex — Deliver · Track · Coordinate

Reflex is a delivery coordination system for small Kenyan retailers. It replaces ad-hoc WhatsApp and phone-call dispatch with a structured, role-aware web application that tracks every delivery from creation to confirmed completion.

**Stack:** FastAPI (Python) · React + TypeScript (Vite) · TiDB Cloud (MySQL-compatible)

---

## 🌐 Live Deployment

| Service | URL |
|---|---|
| **Frontend** | https://reflex-ke-frontend.up.railway.app |
| **Backend API** | https://reflex-ke-backend.up.railway.app |
| **Interactive API Docs** | https://reflex-ke-backend.up.railway.app/docs |

Hosted on [Railway](https://railway.app). Backend connects to TiDB Cloud (EU Central).

---

## 🔑 Test Accounts

Three accounts are seeded in production — one per role. Use these to log in and test the full system:

| Role | Phone | Password | What you can do |
|---|---|---|---|
| **Retailer Staff** | `0700000001` | `Retailer@123` | Log deliveries, view status, manage stock |
| **Dispatcher** | `0700000002` | `Dispatch@123` | Assign riders, manage rider accounts |
| **Rider** | `0700000003` | `Rider@12345` | View assigned deliveries, pick up, scan proof |

> Log in at https://reflex-ke-frontend.up.railway.app/login

---

## 🔄 End-to-End System Workflow

Reflex enforces a linear delivery lifecycle across three roles. Every status transition requires the correct role — no step can be skipped.

```
requested  →  assigned  →  picked_up  →  delivered
```

### Step 1 — Retailer Staff logs a delivery

1. Retailer staff logs in and navigates to the **New Delivery** tab.
2. They fill in: customer name, customer phone, delivery address, item description.
3. On submit, the backend creates a `DeliveryRequest` with status `requested` and generates a unique HMAC-SHA256 confirmation code.
4. A QR code encoding that confirmation code is displayed on screen. The retailer gives this to the customer (printed or shown on a phone screen).
5. The delivery appears in the **My Deliveries** list with a yellow `Requested` badge and auto-refreshes every 5 seconds.

### Step 2 — Dispatcher assigns a rider

1. Dispatcher logs in and sees all `requested` deliveries on the **Open Requests** tab.
2. They select a rider from the dropdown on any delivery card and click **Assign**.
3. The backend updates the delivery status to `assigned` and records the assigned rider.
4. The delivery moves off the Open Requests tab. The assigned rider can now see it in their queue.

### Step 3 — Rider picks up the parcel

1. Rider logs in and sees deliveries assigned to them (polls every 5 seconds).
2. When they collect the parcel from the shop they tap **Mark Picked Up**.
3. Status updates to `picked_up`. The rider's card now shows the scan/confirm interface.

### Step 4 — Rider delivers and scans proof

1. At the customer's door, the customer presents the QR code they received at Step 1.
2. The rider taps **Scan QR Code** in the app — the phone camera opens and reads the code.
3. Alternatively, the rider taps **Enter Code Manually** and types the alphanumeric code.
4. The scanned/entered code is sent to the backend (`POST /deliveries/{id}/confirm`).
5. The backend verifies the code server-side using HMAC. If it matches:
   - A `DeliveryConfirmation` record is created (with the scanned code and timestamp).
   - The delivery status is atomically updated to `delivered`.
6. If the code does not match, an error is returned — status does not change.

### Step 5 — Everyone sees the updated status

- The Retailer and Dispatcher dashboards poll every 5 seconds.
- The `delivered` badge appears automatically on the next poll — no manual refresh needed.

---

## 👥 Role Capabilities

### Retailer Staff
- Create new delivery requests (name, phone, address, item description)
- View live status of all deliveries with auto-refreshing status badges
- See the QR confirmation code for each delivery (copy button included)
- Manage stock inventory (add, edit, delete products by category and price)

### Dispatcher
- View all open (`requested`) deliveries and assign them to riders
- Monitor in-progress (`assigned`, `picked_up`) and completed deliveries
- **Rider management (full CRUD):**
  - Add new riders (name + phone only — system generates a `rider-XXXX` temp password)
  - Edit rider name and phone number
  - Reset a rider's password (generates new `rider-XXXX`, shows it with a Copy button)
  - Delete a rider (blocked with an error if rider has active deliveries)

### Rider
- View only deliveries assigned to them (no cross-rider visibility)
- Mark deliveries as `picked_up` when collecting from the shop
- Scan customer QR codes via phone camera or enter the code manually
- Submit proof-of-delivery confirmation

---

## 🏗️ Project Structure

```
reflex-ke/
├── backend/                    FastAPI application
│   ├── app/
│   │   ├── main.py             Entry point, CORS middleware, router registration
│   │   ├── config.py           Pydantic settings — reads backend/.env or env vars
│   │   ├── auth.py             bcrypt password hashing + JWT encode/decode
│   │   ├── database.py         SQLAlchemy engine, pymysql shim, get_db dependency
│   │   ├── dependencies.py     get_current_user FastAPI dependency
│   │   ├── delivery_utils.py   HMAC-SHA256 confirmation code generation/verification
│   │   ├── schemas.py          Pydantic request/response models
│   │   ├── models/
│   │   │   └── models.py       ORM: User, DeliveryRequest, DeliveryConfirmation, Product
│   │   └── routers/
│   │       ├── auth.py         POST /auth/login, POST /auth/register
│   │       ├── deliveries.py   Full delivery lifecycle endpoints
│   │       ├── users.py        GET /users, POST/PATCH/DELETE /users/riders
│   │       └── products.py     Product stock CRUD
│   ├── alembic/                Database migrations (0001 schema, 0002 products)
│   ├── tests/                  Pytest lifecycle + role enforcement tests
│   ├── seed_production.py      One-time seed script for production test accounts
│   ├── requirements.txt
│   ├── nixpacks.toml           Railway build config (Python 3.12 venv)
│   └── .env                    ← your credentials (gitignored)
├── frontend/                   React + TypeScript (Vite)
│   ├── public/
│   │   └── logo.png
│   └── src/
│       ├── App.tsx             Router, AuthProvider, role-guarded routes
│       ├── AuthContext.tsx     JWT auth state (localStorage)
│       ├── api.ts              Typed fetch wrapper (get/post/patch/delete)
│       ├── types.ts            Shared TypeScript interfaces
│       ├── StatusBadge.tsx     Reusable delivery status badge
│       └── pages/
│           ├── HomePage.tsx        Public landing page
│           ├── LoginPage.tsx       Phone + password login
│           ├── RetailerPage.tsx    Retailer dashboard (deliveries + stock tabs)
│           ├── DispatcherPage.tsx  Dispatcher dashboard (4 tabs incl. Riders CRUD)
│           └── RiderPage.tsx       Rider dashboard + QR camera scanner
├── docs/
│   ├── design.png                  System design flow diagram
│   ├── erd.png                     Entity-relationship diagram
│   ├── ridersdesign.png            Add-rider sequence diagram
│   ├── DispercherRiderFlow.png     Dispatcher-rider tab flow diagram
│   ├── DisRiderCRUD.png            Rider CRUD full sequence diagram
│   └── ProjectRequirementsDocument.md
├── add-rider-plan.md           Implementation plan — Riders tab feature
├── rider-crud-plan.md          Implementation plan — Rider CRUD feature
├── reflex-plan.md              Full architecture plan + build sub-tasks
└── .env.example                Template for required environment variables
```

---

## ⚙️ API Reference

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/auth/login` | any | Authenticate with phone + password, returns JWT |
| `POST` | `/auth/register` | any | Create a user account (seeding/admin use) |
| `GET` | `/health` | any | Health check — returns `{"status":"ok"}` |
| `POST` | `/deliveries` | retailer_staff | Log a new delivery request |
| `GET` | `/deliveries` | retailer_staff, dispatcher | List all deliveries with current status |
| `PATCH` | `/deliveries/{id}/assign` | dispatcher | Assign a rider, status → `assigned` |
| `GET` | `/deliveries/mine` | rider | List deliveries assigned to the authenticated rider |
| `PATCH` | `/deliveries/{id}/status` | rider | Transition `assigned` → `picked_up` |
| `POST` | `/deliveries/{id}/confirm` | rider | Submit scanned code, triggers `picked_up` → `delivered` |
| `GET` | `/users?role=rider` | dispatcher | List all riders (used in assignment dropdown) |
| `POST` | `/users/riders` | dispatcher | Create a rider account — auto-generates `rider-XXXX` temp password |
| `PATCH` | `/users/riders/{id}` | dispatcher | Update rider name/phone; pass `reset_password:true` to generate new password |
| `DELETE` | `/users/riders/{id}` | dispatcher | Delete rider (blocked with 409 if rider has active deliveries) |
| `GET` | `/products` | retailer_staff | List stock items |
| `POST` | `/products` | retailer_staff | Add a product to stock |
| `PATCH` | `/products/{id}` | retailer_staff | Update a product |
| `DELETE` | `/products/{id}` | retailer_staff | Remove a product from stock |

Full interactive docs with request/response schemas: **https://reflex-ke-backend.up.railway.app/docs**

---

## 🛠️ Local Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- A TiDB Cloud account — free Serverless cluster at https://tidbcloud.com

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```bash
cp ../.env.example .env
```

Edit `backend/.env` with your TiDB Cloud credentials:

```
DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:4000/<dbname>?ssl_verify_cert=true&ssl_verify_identity=true
JWT_SECRET=your-strong-random-secret
DELIVERY_CODE_SECRET=your-strong-random-secret
ALLOWED_ORIGINS=http://localhost:5173
```

Run migrations and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

API available at **http://localhost:8000** · Docs at **http://localhost:8000/docs**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at **http://localhost:5173**

The Vite dev server automatically proxies `/api/*` → `http://localhost:8000` — no `VITE_API_URL` needed locally.

### Seed local test accounts

```bash
cd backend
python3 seed_production.py
```

This creates the same three test accounts listed in the Test Accounts section above. Safe to run multiple times — skips accounts that already exist.

---

## 🧪 Running Tests

Tests use an in-memory SQLite database — no TiDB connection needed.

```bash
cd backend
python3 -m pytest tests/ -v
```

Expected: **5 passed** — covers the full delivery lifecycle, role enforcement, and wrong confirmation code rejection.

---

## 🌍 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLAlchemy connection string — must use `mysql+pymysql://` scheme |
| `JWT_SECRET` | ✅ | Secret for signing JWTs — use a strong random value |
| `DELIVERY_CODE_SECRET` | ✅ | HMAC key for confirmation code generation |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins (e.g. `https://your-frontend.up.railway.app`) |

> **Railway note:** The Railway UI strips `https://` from variable values when you save them. The backend and frontend both handle this automatically — just paste the domain without the scheme and it is normalised at runtime.

---

## 🚀 Deploying to Railway

### Backend service

1. Point Railway at the `backend/` directory.
2. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `DELIVERY_CODE_SECRET`, `ALLOWED_ORIGINS` (your frontend domain).
3. Railway uses `nixpacks.toml` — it creates a Python 3.12 venv, installs dependencies, runs `alembic upgrade head`, then starts uvicorn.

### Frontend service

1. Point Railway at the `frontend/` directory.
2. Set `VITE_API_URL` to your backend Railway domain (e.g. `reflex-ke-backend.up.railway.app`). This is baked into the JS bundle at build time.
3. Railway builds with `npm run build` and serves the static `dist/` folder via Caddy.

---

## 📐 Architecture

See [`docs/ProjectRequirementsDocument.md`](docs/ProjectRequirementsDocument.md) and [`reflex-plan.md`](reflex-plan.md) for the full architecture rationale, ERD, trade-off decisions, and original build plan.

Key design decisions:

| Decision | Choice | Reason |
|---|---|---|
| Status updates | 5-second polling | Stateless, zero connection overhead, lag acceptable at this scale |
| Proof of delivery | Server-side HMAC verification | Tamper-resistant — backend validates, not the rider's device |
| Auth | JWT (8-hour expiry) | Stateless, role embedded in token payload |
| DB driver | PyMySQL + `install_as_MySQLdb()` | Pure-Python MySQL driver; avoids `MySQLdb` C extension on Railway |
| Password format for new riders | `rider-XXXX` (4-digit number) | Easy to read aloud and type on a phone |
