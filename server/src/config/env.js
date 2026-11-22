import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'CLIENT_ORIGIN'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

if (process.env.JWT_ACCESS_SECRET.length < 32) {
  console.error('JWT_ACCESS_SECRET must be at least 32 characters');
  process.exit(1);
}

// Video upload ki hadein (MB). Free Atlas mein sirf 512 MB jagah hoti hai, is liye total par bhi hadd hai.
const clamp = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

export const env = {
  // Kitne proxy hop ke peeche hain (rate limit sahi IP dekhe). Render par 1; Vercel frontend -> Vercel backend par 2 try karein.
  trustProxy: clamp(process.env.TRUST_PROXY_HOPS, 1, 0, 5),
  autoSeed: process.env.AUTO_SEED !== 'false',
  maxUploadMb: clamp(process.env.UPLOAD_MAX_MB, 25, 1, 100),
  maxTotalUploadMb: clamp(process.env.UPLOAD_TOTAL_MAX_MB, 300, 10, 100000),
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN,
  // Email bhejne ke liye SMTP (jaise Gmail). Na ho to dev mein email console mein likha jata hai, production mein bhejna band.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || (process.env.SMTP_USER ? `Learning Hub <${process.env.SMTP_USER}>` : ''),
  },
};
