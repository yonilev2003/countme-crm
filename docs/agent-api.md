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

## מה עוד לא קיים (מכוון)

- אין endpoint ל-SQL חופשי — בכוונה. כל פעולה חדשה = route חדש עם ולידציה
  והרשאה משלו.
- אין עדיין wrapper רשמי ל-MCP או ל-Custom GPT Actions — ה-API עצמו הוא
  ה-contract; חיבור בפועל ל-Claude/ChatGPT דורש הגדרת custom connector /
  Action שמצביע לכתובות למעלה.
- מחיקת משימות (`delete_task`) לא נחשפה כאן בכוונה — פעולה הרסנית שלא
  התבקשה; זמינה רק דרך הממשק הרגיל.
