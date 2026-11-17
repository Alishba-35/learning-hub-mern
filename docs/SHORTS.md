# Short Study (videos) aur Video Upload: setup guide

## Ye kaise kaam karta hai
- `/shorts`: sab approved videos, language ke hisaab se filter. Video tab load hota hai jab "Play" dabayen (ek waqt mein ek).
- `/shorts/add`: video add karna. Do tareeqe: **YouTube link** ya **apni file** (MP4/MOV/WebM, 25 MB tak, koi extra account nahi chahiye).
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

### 3. File upload (kuch set karna zaroori nahi)
Upload ki hui video MongoDB Atlas mein 2 MB ke tukdon mein save hoti hai, is liye Cloudinary ya koi aur account nahi chahiye. Browser file ko tukdon mein bhejta hai (har tukde ki 3 koshish), is liye Vercel/Render ki body-size limit ka masla nahi.

Free Atlas mein sirf 512 MB jagah hoti hai (lessons/users bhi us mein hain), is liye hadein lagi hain. Badalni hon to `server/.env` aur Render Environment mein:
```
UPLOAD_MAX_MB=25          # ek video ki hadd (1 se 100)
UPLOAD_TOTAL_MAX_MB=300   # sab uploaded videos ki kul hadd
```
Hadd poori ho jaye to "library is full" ka message aata hai; teacher purani videos delete kar dein. Bari ya lambi videos ke liye YouTube link behtar hai.

## Security (jo bana hua hai)
- Har route par login zaroori; list/delete/approve ke roles server par check hote hain.
- Upload ki file ke asli bytes check hote hain (MP4/MOV/WebM), naam ya type par bharosa nahi; har tukde ka size exact hona chahiye.
- Video chalane ka link signed aur 6 ghante mein expire hota hai (`<video>` login header nahi bhej sakta), aur seek (Range) support karta hai.
- Adhoori upload na dikhti hai na chalti hai; 1 ghante baad khud saaf ho jati hai.
- YouTube link strictly parse hota hai (11-char ID), player `youtube-nocookie.com` se.
- Size server par bhi check hota hai (browser ke bharose nahi).
- Rate limit: 15 videos/uploads per user per ghanta.
- Video delete hone par uske tukde bhi hat jate hain.

## Abhi ye nahi hai (agle kaam)
- Upload ki hui video ka thumbnail (abhi saada dark card dikhta hai).
- Videos par XP / "watched" tracking aur lesson page par related video.
- Video edit (title badalna): abhi delete karke dobara add.
