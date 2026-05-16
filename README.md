# countme CRM

המערכת הפנימית של הצוות לניהול אנשים, משימות, צ׳אט, גאנט, מסמכים ויומן.

## Stack

- **Next.js 16** (App Router) — `next build --webpack` בלבד (Turbopack שובר routing ב-Vercel)
- **TypeScript** strict
- **Tailwind CSS 4** — תצורה ב-`@theme` בתוך `globals.css`
- **Supabase** — Auth (Google OAuth) + Postgres + Storage + Realtime
- **Anthropic** — Claude Haiku 4.5 לפענוח תאריכים, Sonnet 4.6 לעוזר חכם
- **Google Calendar API** — סנכרון דו-כיווני

UI בעברית RTL בלבד. קוד והערות באנגלית.

## Setup

```bash
npm install
cp .env.template .env.local
# Fill in NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev
```

## Database migrations

### דרך 1 (מומלץ) — סקריפט אוטומטי דרך psql

1. השג connection string מ-https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/settings/database
   (בחר "Session pooler", החלף את `[YOUR-PASSWORD]` בסיסמת ה-DB)
2. הרץ:
   ```bash
   export DATABASE_URL='postgresql://postgres.fsbgxtmxvhxmmtcflmug:...@aws-X-eu-central-1.pooler.supabase.com:6543/postgres'
   ./scripts/apply-migrations.sh           # יציע reset destructive
   # או:
   ./scripts/apply-migrations.sh --skip-reset   # אם המסד נקי
   ```
   הסקריפט מריץ 0000-0004 בסדר ומאמת בסוף שיש 11 טבלאות + 6 enums + 3 ב-realtime.

### דרך 2 — ידני דרך SQL Editor

1. פתח https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/sql/new
2. אם יש שאריות (errors "type already exists") — הדבק והרץ קודם את `supabase/migrations/0000_reset.sql`
3. הדבק והרץ בסדר: `0001_initial_schema.sql` → `0002_rls_policies.sql` → `0003_storage_buckets.sql` → `0004_realtime_publication.sql`

כל המיגרציות 0001-0004 הן idempotent — בטוח להריץ אותן שוב.

## Auth flow (critical)

חיבור Google נדרש את ה-scope `calendar` ואת הפרמטרים `access_type=offline` + `prompt=consent` כדי לקבל `refresh_token`. ה-`provider_refresh_token` מוחזר **רק בהסכמה הראשונה** ונשמר ל-`profiles.google_refresh_token` ב-`/auth/callback`. אם זה מתפספס - הסנכרון מת אחרי שעה.

לאחר התחברות ראשונה, בדוק:

```sql
select id, email, google_refresh_token is not null as has_token
from profiles
where id = auth.uid();
```

## Build

```bash
npm run build     # next build --webpack (locked - DO NOT remove --webpack)
npm run typecheck
```
