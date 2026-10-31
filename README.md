# games: אתר המשחקים שלי

האתר רץ ב־Cloudflare Workers בחשבון החינמי. כל משחק נמצא בתיקייה משלו בתוך `public`, ובעמוד הבית יש תפריט של כל המשחקים.

```
public/
  index.html          ← עמוד הבית (תפריט המשחקים)
  last-stand/
    index.html        ← Last Stand
src/worker.js         ← שרת אחד לכל המשחקים האונליין (לכל משחק חדרים נפרדים)
wrangler.toml         ← הגדרות Cloudflare (name = "games")
package.json
```

## העלאה ראשונה
1. ב־GitHub, בעמוד של ה־repository `games`, לוחצים **uploading an existing file**. גוררים את **כל מה שבתוך** התיקייה (`public`, `src`, `wrangler.toml`, `package.json`, `README.md`) ולוחצים **Commit changes**.
2. ב־Cloudflare נכנסים ל־**Workers & Pages ← Create ← Import a repository**, מחברים את GitHub ובוחרים את `games`.
3. ב־Project name כותבים `games`, בדיוק כמו ב־`wrangler.toml`. את Build command משאירים ריק, ובשדה Deploy command משאירים `npx wrangler deploy`. אחר כך לוחצים **Deploy**.
4. הכתובות יהיו:
   - עמוד הבית: `https://games.השם-שלך.workers.dev`
   - Last Stand: `https://games.השם-שלך.workers.dev/last-stand/`

מעכשיו כל שינוי שמעלים ל־GitHub עולה לאתר לבד, תוך דקה.

## עדכון משחק קיים
ב־GitHub נכנסים לתיקייה של המשחק (למשל `public/last-stand`), לוחצים **Add file ← Upload files**, גוררים את ה־`index.html` החדש ולוחצים **Commit changes**.

## הוספת משחק חדש
1. ב־GitHub לוחצים **Add file ← Upload files** ומעלים תיקייה חדשה בתוך `public`, למשל `public/snake/index.html`.
2. ב־`public/index.html` מוסיפים שורה לרשימה `GAMES`:
   ```js
   { path: 'snake/', icon: '🐍', name: 'SNAKE', desc: 'תיאור קצר', tags: ['קלאסי'] },
   ```
3. אם המשחק אונליין, הוא מתחבר ל־`/ws?g=שם-קצר&r=חדר`. לכל משחק חייב להיות `g` משלו, כדי שהחדרים לא יתערבבו. Last Stand משתמש ב־`g=ls`.

## מכסה חינמית
המכסה משותפת לכל המשחקים בחשבון: 100 אלף בקשות ביום, ומתאפסת בחצות לפי UTC. עמודים וקבצים סטטיים לא נספרים במכסה, רק הודעות של משחקים אונליין. לפי החישוב שלי זה בערך 25 עד 35 שעות משחק אונליין ביום. כשהמכסה נגמרת, Last Stand ממשיך לעבוד במשחק לבד מול בוטים.
