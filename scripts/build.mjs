import path from "node:path";
import { buildSite, ROOT } from "./project.mjs";

const args = process.argv.slice(2);
if (args.some((arg, index) => arg !== "--out" && args[index - 1] !== "--out"))
  throw new Error("Usage: npm run build -- [--out dist]");
const outIndex = args.indexOf("--out");
if (outIndex >= 0 && !args[outIndex + 1])
  throw new Error("--out requires a directory");
const destination =
  outIndex >= 0 ? path.resolve(ROOT, args[outIndex + 1]) : ROOT;
const decks = await buildSite(destination);
console.log(
  "Built " +
    decks.length +
    " decks (" +
    decks.reduce((sum, deck) => sum + deck.slides.length, 0) +
    " slides) → " +
    destination,
);
for (const deck of decks)
  console.log("  " + deck.output + " ← " + deck.manifestPath);
