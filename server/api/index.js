// Vercel serverless entry: poori Express app ek function ki tarah chalti hai (server.js sirf Render/laptop ke liye hai).
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { ensureSeeded } from "../src/seed/seedData.js";

// Cold start par ek hi baar database jorta (aur zaroorat ho to seed karta) hai; warm requests dobara nahi karti.
let booting;
function boot() {
  booting ??= (async () => {
    await connectDB();
    if (env.autoSeed)
      await ensureSeeded(console.log).catch((err) =>
        console.error("Auto-seed failed:", err.message),
      );
  })().catch((err) => {
    booting = undefined; // agli request dobara koshish kare
    throw err;
  });
  return booting;
}

export default async function handler(req, res) {
  try {
    await boot();
  } catch (err) {
    console.error("Startup failed:", err.message);
    return res.status(503).json({ message: "Service temporarily unavailable" });
  }
  return app(req, res);
}
