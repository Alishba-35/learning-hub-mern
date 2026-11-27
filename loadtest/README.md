# Load, stress aur scalability testing (free)

## Sab se aasaan tareeqa (5 minute, koi database ya seed nahi)
Ye aap ki **live site** par halka test chalata hai (20 users tak, 1 minute). Sirf public pages naapta hai.

1. **k6 install karein** (free). Windows PowerShell mein: `winget install k6`. Baad mein PowerShell band kar ke dobara kholein.
2. Repo ke root folder se ye chalayein:
```powershell
k6 run -e SITE_URL=https://learning-hub-lilac-theta.vercel.app -e API_URL=https://learning-hub-mern.vercel.app loadtest/live-light.js
```
3. Aakhir mein summary aati hai. Ye cheezein dekhein:
   - `failures` **0%** (ya 2% se kam)
   - `http_req_duration` ka **p(95)** (ye 1500 ms se neeche ho)
   - `http_reqs` (kitni requests har second)
   - Neeche `[OK]`/`✓` tick, na ke `✗`.
4. Presentation ke liye is summary ka screenshot kaafi hai.

`rate_limited` ka matlab hai server ne zyada requests rok di. Ye ghalti nahi, server ka bachao hai.
**MAX=20 se upar mat jayein** (free plans ki hadein hoti hain).

Baqi tests (stress, spike, scalability, soak, login) neeche hain. Wo local database par chalte hain, asli site par nahi.

Tools: **k6** (free, open source) aur Node. Koi paisa nahi lagta. Ye folder aap ke backend ko **apne computer par** test karta hai.

## Pehle ye parh lein (zaroori)
**Asli (Vercel + Atlas) site par heavy test mat chalayein.**
- Ye tests hazaron requests aur nakli users banate hain. Free plans (Vercel Hobby, MongoDB Atlas M0, Gmail) ki hadein hoti hain, aur zyada traffic se account throttle ya flag ho sakta hai.
- Test ka maqsad apne **code** ki hadd janna hai. Is liye database bhi local rakhein (neeche steps).
- Asli site ke liye sirf halka `smoke.js` theek hai (1 user, 3 baar).
- `prepare` script khud mana kar deta hai agar `MONGO_URI` local nahi hai.

## Ek baar ka setup
1. **k6 install:** Windows: `winget install k6` (ya `choco install k6`, ya https://k6.io/docs/get-started/installation/). Mac: `brew install k6`.
2. **Local MongoDB:** Docker ho to `docker run -d --name lh-mongo -p 27017:27017 mongo:7`, warna MongoDB Community Server install karein.
3. `server/.env.loadtest` jaisi values (ya terminal mein export karein):
```
MONGO_URI=mongodb://127.0.0.1:27017/lh_loadtest
JWT_ACCESS_SECRET=koi-lamba-secret-kam-az-kam-32-harf-1234567890
CLIENT_ORIGIN=http://localhost:5173
PORT=5055
```
4. Database tayyar karein (server folder se):
```bash
cd server
npm install
npm run seed                      # lessons aur quizzes
npm run loadtest:prepare -- 300   # 300 nakli students + tokens (3 ghante chalte hain)
npm start                         # server chalta rakhein (naye terminal mein baqi commands)
```
Tokens 3 ghante mein expire ho jate hain. Test fail ho (sab 401) to `loadtest:prepare` dobara chalayein.

## Tests (repo ke root folder se)
| Test | Command | Kya dekhta hai |
| --- | --- | --- |
| Live (halka) | `k6 run -e SITE_URL=... -e API_URL=... loadtest/live-light.js` | live site par 20 users, bina seed |
| Smoke | `k6 run loadtest/smoke.js` | sab kuch chal raha hai? (pehle yahi) |
| Quick | `k6 run -e VUS=100 -e THINK=0 loadtest/quick.js` | 30 second ka tez compare (code badalne se pehle/baad) |
| **Load** | `k6 run loadtest/load.js` | aam din ka bojh: 100 students, 5 minute |
| **Stress** | `k6 run -e THINK=0 -e MAX=400 loadtest/stress.js` | bojh barha kar toot'ne ka point |
| Spike | `k6 run -e PEAK=300 loadtest/spike.js` | achanak bohat log, phir recovery |
| **Scalability** | `k6 run loadtest/scalability.js` | 25 -> 50 -> 100 -> 200 users: throughput kitna barhta hai |
| Soak | `k6 run -e DURATION=30m loadtest/soak.js` | lamba waqt (memory leak, dheere slow hona) |
| Login | `k6 run loadtest/login.js` | sign-in (password hashing) ki hadd |
| Login + baqi site | `k6 run -e RATE=4 loadtest/login-blocking.js` | login ke dauran baqi site slow to nahi hoti? |
| **Bug hunt** | `node loadtest/bugs.mjs` | race conditions, kharab input, security checks (35 checks) |

Options: `-e BASE_URL=http://localhost:5055`, `-e THINK=0` (soochne ka waqt 0), `-e VUS=...`, `-e STEP=30s` (stress ki har seedhi).
Per-endpoint nateeja chahiye to `--out json=result.json` lagayein.

## Nateeja kaise parhein
- **http_req_duration p(95):** 95% requests is se tez thin. Load test mein 500 ms se neeche achha hai.
- **failures / http_req_failed:** 1% se kam ho. `429` (rate limit) ko ghalti nahi ginte, wo `rate_limited` mein alag aata hai.
- **http_reqs (req/s):** server kitni requests har second handle karta hai.
- **Scalability:** users double karne par req/s lagbhag double hona chahiye aur latency wahi rehni chahiye. Jahan req/s barhna band ho aur latency barhne lage, wahi saturation hai.
- **Stress:** error ya latency kis bojh par shuru hui, aur bojh hatne ke baad (recovery) server wapas theek hua ya nahi.
- **Soak:** `ps`/Task Manager mein node ki memory dekhte rahein. Barhti hi jaye aur kabhi na ruke to leak hai.

## Ye tests kitne asli hain?
Har VU ek student hai jo dashboard kholta hai, lesson parhta hai, progress save karta hai, kabhi quiz ya search karta hai (`lib.js`). Har VU ka apna nakli IP hota hai (`X-Forwarded-For`), taake IP wale rate limiters sab ko ek na samjhen.

## Mere sandbox mein naape hue nateeje (1 CPU core, 4 GB, k6 + Node + MongoDB teeno usi par)
Dedicated server par numbers zyada achhe honge. Ye numbers **pehle/baad ka farq** dikhane ke liye hain.

| Maqsad | Pehle | Baad |
| --- | --- | --- |
| Stress (200 VUs, soch-waqt 0): throughput | 378 req/s | 448 req/s |
| Language page (`/api/languages/:slug`) | 264 ms | 21 ms |
| Dashboard (`/api/progress`) p95 | 914 ms | 564 ms |
| Login ke dauran baqi students ka p95 (4 logins/s) | 1080 ms | 20 ms |
| Login khud (4 logins/s) | 3.5 s average | 0.24 s |

Scalability (baad): 25 VUs 144 req/s -> 50 VUs 278 -> 100 VUs 476 -> 200 VUs 430 (saturation, koi error nahi, p95 590 ms).
Memory: 5 minute ke heavy load mein node 140 MB se 190 MB tak gaya aur phir ruk gaya (leak ke asaar nahi).

## Kya theek kiya gaya
1. **Native bcrypt:** `bcryptjs` poora server rok deta tha (5 logins/s par response 48 second). Ab asli `bcrypt` alag thread mein chalta hai (na milne par `bcryptjs` khud istemal hota hai). `BCRYPT_ROUNDS` (default 12) se mehnat badal sakte hain; 10 chaar guna tez hai.
2. **Server start par 250 ms ka block hataya** (`bcrypt.hashSync`).
3. **Login rate limit:** pehle 20 per IP / 15 minute thi, yani college WiFi par 21wan student bahar. Ab 10 per account+IP, aur poore IP ke liye 300.
4. **Catalog cache:** languages/lessons/quizzes ki list 5 minute memory mein (pehle dashboard ke har request par 3 extra queries). 20 saath aane wali requests ek hi load share karti hain.
5. **Parallel writes:** lesson complete aur quiz submit mein XP aur activity log ab saath chalte hain (ek database round-trip kam).
6. **Database pool:** `maxPoolSize` (default 10, `MONGO_POOL_SIZE`) aur 5 second `serverSelectionTimeoutMS`, taake serverless par connections na barhen aur DB band ho to request latke nahi.
7. **SQL course:** `sql.json` mein asal SQL ki jagah Java ka purana copy pada tha (slug `java`). 8 asli SQL lessons likhe gaye.
8. **Quizzes:** Java "Beyond the Basics" aur Python "Going Further" sections ka checkpoint quiz nahi tha. Dono ban gaye.
9. Do lessons (TypeScript) 200 words se chhote the; theek kiye. Purane tests ki stale expectations aur Flask `@app.route(` par false alarm theek kiye.
