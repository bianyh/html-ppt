import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { ROOT, buildSite, escapeHtml } from "./project.mjs";

const [id, suppliedTitle] = process.argv.slice(2);
if (id === "--help") {
  console.log('Usage: npm run new:deck -- my-talk "我的演示"');
  process.exit(0);
}
if (!id || !/^[a-z][a-z0-9-]*$/.test(id))
  throw new Error('Usage: npm run new:deck -- my-talk "我的演示"');
if (["index", "gallery"].includes(id)) throw new Error("Reserved deck id: " + id);
const directory = path.join(ROOT, "decks", id);
if (
  await access(directory).then(
    () => true,
    () => false,
  )
)
  throw new Error("Deck already exists: " + id);
const title = suppliedTitle || "我的新演示";
const manifest = {
  id,
  title,
  description: "请填写演示的受众、目标和背景。",
  brand: id.toUpperCase(),
  theme: "field",
  output: id + ".html",
  styles: [],
  scripts: [],
  slides: ["slides/01-opening.html"],
};
const slide =
  '<section id="opening" class="slide" data-title="' +
  escapeHtml(title) +
  '" data-notes="请填写开场备注。" aria-label="' +
  escapeHtml(title) +
  '">\n' +
  '  <div class="deck-shell">\n' +
  '    <div class="deck-kicker"><span>' +
  escapeHtml(id.toUpperCase()) +
  "</span><span>YOUR NEW DECK</span></div>\n" +
  '    <div class="layout-split"><div><p class="deck-eyebrow">START WITH AN IDEA</p><h1 class="deck-title">' +
  escapeHtml(title) +
  '</h1><p class="deck-lead">在这里写下你希望观众记住的一句话。</p></div>\n' +
  '      <article class="c-card c-card--accent"><span class="c-card__index">01 / THE IDEA</span><h2 class="c-card__title">一个值得展示的想法</h2><p class="c-card__body">使用共享组件开始，按内容选择布局。</p></article></div>\n' +
  '    <div class="deck-footer"><span>HUMAN × AGENT</span><span>01</span></div>\n' +
  "  </div>\n</section>\n";
await mkdir(path.join(directory, "slides"), { recursive: true });
await writeFile(
  path.join(directory, "deck.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
await writeFile(path.join(directory, "slides/01-opening.html"), slide, {
  flag: "wx",
});
await buildSite();
console.log(
  "Created " + id + ". Edit decks/" + id + "/, then run npm run dev.",
);
