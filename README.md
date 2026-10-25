# TeaCollector

TeaCollector is an authenticated tea collection workflow for estate owners, collection companies, and collectors. It supports lorry management, collection requests, weight entry, bills, and payment status.

See the [database design and ERD](./docs/database-design.md) for the collections, keys, relationships, data types, and indexes.

## Run the backend

1. In `backend`, copy `.env.example` to `.env` and enter your MongoDB Atlas connection string as `MONGO_URI`.
2. Run `npm install`.
3. Run `npm run dev`.

The API runs at `http://localhost:5000` and uses the workflow API only.

## Run the frontend

1. In `frontend`, run `npm install`.
2. Run `npm run dev`.
3. Open the URL printed by Vite, usually `http://localhost:5173`.

The Vite development server forwards `/api` requests to the backend. Register an estate owner account and a collection company account. A company can set its rate, create collector accounts, and register lorries. An owner selects a lorry when making a collection request. The assigned collector records the actual weight; the company can pay individual bills or group a Tea Seller's unpaid completed collections into one monthly settlement.

## Main CRUD entity: Lorry Management

Sign in as a collection company and open **Lorry Management**. Create a collector first so the lorry can be assigned to a driver.

| Operation | UI action | API |
| --- | --- | --- |
| Create | Add lorry, enter its details, then save | `POST /api/lorries` |
| Read | Browse the fleet table or click View | `GET /api/lorries`, `GET /api/lorries/:id` |
| Update | Click Edit, change details, then Save lorry | `PATCH /api/lorries/:id` |
| Delete | Click Delete and confirm | `DELETE /api/lorries/:id` |

For a complete demonstration, add a lorry with a unique vehicle number, view it, edit its capacity or label, reload to verify persistence, and delete it. All fields are validated by the API, and each company can only manage its own lorries. Duplicate vehicle numbers are rejected. Lorries with collection history cannot be deleted (HTTP 409); pause their bookings instead to preserve existing records. Use a new, unbooked lorry to demonstrate deletion.

Run `npm test` in `backend` for the HTTP CRUD regression test, including invalid input, duplicate numbers, unauthorized access, updates visible on subsequent reads, successful deletion, and history protection. These tests use an in-memory store; the application uses MongoDB for persistence.

## Data storage

The workflow stores users, companies, lorries, and requests in MongoDB collections named `users`, `companies`, `lorries`, and `requests`.

Do not share or commit your `.env` file. The project ZIP excludes it; use `.env.example` to make a private local copy.
