# Deploy guide (Vercel + Render + MongoDB Atlas)

Pehle `.env.example` mein purani credentials ki wajah se: **MongoDB Atlas mein database user ka password badlein aur naya JWT secret banayein** (purane GitHub history mein dikhte hain).

1. **Atlas**: Database Access > user ka password reset. Network Access > `0.0.0.0/0` (Render ki IP badalti rehti hai). Connection string copy karein.
2. **Backend (Render.com, free Web Service)**: Root Directory `server`, Build `npm install`, Start `npm start`.
   Environment: `NODE_ENV=production`, `MONGO_URI`, `JWT_ACCESS_SECRET` (naya, 32+ chars), `CLIENT_ORIGIN=https://<aap-ka-app>.vercel.app`.
   Video upload ke liye koi extra account nahi chahiye (file MongoDB mein rehti hai). Optional hadein: `UPLOAD_MAX_MB` (25), `UPLOAD_TOTAL_MAX_MB` (300), docs/SHORTS.md dekhein.
   Lessons/quizzes server start par khud seed ho jate hain agar database mein kam hon (band karne ke liye `AUTO_SEED=false`). Manual: `npm run seed`.
3. **Frontend (Vercel)**: Root Directory `client`, Framework Vite. `client/vercel.json` mein `YOUR-API-NAME` ko apne Render service ke naam se badlein.
   Is rewrite se browser ko API usi domain par lagti hai, is liye login cookie theek chalti hai.
4. Check: `https://<render-url>/api/health` `{"status":"ok"}` de, phir Vercel site par signup/login karein.


---

## Option B: Backend bhi Vercel par (Render ke bina)

Is mein do Vercel projects hote hain: ek `client` (website) aur ek `server` (API). Dono ek hi GitHub repo se.

1. **Atlas** wahi (Network Access `0.0.0.0/0`, naya password).
2. **Vercel > Add New > Project** > apna repo > **Root Directory: `server`** > Framework: Other. Environment Variables:
   `NODE_ENV=production`, `MONGO_URI`, `JWT_ACCESS_SECRET` (naya, 32+ chars), `CLIENT_ORIGIN=https://<aap-ki-website>.vercel.app`, `TRUST_PROXY_HOPS=2`. Deploy.
   (`server/vercel.json` aur `server/api/index.js` pehle se bane hain.)
3. Check: `https://<server-project>.vercel.app/api/health` par `{"status":"ok"}` aana chahiye. Pehli request par lessons khud seed hote hain, 20-40 seconds lag sakte hain, dobara kholein.
4. `client/vercel.json` mein `https://YOUR-API-NAME.onrender.com` ki jagah server project ka URL likhein: `https://<server-project>.vercel.app/api/:path*`. Push karein, client project (Root Directory `client`) redeploy hoga.
5. Server project mein `CLIENT_ORIGIN` asli website URL par set karke redeploy karein.

Dhyan rakhein:
- Vercel function par ek request ki body 4.5 MB tak hoti hai. Video upload 2 MB ke tukdon mein hota hai, is liye theek hai.
- Rate limit har function instance ki memory mein hota hai, is liye Render se thoda kam sakht hai. Login ke liye bhi bruteforce se bachne ko password strong rakhein.
- Upload ki hui video chalana (stream) is setup par sab se kam test hua hissa hai. YouTube links par koi asar nahi.
- Free (Hobby) plan par function 60 seconds tak chalta hai; so nahi jata, Render wali 30-60 second ki neend nahi hoti.

## Email (password reset OTP aur students ko email)

Server `nodemailer` se SMTP ke zariye email bhejta hai. Backend ke environment variables mein ye daalen (Render / Vercel dashboard, aur local `.env`):

| Variable | Misal |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` (ya `465`) |
| `SMTP_USER` | `your.email@gmail.com` |
| `SMTP_PASS` | Gmail ka 16 harf ka **App password** (asli password nahi) |
| `MAIL_FROM` | `Learning Hub <your.email@gmail.com>` |

Gmail App password: Google Account > Security > 2-Step Verification on karein > `myaccount.google.com/apppasswords`.

- Local development mein SMTP khali ho to email console mein print hoti hai (OTP wahin dikh jata hai).
- Production mein SMTP khali ho to email nahi jati: admin ko "Email is not set up" ka error milta hai.

## Roz khud chalne wali nudge emails (Insights)

Admin > Insights > "Automatic emails" mein on/off hota hai. Server par ye chahiye:

- `CRON_SECRET` = koi bhi lamba random text (kam az kam 16 harf). Vercel backend project > Settings > Environment Variables mein add karein, phir Redeploy.
- `AUTO_NUDGE_MAX` (optional) = ek din mein zyada se zyada emails, default 100 (Gmail ki roz ki hadd ke liye).
- `server/vercel.json` mein cron likha hai: har din 04:00 UTC (subah 9 baje Pakistan) `/api/cron/nudges` chalta hai. Vercel `CRON_SECRET` khud request ke saath bhejta hai.
- Vercel Cron sirf production deployment par chalta hai. Hobby plan mein din mein ek baar chal sakta hai (waqt ek ghante ke andar aage peeche ho sakta hai).
- Ek student ko hafte mein ek se zyada nudge nahi jati (ek click wali ho ya automatic).
