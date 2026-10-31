# TeaCollector

TeaCollector is a web application for managing tea collections from estate pickup to payment.

## Features

- Tea Sellers can request lorry pickups and track collections.
- Collection companies can manage lorries, collectors, rates, bills, and payments.
- Collectors can view assigned pickups and record collected tea weight.
- Role-based access, notifications, monthly settlements, and CSV export.

## Technology

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: MongoDB with Mongoose
- Authentication: Bearer tokens and password hashing

## Setup

### Backend

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

Start the backend:

```bash
npm run dev
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Tests and build

```bash
cd backend
npm test

cd ../frontend
npm run lint
npm run build
```

## Project structure

```text
backend/     Express API, MongoDB models, authentication, and tests
frontend/    React interface and role-based workspaces
```

## Security

- Never commit `backend/.env`.
- Use a strong `JWT_SECRET` in production.
- Do not use development passwords in production.

## License

No public license has been added yet.
