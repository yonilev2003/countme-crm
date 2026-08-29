# בדיקת בוקר — CountMe (5–10 דקות)

צ'קליסט ידני קצר להרצה כל בוקר (או אחרי כל מיזוג משמעותי). כל שורה
היא בדיקה עצמאית — עצור ותקן לפי `docs/ops/revive-2026-08.md` אם
משהו נכשל בשלב 1–3, לפני שממשיכים.

## 1. באוויר (1 דקה)

- [ ] פתח <https://countme-crm.vercel.app/api/health> — צריך להחזיר
      `{"ok":true,"db":"up"}`. אם לא — Supabase כנראה מושהה, ר' runbook ההחייאה.
- [ ] ב-Vercel Dashboard → Deployments: הדיפלוי האחרון על `main` במצב **Ready**.

## 2. כניסה (2 דקות)

- [ ] כל אחד משלושת חברי הצוות מתחבר פעם אחת עם Google (`/login`)
      ומגיע ל-`/dashboard` בלי שגיאה.
- [ ] `/admin/users` מציג את שלושתכם כאדמינים, ואף אחד נוסף.

## 3. דאטה קיים (1 דקה)

- [ ] `/tasks` מציג משימות קיימות (לא ריק, לא שגיאה).
- [ ] `/people` ו-`/gantt` נטענים בלי שגיאה.

## 4. Agent API (2 דקות)

```bash
# בלי טוקן — חייב 401
curl -s -o /dev/null -w "%{http_code}\n" https://countme-crm.vercel.app/api/agent/tasks/mine
# עם טוקן אישי (Settings → מפתח AI) — חייב 200 + JSON עם המשימות שלך
curl -s https://countme-crm.vercel.app/api/agent/tasks/mine \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] הבקשה הראשונה מחזירה `401`.
- [ ] הבקשה השנייה מחזירה `200` עם רשימת משימות.

## 5. PWA (רשות, פעם בכמה ימים)

- [ ] בכרום/אנדרואיד: מופיעה אפשרות "התקן אפליקציה".
- [ ] ב-iPhone/Safari: שיתוף → הוסף למסך הבית מציג את האייקון הנכון.

## 6. ניקיון (30 שניות)

- [ ] אין PR פתוח שממתין למיזוג ב-<https://github.com/yonilev2003/countme-crm/pulls>.

---

אם הכול ✅ — המערכת production-ready. אם משהו נכשל, תעד את הסעיף
שנכשל ופתח עבודה ממוקדת בו בלבד — אל תתחיל לחקור סעיפים אחרים עד שהוא נסגר.
