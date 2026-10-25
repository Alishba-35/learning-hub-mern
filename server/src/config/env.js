import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'CLIENT_ORIGIN'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

export const env = {
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN,
};
