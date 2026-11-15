# Learning Hub: Review, Architecture, Roadmap

## 1. Review (repo `learning-hub-mern`, Oct 2026)
Laravel app (`learning_hub`) ka MERN port pehle se kaafi aage hai. Server tests 42 pass (18 MongoDB ke bina skip), client lint clean, 82 tests pass, build ok.

**Jo pehle se hai:** React 19 + Vite client, Express 5 + Mongoose API, JWT access token (memory mein) + rotating httpOnly refresh cookie ("remember me" 30 din), bcrypt(12), helmet, rate limits, zod validation, DOMPurify, XP/streak/badges, dashboard + charts, 13 languages (130 lessons), 7 quiz files (choice + fill, explanation ke saath), code-draft auto-save.

**Masail (priority order):**
1. **Security:** `server/.env.example` mein asli Atlas password aur JWT secret tha. Dono rotate karein (docs/DEPLOY.md).
2. `learning_hub_old` ek broken git submodule entry thi (Vercel build tod sakti hai). Hata di.
3. Deploy config nahi tha (`vercel.json`, backend hosting). Add kiya.
4. `/shorts` abhi "Coming soon" hai (videos wala page).
5. Java/Python/SQL/C++ mein code sirf pehle se likha output dikhata hai, run nahi hota.
6. Teacher role model mein hai par teacher ke liye koi page/API nahi.
7. Password reset / email verify nahi. Quiz sirf lesson-level (language-level test nahi).
8. Content: Java/Python/SQL lessons chhote hain (70-130 words), 45 lessons mein video nahi.

## 2. Architecture
```
Browser (React SPA, Vercel)  --/api/* rewrite-->  Express API (Render)  -->  MongoDB Atlas
  AuthProvider: refresh cookie se auto-login        routes > validate(zod) > controllers > models
  access token sirf memory mein                     requireAuth / requireRole(teacher|admin)
```
Collections: User, RefreshToken(TTL), Language, Topic(blocks), Quiz, QuizResult, Progress(drafts), UserStats, Activity(TTL 90d).
Lesson = blocks: `html` | `demo` | `playground`. Naye lessons sirf JSON (`server/src/seed/data`) + `npm run seed`.

## 3. Roadmap (step by step)
| Phase | Kaam |
|---|---|
| 0 (done) | Secrets safai, vercel.json, deploy guide, 26 diagrams, video slots |
| 1 | Aap: secrets rotate, deploy, videos.json mein IDs. Mein: Shorts Study page |
| 2 (done) | Naye languages add: C, Data Structures, TypeScript, React, Node/Express, Git (48 lessons, 18 quizzes, 48 diagrams) |
| 3 | Java/Python/SQL lessons ka content double + baqi 45 lessons ke liye diagrams |
| 4 | Quizzes: har language ka final test, timed mode, wrong-answers review |
| 5 | Teacher: class code, students ka progress table, quiz banana |
| 6 | Code runner (Piston API) C++/Java/Python ke liye, SQL in-browser (sql.js) |
| 7 | Game feel: levels, badges, daily goal, leaderboard (class ke andar) |

## 4. Videos kahan chahiye (`server/src/seed/videos.json` mein sirf 11-character YouTube ID likhein)
- **cpp** (7): strings, structs-enums, operator-overloading, templates, exceptions, stl-basics, file-handling
- **css** (4): flexbox, grid, transitions-animations, variables-units
- **html** (3): attributes, forms-validation, accessibility-seo
- **java** (9): intro, variables-types, operators-conditions, loops, arrays-strings, methods, classes-objects, inheritance-interfaces, exceptions-collections
- **javascript** (5): objects-json, scope-closures, es6-essentials, error-handling, web-storage
- **python** (9): intro, variables-types, operators-conditions, loops, lists-tuples, dicts-sets, functions, oop, errors-files
- **sql** (8): intro, select-filter, modify-data, aggregate-group, joins, subqueries, keys-constraints, indexes-views
