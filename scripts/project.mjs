import {
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const COMMON_STYLES = [
  "styles/tokens.css",
  "styles/base.css",
  "styles/layouts.css",
  "styles/components.css",
  "styles/controls.css",
  "runtime/enhancements.css",
];
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

export function sourcePath(relative) {
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(ROOT + path.sep))
    throw new Error("Path outside project: " + relative);
  return resolved;
}

export async function loadDecks() {
  const directories = await readdir(path.join(ROOT, "decks"), {
    withFileTypes: true,
  });
  const decks = [];
  for (const entry of directories
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const manifestPath = "decks/" + entry.name + "/deck.json";
    const manifest = JSON.parse(
      await readFile(sourcePath(manifestPath), "utf8"),
    );
    if (manifest.id !== entry.name || !/^[a-z][a-z0-9-]*$/.test(manifest.id))
      throw new Error("Invalid deck id: " + manifestPath);
    for (const field of ["title", "description", "brand", "theme", "output"]) {
      if (typeof manifest[field] !== "string" || !manifest[field].trim())
        throw new Error("Missing " + field + ": " + manifestPath);
    }
    if (
      !/^[a-z0-9-]+\.html$/.test(manifest.output) ||
      ["gallery.html", "index.html"].includes(manifest.output)
    )
      throw new Error("Invalid output: " + manifestPath);
    if (!Array.isArray(manifest.slides) || !manifest.slides.length)
      throw new Error("No slides: " + manifestPath);
    if (new Set(manifest.slides).size !== manifest.slides.length)
      throw new Error("Repeated slide file: " + manifestPath);
    for (const field of ["styles", "scripts"]) {
      if (
        !Array.isArray(manifest[field]) ||
        manifest[field].some((item) => typeof item !== "string")
      )
        throw new Error("Invalid " + field + ": " + manifestPath);
      const extension = field === "styles" ? /\.css$/ : /\.js$/;
      for (const item of manifest[field]) {
        const normalized = path.posix.normalize(item);
        if (
          !item.startsWith("decks/" + entry.name + "/") ||
          normalized !== item ||
          !extension.test(item)
        ) {
          throw new Error(field + " paths must stay in their deck: " + item);
        }
      }
    }
    const slides = [];
    for (const file of manifest.slides) {
      if (typeof file !== "string" || !/^slides\/[a-z0-9-]+\.html$/.test(file))
        throw new Error("Invalid slide path: " + manifestPath);
      const relative = "decks/" + entry.name + "/" + file;
      slides.push({
        file: relative,
        html: (await readFile(sourcePath(relative), "utf8")).trim(),
      });
    }
    decks.push({ ...manifest, slides, manifestPath });
  }
  if (new Set(decks.map((deck) => deck.output)).size !== decks.length)
    throw new Error("Deck output filenames must be unique");
  return decks;
}

export async function renderDeck(deck) {
  const template = await readFile(sourcePath("templates/deck.html"), "utf8");
  const values = {
    id: escapeHtml(deck.id),
    title: escapeHtml(deck.title),
    brand: escapeHtml(deck.brand),
    theme: escapeHtml(deck.theme),
    description: escapeHtml(deck.description),
    count: String(deck.slides.length).padStart(2, "0"),
    styles: [...COMMON_STYLES, ...deck.styles]
      .map(
        (file) => '  <link rel="stylesheet" href="' + escapeHtml(file) + '">',
      )
      .join("\n"),
    scripts: deck.scripts
      .map((file) => '  <script src="' + escapeHtml(file) + '" defer></script>')
      .join("\n"),
    slides: deck.slides
      .map((slide, index) => {
        // Only the first page is visible when JS is disabled or before it loads.
        const html = slide.html.replace(
          /class="([^"]*\bslide\b[^"]*)"/,
          (_, classes) => {
            const clean = classes
              .split(/\s+/)
              .filter((value) => value !== "is-active")
              .join(" ");
            return 'class="' + clean + (index === 0 ? " is-active" : "") + '"';
          },
        );
        return html;
      })
      .join("\n\n"),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error("Unknown template key: " + key);
    return values[key];
  });
}

export async function renderGallery(decks) {
  const template = await readFile(sourcePath("templates/gallery.html"), "utf8");
  return template.replace(
    "{{cards}}",
    decks
      .map(
        (deck) =>
          '<a class="gallery-card" href="' +
          escapeHtml(deck.output) +
          '">' +
          '<div class="gallery-art" data-theme="' +
          escapeHtml(deck.theme) +
          '"><span>' +
          escapeHtml(deck.brand) +
          "</span><b>" +
          escapeHtml(deck.title) +
          '</b><i aria-hidden="true">↗</i></div>' +
          '<div class="gallery-description"><h2>' +
          escapeHtml(deck.title) +
          "</h2><p>" +
          escapeHtml(deck.description) +
          "</p>" +
          "<span>" +
          deck.slides.length +
          " 页 · 打开演示 ↗</span></div></a>",
      )
      .join("\n"),
  );
}

export async function buildSite(output = ROOT) {
  const decks = await loadDecks();
  const destination = path.resolve(output);
  if (destination !== ROOT && !destination.startsWith(ROOT + path.sep))
    throw new Error("Build output must be inside project");
  await mkdir(destination, { recursive: true });
  for (const deck of decks)
    await writeFile(
      path.join(destination, deck.output),
      await renderDeck(deck),
    );
  const gallery = await renderGallery(decks);
  await writeFile(path.join(destination, "gallery.html"), gallery);
  await writeFile(path.join(destination, "index.html"), gallery);
  if (destination !== ROOT) {
    const assets = new Set([
      ...COMMON_STYLES,
      "styles/gallery.css",
      "runtime/presentation.js",
      ...decks.flatMap((deck) => [...deck.styles, ...deck.scripts]),
    ]);
    // Include local media files referenced by slide HTML and CSS, while keeping source/config private.
    for (const asset of [
      ...assets,
      ...decks.flatMap((deck) => deck.slides.map((slide) => slide.file)),
    ]) {
      const source = await readFile(sourcePath(asset), "utf8");
      const references = [
        ...source.matchAll(
          /(?:src|poster|href)="([^"]+)"|url\(["']?([^"')]+)["']?\)/g,
        ),
      ];
      for (const match of references) {
        const reference = match[1] || match[2];
        if (/^(?:data:|https?:|#|%23)/i.test(reference)) continue;
        const relative = asset.endsWith(".css")
          ? path.posix.join(path.posix.dirname(asset), reference)
          : reference;
        assets.add(relative.split(/[?#]/)[0]);
      }
    }
    for (const asset of assets) {
      await mkdir(path.dirname(path.join(destination, asset)), {
        recursive: true,
      });
      await copyFile(sourcePath(asset), path.join(destination, asset));
    }
  }
  return decks;
}
