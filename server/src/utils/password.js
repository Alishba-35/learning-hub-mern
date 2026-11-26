import bcryptjs from 'bcryptjs';
import { env } from '../config/env.js';

// Password hashing. Asli "bcrypt" (C++) alag thread mein chalta hai, is liye hash ke dauran server baqi requests ka jawab de sakta hai.
// bcryptjs (sirf JavaScript) wahi kaam main thread par karta hai aur poore server ko rok deta hai: load test mein 5 logins/second par
// response 48 second tak chala gaya. Agar asli bcrypt install na ho sake (optionalDependency) to bcryptjs khud istemal hota hai.
// Dono ke hash aapas mein barabar hain, purane users ko koi farq nahi parta.
let native = null;
try {
  // BCRYPT_IMPL=js sirf test/muqabla ke liye: bcryptjs zabardasti istemal karta hai
  if (process.env.BCRYPT_IMPL !== 'js') native = (await import('bcrypt')).default;
} catch {
  console.warn('Native bcrypt is not installed: using bcryptjs (slower, and it blocks the server while hashing).');
}
const impl = native ?? bcryptjs;

export const usingNativeBcrypt = native !== null;
export const hashPassword = (plain) => impl.hash(plain, env.bcryptRounds);
export const verifyPassword = (plain, hash) => impl.compare(plain, hash);

// Jab email maujood hi na ho tab bhi wahi waqt lagay (timing se pata na chale ke account hai ya nahi).
// Pehle ye bcrypt.hashSync tha jo har server start / serverless cold start par ~250 ms poora process rok deta tha. Ab peeche chalta hai.
const dummyHash = hashPassword('dummy-password-for-timing');
export const verifyAgainstDummy = async (plain) => verifyPassword(plain, await dummyHash);
