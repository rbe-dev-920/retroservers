# RBE API (reconstruction)

This Express server restores key endpoints used by the frontend while the original backend is being recovered.

## Run

```powershell
cd C:\Dev\RETROBUS_ESSONNE\interne\api
npm install
npm start
```

Default port: `4000`. Configure via `.env` with `PORT=4000` if needed.

## Quick Test

```powershell
# Health
Invoke-RestMethod -Uri http://localhost:4000/health

# Login
$login = Invoke-RestMethod -Uri http://localhost:4000/auth/login -Method POST -Body (@{ email='admin@rbe.test'; password='test' } | ConvertTo-Json) -ContentType 'application/json'
$token = $login.token

# Me
Invoke-RestMethod -Uri http://localhost:4000/auth/me -Headers @{ Authorization = "Bearer $token" }

# Vehicles
Invoke-RestMethod -Uri http://localhost:4000/api/vehicles -Headers @{ Authorization = "Bearer $token" }
```

## Endpoints (selection)

- Auth: `POST /auth/login`, `GET /auth/me`
- Flashes: `GET /flashes`, `GET /flashes/all`, CRUD under `/api/flashes`
- Retro News: `GET /api/retro-news`, `POST /api/retro-news`
- Notifications: inbox & preferences under `/api/notifications/*`
- Vehicles: `GET /api/vehicles`, usages, maintenance, service schedule
- Finance: stats, bank balance, transactions, scheduled-expenses, expense-reports

## Notes

- Data is stored in-memory for now; persistence will be added via Prisma.
- Uploads saved under `uploads/` are served via `GET /uploads/<filename>`.
- CORS whitelist includes production and local dev origins.
