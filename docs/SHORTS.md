# Short Study (videos) aur Video Upload: setup guide

## Ye kaise kaam karta hai
- `/shorts`: sab approved videos, language ke hisaab se filter. Video tab load hota hai jab "Play" dabayen (ek waqt mein ek).
- `/shorts/add`: video add karna. Do tareeqe: **YouTube link** ya **apni file** (MP4/MOV/WebM, 50 MB tak).
- `/shorts/manage`: "My videos" (delete). Teacher/admin ko yahan "Waiting for approval" list milti hai (Approve / Delete).
- **Student** ka video pehle "pending" hota hai, teacher approve kare to sab ko dikhta hai. **Teacher/admin** ka video foran live.

## Aap ko ye karna hai (ek baar)

### 1. Teacher/admin banana (apne account ko)
Pehle website par register karein, phir `server` folder mein:
```
npm run role -- aap-ki-email@example.com admin
```
(`server/.env` mein Atlas wali MONGO_URI honi chahiye.) Phir website par ek baar logout/login karein, taake naya role mile.

### 2. Starter videos database mein daalna
```
cd server
npm run seed
```
Ye `server/src/seed/shorts.json` ke 14 YouTube videos add karta hai (purane Laravel project wali IDs). **Un ke titles purane project ke hain: asli video dekh kar `shorts.json` mein title/language theek kar lein**, phir dobara `npm run seed` (naye add hote hain, purane nahi badalte; purana title badalna ho to Atlas mein us video ka title edit karein ya `videos` collection se delete karke seed karein).

### 3. File upload ke liye Cloudinary (free) set karna
YouTube link wala option iske baghair bhi chalta hai. Apni file upload ke liye:
1. https://cloudinary.com par free account banayein.
2. Dashboard par "Product Environment Credentials" mein 3 cheezein milti hain: **Cloud name, API Key, API Secret**.
3. `server/.env` (local) aur Render ke Environment (deploy) mein ye 3 variables daalein:
```
CLOUDINARY_CLOUD_NAME=aap-ka-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aap-ka-secret
```
4. Server restart karein. "Upload a file" button khud enable ho jata hai.

Secret kabhi GitHub par na daalein (`.env` gitignore mein hai). File aap ke server se nahi guzarti: browser seedha Cloudinary par upload karta hai, server sirf signed permission deta hai. Free plan ki limits Cloudinary ke dashboard par dekh lein (storage/bandwidth).

## Security (jo bana hua hai)
- Har route par login zaroori; list/delete/approve ke roles server par check hote hain.
- Sirf apne Cloudinary account aur `learning-hub/shorts/` folder ka link qabool hota hai (koi aur URL nahi).
- YouTube link strictly parse hota hai (11-char ID), player `youtube-nocookie.com` se.
- Upload ki type (mp4/mov/webm) Cloudinary signature mein lock hai; size 50 MB browser mein check hoti hai.
- Rate limit: 15 videos aur 20 upload-signatures per user per ghanta.
- Video delete hone par Cloudinary se file bhi hat jati hai.

## Abhi ye nahi hai (agle kaam)
- 50 MB size ki server-side hard limit (Cloudinary upload preset se lagti hai).
- Videos par XP / "watched" tracking aur lesson page par related video.
- Video edit (title badalna): abhi delete karke dobara add.
