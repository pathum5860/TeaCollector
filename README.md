# TeaCollector

**TeaCollector** is a web-based Tea Collection and Billing Management System that brings Tea Sellers, Tea Collection Companies, and Collectors together in one platform. Users can request pickups, assign lorries, record collected weight, create bills, and manage payments.

## Features

### Tea Sellers

- Browse available collection lorries and service areas
- Request and track tea pickups
- View collection weights, bills, and payment status
- Review monthly payment summaries

### Collection companies

- Set company details, collection areas, and rates
- Create and manage collector accounts
- Add, edit, pause, and remove lorries
- Manage collection requests and bills
- Record individual and monthly payments

### Collectors

- View assigned pickup work
- Update collection progress
- Record actual tea weight and collection details
- Review completed collection bills

## Technology

- **Frontend:** React 19, Vite 8, CSS
- **Backend:** Node.js, Express 5
- **Database:** MongoDB with Mongoose
- **Authentication:** Bearer tokens with scrypt password hashing
- **Testing:** Node.js built-in test runner

## Application flow

```text
Tea Seller requests pickup
        ↓
Company assigns a lorry and collector
        ↓
Collector completes pickup and records weight
        ↓
System creates a bill
        ↓
Company records payment or monthly settlement
```

## Getting started

### Requirements

- Node.js 18 or newer
- MongoDB database
- npm

### 1. Configure the backend

```bash
cd backend
npm install
copy .env.example .env
```

Edit `backend/.env`:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
JWT_SECRET=use-a-long-random-secret
PORT=5000
```

Start the API:

```bash
npm run dev
```

The backend runs on `http://localhost:5000`.

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

The frontend development server forwards `/api` requests to the backend.

## Project structure

```text
TeaCollector/
├── backend/
│   ├── controllers/    API and workflow logic
│   ├── models/         MongoDB schemas and data access
│   ├── seed/           Optional local data setup
│   ├── tests/          Backend tests
│   └── server.js       API entry point
├── frontend/
│   └── src/
│       ├── api/         API client and formatting helpers
│       ├── components/  Shared UI components
│       └── pages/       Role-based workspaces
└── README.md
```
