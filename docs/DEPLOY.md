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
