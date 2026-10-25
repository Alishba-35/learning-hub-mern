// Do requests ek sath pehli baar koi record banayen to unique index ek ko E11000 deta hai.
// Dobara koshish karne par record maujood hota hai aur update ho jata hai.
export async function retryOnDuplicate(fn, attempts = 3) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code !== 11000 || i >= attempts - 1) throw err;
    }
  }
}
