# CSR Publishing

CSR Publishing is a clinical study report (CSR) document management and eCTD packaging tool for regulatory submissions.

## Local Development

### Prerequisites
- Node.js >= 20.9
- npm

### Setup
```bash
npm install
cp .env.example .env
```

### Database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Seed (optional)
```bash
npx tsx prisma/seed-template.ts
npx tsx prisma/seed-validation-rules.ts
```

### Run
```bash
npm run dev
```

Open http://localhost:3000

## Production (Railway)

This project is configured for Railway via `railway.toml`.

### 1) Create a Railway service
Provision a persistent volume mounted at `/data`.

### 2) Set environment variables
```
DATABASE_URL=file:/data/csr.db
UPLOAD_DIR=/data/uploads
EXPORTS_DIR=/data/exports
NODE_ENV=production
```

### 3) Build/Deploy
Railway uses:
```
npx prisma migrate deploy && npm start
```

### 4) One-time seed (optional)
Run from a Railway shell or locally against the Railway database:
```bash
npx tsx prisma/seed-template.ts
npx tsx prisma/seed-validation-rules.ts
```

### Notes
- SQLite requires a single app instance unless you move to Postgres.
- Ensure `/data/uploads` and `/data/exports` are writable on the Railway volume.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:run
npm run test:coverage
```

## Environment Variables
See `.env.example` for local defaults.
