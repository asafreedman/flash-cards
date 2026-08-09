This is a Next.js project that mirrors a Figma Make export and keeps the latest zip import runnable in `/study`.

## CI and Workflow Tutorial

- GitHub workflow and infra cost analysis guide: `GITHUB_WORKFLOWS_TUTORIAL.md`

## Persistence Stack

- ORM: Prisma JS
- Local DB: PostgreSQL 16 in Docker
- DB UI: Prisma Studio

## Auth Stack

- JWT-based auth cookie (`AUTH_JWT_SECRET`)
- Email/password user accounts stored in Postgres via Prisma
- `/study` and persistence APIs require login

## Database Setup

1. Copy env template:

```bash
cp .env.local.example .env.local
```

2. Start the local database:

```bash
npm run db:up
```

3. Run migrations:

```bash
npm run db:migrate -- --name init
```

4. Seed initial cards:

```bash
npm run db:seed
```

5. Optional DB inspection:

```bash
npm run db:studio
```

If `npm run db:up` fails with `docker: command not found`, install and start Docker Desktop, then rerun the command.

After seeding, you can log in with the default local account:

- Email: `demo@example.com`
- Password: `password123`

## Getting Started

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000. The root route redirects to the imported Figma experience at `/study`.

## Sync New Figma Zips

Use a direct diff workflow instead of an import script.

1. Extract the latest archive to a temp folder:

```bash
rm -rf /tmp/flash-cards-figma-export && mkdir -p /tmp/flash-cards-figma-export && unzip -q "Flash Card App.zip" -d /tmp/flash-cards-figma-export
```

2. Compare exported app against local snapshot:

```bash
diff -ru /tmp/flash-cards-figma-export/src src/components/figma/snapshot
```

3. If different, refresh the full snapshot folder:

```bash
rm -rf src/components/figma/snapshot && mkdir -p src/components/figma/snapshot && cp -R /tmp/flash-cards-figma-export/src/. src/components/figma/snapshot/
```

4. If Figma metadata changed, refresh it:

```bash
rm -rf .figma && cp -R /tmp/flash-cards-figma-export/.figma .figma
```

5. Validate:

```bash
npm run lint && npm run build
```

6. Optional cleanup:

```bash
rm -rf /tmp/flash-cards-figma-export
```

## Notes

- `src/components/figma/figma-imported-app.tsx` is the stable wrapper used by the `/study` route.
- `/figma` remains as a compatibility redirect to `/study`.
- `src/components/figma/snapshot/` is the full exported source snapshot and may include additional pages/components/styles over time.
- API endpoints for persistence live under `src/app/api/`.
