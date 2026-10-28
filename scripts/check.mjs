import { parse, parseFragment } from "parse5";
import { readFile, access, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  loadDecks,
  renderDeck,
  renderGallery,
  sourcePath,
  ROOT,
  COMMON_STYLES,
} from "./project.mjs";

const errors = [];
const fail = (message) => errors.push(message);
const attr = (node, name) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value;
const hasClass = (node, name) =>
  (attr(node, "class") || "").split(/\s+/).includes(name);
function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}
function text(node) {
  return node.nodeName === "#text"
    ? node.value
    : (node.childNodes || []).map(text).join("");
}
async function checkReference(file, reference, relativeToCss = false) {
  if (
    !reference ||
    reference.startsWith("#") ||
    reference.startsWith("%23") ||
    reference.startsWith("data:")
  )
    return;
  if (/^(?:[a-z]+:|\/\/)/i.test(reference)) {
    fail(file + ": unexpected remote resource " + reference);
    return;
  }
  const local = reference.split(/[?#]/)[0];
  const relative = relativeToCss
    ? path.posix.join(path.posix.dirname(file), local)
    : local;
  try {
    await access(sourcePath(relative));
  } catch {
    fail(file + ": missing local resource " + reference);
  }
}
async function inspectHtml(file, html, expectedSlides) {
  const document = parse(html, {
    onParseError: (error) => fail(file + ": invalid HTML (" + error.code + ")"),
  });
  const ids = new Set();
  const slides = [];
  const references = [];
  const labels = [];
  const buttonTypes = [];
  walk(document, (node) => {
    const id = attr(node, "id");
    if (id) {
      if (ids.has(id)) fail(file + ': duplicate id "' + id + '"');
      ids.add(id);
    }
    if (hasClass(node, "slide")) slides.push(node);
    if (node.tagName === "label") labels.push(node);
    if (node.tagName === "button") buttonTypes.push(node);
    if (node.tagName === "img" && attr(node, "alt") === undefined)
      fail(file + ": image needs alt text");
    if (node.tagName === "script" && !attr(node, "src"))
      fail(file + ": keep behavior in external scripts");
    if (node.tagName === "link" && attr(node, "rel") === "stylesheet")
      references.push(attr(node, "href"));
    for (const name of ["src", "poster"])
      if (attr(node, name)) references.push(attr(node, name));
    if (node.tagName === "a") {
      const href = attr(node, "href");
      if (href && !/^(https?:|mailto:|#)/.test(href)) references.push(href);
    }
  });
  for (const label of labels)
    if (attr(label, "for") && !ids.has(attr(label, "for")))
      fail(file + ": label target missing");
  for (const button of buttonTypes) {
    if (!text(button).trim() && !attr(button, "aria-label"))
      fail(file + ": button needs a name");
  }
  if (slides.length !== expectedSlides) fail(file + ": slide count mismatch");
  for (const [index, slide] of slides.entries()) {
    const prefix = file + " slide " + (index + 1);
    for (const name of ["id", "data-title", "data-notes", "aria-label"])
      if (!attr(slide, name)?.trim()) fail(prefix + ": missing " + name);
    if (!/^[a-z][a-z0-9-]*$/.test(attr(slide, "id") || ""))
      fail(prefix + ": invalid stable id");
    let heading = false;
    walk(slide, (node) => {
      if (["h1", "h2"].includes(node.tagName)) heading = true;
    });
    if (!heading) fail(prefix + ": needs a primary heading");
  }
  if (expectedSlides) {
    for (const required of [
      "stage",
      "current-slide",
      "slide-total",
      "overview-grid",
      "notes-text",
      "prev-button",
      "next-button",
    ]) {
      if (!ids.has(required))
        fail(file + ": missing runtime element " + required);
    }
    const active = slides.filter((node) => hasClass(node, "is-active")).length;
    if (active !== 1) fail(file + ": exactly one initial slide must be active");
  }
  for (const reference of references) await checkReference(file, reference);
}

const decks = await loadDecks();
for (const deck of decks) {
  for (const slide of deck.slides) {
    const fragment = parseFragment(slide.html, {
      onParseError: (error) => fail(slide.file + ": " + error.code),
    });
    const elements = fragment.childNodes.filter((node) => node.tagName);
    if (
      elements.length !== 1 ||
      elements[0].tagName !== "section" ||
      !hasClass(elements[0], "slide")
    )
      fail(slide.file + ": expected exactly one section.slide");
  }
  const rendered = await renderDeck(deck);
  let existing = "";
  try {
    existing = await readFile(sourcePath(deck.output), "utf8");
  } catch {
    /* reported below */
  }
  if (existing !== rendered)
    fail(deck.output + ": generated output is stale; run npm run build");
  await inspectHtml(deck.output, rendered, deck.slides.length);
}
const gallery = await renderGallery(decks);
if (
  (await readFile(sourcePath("gallery.html"), "utf8").catch(() => "")) !==
  gallery
)
  fail("gallery.html: generated output is stale");
await inspectHtml("gallery.html", gallery, 0);
const cssFiles = new Set([
  ...COMMON_STYLES,
  "styles/gallery.css",
  ...decks.flatMap((deck) => deck.styles),
]);
for (const file of cssFiles) {
  const css = await readFile(sourcePath(file), "utf8");
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))
    await checkReference(file, match[1], true);
  if (/@import\b/.test(css)) fail(file + ": use explicit stylesheet links");
}
async function javascriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(sourcePath(directory), {
    withFileTypes: true,
  })) {
    const relative = directory + "/" + entry.name;
    if (entry.isDirectory()) files.push(...(await javascriptFiles(relative)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(relative);
  }
  return files;
}
const scripts = [
  ...(await javascriptFiles("scripts")),
  ...(await javascriptFiles("runtime")),
  ...decks.flatMap((deck) => deck.scripts),
  ...(await javascriptFiles("tests")),
  "playwright.config.js",
];
for (const file of scripts) {
  try {
    execFileSync(process.execPath, ["--check", sourcePath(file)], {
      stdio: "pipe",
    });
  } catch (error) {
    fail(file + ": JavaScript syntax error\n" + error.stderr);
  }
}
if (errors.length) {
  console.error(errors.map((message) => "✗ " + message).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "✓ " +
      decks.length +
      " decks / " +
      decks.reduce((sum, deck) => sum + deck.slides.length, 0) +
      " slides",
  );
  console.log(
    "✓ HTML structure, stable IDs, metadata, accessible names, local resources",
  );
  console.log("✓ Generated pages match sources; JavaScript syntax checked");
}
