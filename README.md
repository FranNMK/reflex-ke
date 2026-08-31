# Reflex

**Deliver · Track · Coordinate**

Delivery coordination system for small Kenyan retailers — replaces WhatsApp/phone dispatch with role-based delivery tracking and proof-of-delivery scanning.

**Stack:** FastAPI (Python) · React + TypeScript (Vite) · TiDB Cloud (MySQL-compatible)

---

## Project Structure

```
reflex-ke/
├── backend/                  FastAPI application
│   ├── app/
│   │   ├── main.py           Entry point, CORS, routers, /health
│   │   ├── config.py         Pydantic settings — reads backend/.env
│   │   ├── auth.py           bcrypt password hashing + JWT helpers
│   │   ├── database.py       SQLAlchemy engine + get_db dependency
│   │   ├── dependencies.py   get_current_user FastAPI dependency
│   │   ├── schemas.py        Pydantic request/response models
│   │   ├── delivery_utils.py HMAC confirmation code gen/verify
│   │   ├── models/           ORM models (User, DeliveryRequest, DeliveryConfirmation)
│   │   └── routers/          auth, deliveries, users
│   ├── alembic/              Database migrations
│   ├── tests/                Pytest lifecycle + role enforcement tests
│   ├── requirements.txt
│   └── .env                  ← your credentials go here (gitignored)
├── frontend/                 React + TypeScript (Vite)
│   ├── public/
│   │   └── logo.png          Platform logo
│   └── src/
│       ├── App.tsx           Router + AuthProvider
│       ├── AuthContext.tsx   JWT auth state
│       ├── api.ts            Typed fetch wrapper
│       ├── types.ts          Shared TypeScript types
│       ├── StatusBadge.tsx   Reusable status badge component
│       └── pages/
│           ├── HomePage.tsx        Public landing page
│           ├── LoginPage.tsx       Sign in
│           ├── RetailerPage.tsx    Retailer staff dashboard
│           ├── DispatcherPage.tsx  Dispatcher dashboard
│           └── RiderPage.tsx       Rider dashboard + QR scanner
├── docs/
│   ├── design.png            System design flow diagram
│   ├── erd.png               Entity-relationship diagram
│   └── ProjectRequirementsDocument.md
├── .env.example              Template for required environment variables
└── reflex-plan.md            Architecture plan + build sub-tasks
```

---

## Prerequisites

- **Python 3.12+** (tested on 3.14)
- **Node.js 20+**
- **TiDB Cloud account** — free Serverless cluster at https://tidbcloud.com

---

## Backend Setup

### 1. Create and activate virtual environment

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure environment

Create `backend/.env` (copy from the root `.env.example`):

```powershell
Copy-Item ..\.env.example .env
```

Then edit `backend/.env` with your TiDB Cloud credentials:

```
DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:4000/<dbname>?ssl_verify_cert=true&ssl_verify_identity=true
JWT_SECRET=your-strong-random-secret
DELIVERY_CODE_SECRET=your-strong-random-secret
ALLOWED_ORIGINS=http://localhost:5173
```

> **Get your TiDB connection string:** TiDB Cloud dashboard → your cluster → **Connect** → copy the connection string → change `mysql://` to `mysql+pymysql://` and append `?ssl_verify_cert=true&ssl_verify_identity=true`

### 4. Create the database (first time only)

```powershell
.venv\Scripts\python.exe -c "
import pymysql, ssl
ctx = ssl.create_default_context()
conn = pymysql.connect(host='<your-tidb-host>', port=4000, user='<user>', password='<password>', ssl=ctx)
conn.cursor().execute('CREATE DATABASE IF NOT EXISTS reflex')
conn.commit(); conn.close(); print('Done')
"
```

### 5. Run migrations

```powershell
alembic upgrade head
```

### 6. Start the API server

```powershell
uvicorn app.main:app --reload
```

API available at **http://localhost:8000**
Interactive docs: **http://localhost:8000/docs**

---

## Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend available at **http://localhost:5173**

The Vite dev server proxies `/api/*` → `http://localhost:8000` automatically.

---

## Running Tests

Tests use an in-memory SQLite database — no TiDB connection needed.

```powershell
cd backend
.venv\Scripts\activate
python -m pytest tests/ -v
```

Expected output: **5 passed**

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLAlchemy connection string — must use `mysql+pymysql://` scheme |
| `JWT_SECRET` | Secret for signing JWTs — use a strong random value in production |
| `DELIVERY_CODE_SECRET` | HMAC secret for confirmation code generation |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:5173`) |

---

## API Overview

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | any | Create user account |
| POST | `/auth/login` | any | Authenticate, returns JWT |
| POST | `/deliveries` | retailer_staff | Log new delivery request |
| GET | `/deliveries` | retailer_staff, dispatcher | List all deliveries |
| PATCH | `/deliveries/{id}/assign` | dispatcher | Assign rider to delivery |
| GET | `/deliveries/mine` | rider | My assigned deliveries |
| PATCH | `/deliveries/{id}/status` | rider | Update to picked_up |
| POST | `/deliveries/{id}/confirm` | rider | Submit proof-of-delivery code |
| GET | `/users?role=rider` | dispatcher | List available riders |
| GET | `/health` | any | Health check |

---

## Seeding Users

Use the `/auth/register` endpoint or run these curl commands:

```powershell
# Retailer Staff
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Alice","phone":"0700000001","password":"pass1234","role":"retailer_staff"}'

# Dispatcher
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Bob","phone":"0700000002","password":"pass1234","role":"dispatcher"}'

# Rider
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Charlie","phone":"0700000003","password":"pass1234","role":"rider"}'
```

---

## Pages

| URL | Description |
|---|---|
| `/` | Public homepage — platform overview and "Get Started" |
| `/login` | Sign in with phone + password |
| `/retailer` | Retailer staff dashboard (log deliveries, view status) |
| `/dispatcher` | Dispatcher dashboard (assign riders) |
| `/rider` | Rider dashboard (pick up + QR scan confirmation) |

---

## Architecture Notes

See [`docs/ProjectRequirementsDocument.md`](docs/ProjectRequirementsDocument.md) and [`reflex-plan.md`](reflex-plan.md) for full architecture rationale, ERD, trade-offs, and design decisions.
