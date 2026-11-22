import { randomInt } from "node:crypto";

// Milte julte huroof (0/O, 1/I/L) nahi, taake code padhna aur likhna aasan ho
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_PATTERN =
  /^LH-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

const group = () =>
  Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );

// LH-7K3M-9QXA-4TPW (12 random huroof, takriban 59 bit: andaza lagana mumkin nahi)
export const makeCertificateCode = () => `LH-${group()}-${group()}-${group()}`;

// User ka likha code saaf karo (bari/chhoti, extra jagah); galat shakal ho to null
export function normalizeCode(input) {
  const code = String(input ?? "")
    .trim()
    .toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
