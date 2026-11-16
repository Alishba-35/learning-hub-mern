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

// Video upload (Cloudinary) optional hai: teeno values na hon to sirf YouTube link wala option chalta hai
const cloud = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
};

export const env = {
  cloudinary: cloud.cloudName && cloud.apiKey && cloud.apiSecret ? cloud : null,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN,
};
