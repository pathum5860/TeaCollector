# 🍃 TeaCollector

> A calm, connected way to move tea from estate pickup to payment.

TeaCollector is a full-stack tea collection workflow for **Tea Sellers**, **collection companies**, and **field collectors**. It brings lorry booking, pickup progress, weighing, billing, payments, and monthly settlements into one focused workspace.

## ✨ What it does

- **Tea Sellers** find available lorries, request collections, follow pickup progress, view bills, and track monthly payments.
- **Collection companies** manage collection areas and rates, create collector accounts, operate their lorry fleet, process bills, and settle monthly payments.
- **Collectors** see assigned pickups, update collection status, record actual tea weight, and complete field work from one dashboard.
- **Everyone** gets role-based access, notifications, Sri Lankan currency formatting, responsive layouts, and CSV export for collection records.

## 🧭 The workflow

```text
Tea Seller → chooses lorry → requests pickup → Collector completes collection
                                                   ↓
                                         Company records weight
                                                   ↓
                                      Bill → payment → settlement
```

## 🛠️ Built with

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, CSS |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose 9 |
| Authentication | JWT-style bearer sessions with scrypt password hashing |
| Testing | Node's built-in test runner and an in-memory workflow store |

## 🚀 Run locally

### 1. Start the backend

```bash
cd backend
npm install
copy .env.example .env
```

Open `backend/.env` and set a MongoDB connection string and a secure JWT secret:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
PORT=5000
```

Start the API:

```bash
npm run dev
```

The backend runs at `http://localhost:5000`.

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`. The frontend automatically proxies `/api` requests to the backend.

## 🧪 Test and build

Run backend tests:

```bash
cd backend
npm test
```

Build and lint the frontend:

```bash
cd frontend
npm run lint
npm run build
```

The backend tests cover authentication, authorization, billing precision, lorry CRUD, duplicate vehicle numbers, persistence, and history-protected deletion.

## 📁 Project map

```text
TeaCollector/
├── backend/
│   ├── controllers/     API workflow and authorization logic
│   ├── models/          Mongoose schemas and workflow store
│   ├── tests/            Backend regression tests
│   └── server.js        Express entry point
├── frontend/
│   └── src/
│       ├── api/         API client, sessions, formatting, CSV export
│       ├── components/  Shared layout, forms, dialogs, and UI
│       └── pages/       Role-based workspaces
└── README.md
```

## 🔐 Security notes

- Keep `backend/.env` private and never commit it.
- Use a long, random `JWT_SECRET` outside local development.
- Passwords are stored as scrypt hashes, never as plain text.
- API access is role-aware: sellers, companies, and collectors only receive the workflows relevant to them.

## 📜 License

This project is currently distributed without a public license. Add a license before publishing it for external reuse.
