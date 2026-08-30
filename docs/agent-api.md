# CountMe Agent API

שכבת פעולות מוגדרת ומאומתת מעל ה-DB, בשביל שסוכני AI (Claude, ChatGPT, וכל
דבר אחר) יוכלו לקרוא ולעדכן את CountMe **בלי** גישת SQL חופשית. כל בקשה
מזוהה על ידי טוקן אישי (ר' `/settings/agent` באפליקציה), הנפתר למשתמש
אחד בלבד — הפעולה עצמה קובעת מה מותר לפי דרג ההרשאה.

## אימות

```
Authorization: Bearer cme_xxxxxxxxxxxxxxxxxxxxxxxx
```

הטוקן מוצג פעם אחת בעת היצירה (`/settings/agent`); רק hash שלו נשמר ב-DB.
טוקן שבוטל (`revoked_at`) נדחה מיד.

## דרגות הרשאה

| דרג | מי | מה |
|---|---|---|
| **Personal** | כל טוקן תקין | נתונים/פעולות על המשתמש עצמו בלבד |
| **Team** | כל טוקן תקין | קריאה של נתוני צוות לא-אישיים (סקירה, לא-מוקצות, פרויקטים) |
| **Admin/CTO** | `profiles.is_admin = true` | נתונים על כל משתמש, בריאות המערכת, שיוך משימות לאחרים |

כרגע כל שלושת חברי הצוות הם אדמין (ר' `0012_everyone_admin.sql`), כך
שבפועל כולם רואים הכול — אבל הבדיקה בקוד היא אמיתית, לא רק תיעודית, כך
שאם מישהו יורד ל-non-admin בעתיד ה-API יאכוף את זה.

## פעולות קריאה (READ)

| פעולה | Endpoint | דרג |
|---|---|---|
| `get_my_tasks` | `GET /api/agent/tasks/mine?include_done=false` | Personal |
| `get_overdue_tasks` | `GET /api/agent/tasks/overdue?scope=self\|team` | Personal (team=Admin) |
| `get_team_overview` | `GET /api/agent/team/overview` | Team |
| `get_project_status` | `GET /api/agent/projects/:id/status` | Team |
| `get_user_activity` | `GET /api/agent/users/:id/activity` | Personal (self) / Admin (אחרים) |
| `get_blocked_work` | `GET /api/agent/tasks/blocked` | Team |
| `get_unassigned_tasks` | `GET /api/agent/tasks/unassigned` | Team |
| `get_system_health` | `GET /api/agent/system/health` | Admin |

הערה על `get_blocked_work`: בסכימה אין סטטוס `blocked` מפורש (רק
`todo`/`doing`/`done`), אז ההגדרה היא הפרוקסי הכי כנה שיש: משימה
שכבר בסטטוס `doing` (מישהו התחיל) אבל עברה את תאריך היעד — כלומר תקועה
בפועל, לא רק לא-נגעו-בה כמו `get_overdue_tasks`.

## פעולות כתיבה (WRITE)

| פעולה | Endpoint | מי יכול |
|---|---|---|
| `create_task` | `POST /api/agent/tasks` | כל טוקן — ברירת מחדל: אחראי = יוצר |
| `update_task` | `PATCH /api/agent/tasks/:id` | אחראי / יוצר / אדמין |
| `assign_task` | `POST /api/agent/tasks/:id/assign` | יוצר המשימה / אדמין (לא האחראי הנוכחי) |
| `complete_task` | `POST /api/agent/tasks/:id/complete` | אחראי / יוצר / אדמין |

`update_task` לא נוגע ב-`assignee_id` בכוונה — שינוי שיוך תמיד עובר דרך
`assign_task`, כדי שתמיד תישלח הודעת מייל לאחראי החדש (אותה לוגיקה
שמשמשת גם את הטופס באתר).

### דוגמאות

```bash
curl -s https://countme-crm.vercel.app/api/agent/tasks/mine \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST https://countme-crm.vercel.app/api/agent/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"לשלוח הצעת מחיר ללקוח X","due_end":"2026-09-02","priority":"high"}'

curl -s -X POST https://countme-crm.vercel.app/api/agent/tasks/<id>/assign \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"assignee_id":"<uuid-של-רוי>"}'
```

## חיבור ל-Claude ול-ChatGPT

יש שתי דרכים להתחבר — שתיהן עוטפות בדיוק את אותו HTTP contract, אין
שכפול לוגיקה ואין חשיפה של SQL באף אחת מהן:

### א. Connector בלחיצה אחת (מומלץ) — Claude.ai / Claude Code / ChatGPT

CountMe הוא עכשיו גם שרת MCP מרוחק עם OAuth 2.1 אמיתי (PKCE, discovery
metadata, dynamic client registration) — בדיוק מה שה-UI של "Add custom
connector" ב-Claude.ai מצפה לו.

1. Claude.ai → Settings → Connectors → **Add custom connector**.
2. הדבק כתובת: `https://countme-crm.vercel.app/api/mcp`.
3. Claude יוביל אותך להתחברות ל-CountMe (אם אתה כבר מחובר בדפדפן — מסך
   אישור אחד) ולבחירת ההרשאות. באישור, נוצר טוקן אישי אוטומטית — בדיוק
   כמו טוקן שהיית יוצר ידנית ב-`/settings/agent`, רק בלי להעתיק-להדביק.
4. ל-ChatGPT: תלוי בגרסה — אם יש לך "Connectors"/"Apps" מבוסס-MCP, אותה
   כתובת עובדת אותו דבר. אם לא, השתמש באופציה ב' למטה.

הכתובות הטכניות מתגלות אוטומטית (`/.well-known/oauth-authorization-server`,
`/.well-known/oauth-protected-resource`) — אין צורך להזין אותן ידנית.
פרטי המימוש: `src/app/oauth/`, `src/app/api/oauth/`, `src/app/api/mcp/`,
מיגרציה `0015_oauth_connector.sql`.

**הערה חשובה**: רשימת ה-redirect_uri המותרת בהרשמת לקוח (`src/lib/oauth/allowlist.ts`)
כוללת את הדומיינים הידועים של Claude/Anthropic ו-ChatGPT/OpenAI. אם
חיבור נכשל עם "redirect_uri not allowed" — כנראה שהדומיין המדויק ששלחו
שונה; תוסיפו אותו לרשימה.

### ב. ידני — שרת MCP מקומי / Custom GPT Actions

- **Claude Code / Desktop (מקומי)**: `mcp-server/` הוא שרת MCP מקומי
  (stdio). הוראות ב-`mcp-server/README.md`, עם הטוקן האישי שלך כמשתנה
  סביבה (`COUNTME_API_TOKEN`, מ-`/settings/agent`).
- **ChatGPT (Custom GPT Actions הישן)**: `docs/agent-api.openapi.yaml`
  הוא ה-schema המלא ל-12 ה-operations, מוכן להדבקה תחת GPT Builder →
  Actions (bearer auth, טוקן מ-`/settings/agent`).

## מה עוד לא קיים (מכוון)

- אין endpoint ל-SQL חופשי — בכוונה. כל פעולה חדשה = route חדש עם ולידציה
  והרשאה משלו.
- מחיקת משימות (`delete_task`) לא נחשפה כאן בכוונה — פעולה הרסנית שלא
  התבקשה; זמינה רק דרך הממשק הרגיל.
- אין formal evaluations לשרת ה-MCP (ר' `mcp-server/README.md`) — היקף
  מכוון לצוות פנימי של 3 אנשים, לא כלי ציבורי.
