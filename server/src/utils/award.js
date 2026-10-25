import UserStats from '../models/UserStats.js';
import { currentStreak, levelInfo, nextStreak } from './progress.js';
import { retryOnDuplicate } from './retry.js';

// XP dena aur aaj ka din "active" mark karna (streak). Lesson aur quiz dono yehi use karte hain.
export async function awardXp(userId, amount, today) {
  const stats = await retryOnDuplicate(() =>
    UserStats.findOneAndUpdate(
      { user: userId },
      { $inc: { xp: amount }, $setOnInsert: { streak: 0, longestStreak: 0, lastActiveDay: '' } },
      { upsert: true, returnDocument: 'after' }
    )
  );

  let streak = currentStreak(stats, today);
  if (stats.lastActiveDay !== today) {
    streak = nextStreak(stats, today);
    await UserStats.updateOne(
      { user: userId, lastActiveDay: stats.lastActiveDay },
      { $set: { streak, lastActiveDay: today }, $max: { longestStreak: streak } }
    );
  }
  return { xp: stats.xp, ...levelInfo(stats.xp), streak, longestStreak: Math.max(stats.longestStreak, streak) };
}
