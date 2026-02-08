# ClassTrack

## Description
A comprehensive student attendance and class management system with biometric IoT integration.

## Technologies
- **Frontend**: Next.js 14, TailwindCSS, Lucide Icons
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Validation**: Zod
- **Infrastructure**: Vercel (recommended)

## Prerequisites
- Node.js 18+
- Supabase Project

## Installation
1. Clone the repository.
   ```bash
   git clone https://github.com/your-username/classtrack.git
   cd classtrack
   ```
2. Install dependencies.
   ```bash
   npm install
   ```
3. Set up environment variables.
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   **Required Variables:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000 # Production URL in prod
   API_SECRET=your-secure-api-key # For IoT device
   ```
4. Run the development server.
   ```bash
   npm run dev
   ```

## Production Deployment
### Checklist
1. **Environment**: Copy `.env.example` -> `.env.production`. Set new secrets via `openssl rand -base64 32`.
2. **Database**: Run SQL from `supabase/production_indexes.sql` in Supabase SQL Editor to add performance indexes.
3. **Build**: Run `npm run build` to verify optimizations (compressed assets).
4. **Deploy**: Push to Vercel/Netlify. Ensure `API_SECRET` is set in dashboard.

### Verification (Post-Deploy)
Run the smoke test script against your production URL:
```bash
./scripts/smoke-test.sh https://your-production-url.com
```

### Maintenance
- **Backups**: Run `./scripts/backup-db.sh` periodically (requires Supabase connection string).
- **Monitoring**: Check `/api/health` and `/api/metrics`.

## Security Features
- **Rate Limiting**: Throttles frequent API requests.
- **Security Headers**: HSTS, X-Frame-Options, etc. enforced via middleware.
- **Input Validation**: Strictly typed validation using Zod.
- **Protected API**: Critical endpoints require `x-api-key`.

## License
MIT
