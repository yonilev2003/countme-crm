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

הרצה ידנית דרך Supabase SQL Editor (MCP לא נגיש לפרויקט הזה):

1. פתח את https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/sql/new
2. אם הפרויקט נקי - דלג ל-3. אם יש שאריות ממיגרציה קודמת (errors מסוג "type already exists" / "already member of publication") - **הרץ קודם** `supabase/migrations/0000_reset.sql` (destructive - מוחק את כל ה-CRM tables וה-types שלנו)
3. הרץ בסדר: `0001_initial_schema.sql` → `0002_rls_policies.sql` → `0003_storage_buckets.sql` → `0004_realtime_publication.sql`

כל המיגרציות 0001-0004 הן idempotent - בטוח להריץ אותן שוב.

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
