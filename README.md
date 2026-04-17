# The Monitor

The Monitor is a Next.js dashboard for exploring personal digital memory data across connected platforms.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- ESLint 9 with `eslint-config-next`

## Run Locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

- `npm run dev`: Start local development server
- `npm run build`: Build production bundle
- `npm run start`: Start production server
- `npm run lint`: Run lint checks

## Project Layout

- `src/app/page.tsx`: Main shell composition
- `src/components/*`: Dashboard UI components
- `src/app/api/audit-summary/route.ts`: Audit summary API
- `src/app/api/memory-chat/route.ts`: Chat API endpoint
- `src/types/dashboard.ts`: Shared dashboard API and UI types

## Notes

- Dashboard content is API-backed through local route handlers.
- The UI supports desktop and mobile layouts with responsive CSS modules.

## Unattended Sync

- Cron route: `/api/cron/sync`
- Schedule: configured in `vercel.json` (every 30 minutes)
- Required server env vars: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`
- Optional escalation env vars: `SYNC_ESCALATION_WEBHOOK_URL`, `SYNC_ESCALATION_COOLDOWN_MINUTES`, `SYNC_ESCALATION_OWNER_WARNING`, `SYNC_ESCALATION_OWNER_CRITICAL`, `SYNC_ESCALATION_INCLUDE_WARNING`
