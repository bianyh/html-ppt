# Coding agent authoring contract

This repository is an agent-friendly authoring system for browser-native slide decks. Read this file before changing presentation content or runtime behavior. Source decks live in decks/; root HTML files are generated output. Keep authored content semantic, visual quality high, and interactions meaningful.

## User brief

Before composing, identify the audience, presentation goal, duration, central takeaway, required evidence or materials, and visual direction. If one detail is missing, use a sensible assumption and state it in the deck notes. Avoid invented facts, results, quotes, sources, or customer claims. Distinguish illustrative mockups and scenario estimates from measured product data.

## Project map

- decks/<id>/deck.json orders slides and declares deck metadata, output filename, theme, styles, and optional behavior scripts.
- decks/<id>/slides/*.html contains one authored semantic section.slide per file.
- decks/<id>/*.css and *.js contain visual rules or interaction behavior for that deck.
- runtime/presentation.js is the shared player. It must remain content-agnostic and must not query IDs unique to one deck.
- styles/tokens.css, styles/layouts.css, styles/components.css, styles/controls.css, runtime/enhancements.css define shared visual and interaction patterns.
- templates/deck.html and templates/gallery.html generate standalone entry pages.
- scripts/build.mjs creates index.html, gallery.html, and each declared output. Do not hand-edit generated files.
- docs/COMPONENTS.md and docs/SLIDE-BRIEF.md describe reusable patterns and the content brief.

## Deck manifest

Every deck needs a deck.json with a lowercase, URL-safe ID that equals its directory name; a title, description, brand, theme, unique .html output filename; arrays of slide files, deck CSS files, and behavior scripts. List slides in presentation order. Each path must stay inside that deck directory. Use theme field or define a new token theme in styles/tokens.css.

## Slide contract

Each slide file contains exactly one top-level section with a stable ID, the slide class, a data-title, concise data-notes, and an accessible aria-label. IDs must remain unique within a deck; links use a stable fragment such as #calculator. Every slide has a clear primary h1 or h2, non-empty notes, a useful Chinese accessible label, and a title concise enough for the overview. Put research citations and speaking transitions in data-notes or in the page when the audience needs them.

    <section id="stable-kebab-case" class="slide"
      data-title="A short overview title"
      data-notes="Presenter context, transitions, or sources."
      aria-label="An accessible description of this slide">
      <div class="deck-shell">
        <div class="deck-kicker"><span>SECTION / 01</span><span>SHORT CONTEXT</span></div>
        <h1 class="deck-title">One clear takeaway.</h1>
        <div class="deck-footer"><span>OPTIONAL LABEL</span><span>01</span></div>
      </div>
    </section>

## Design and content rules

- A slide expresses one claim or one step in a narrative. Use takeaway headlines, enough negative space, legible scale, and an illustrative visual that advances the claim.
- Use shared layouts and components from styles/layouts.css and styles/components.css before creating deck-specific UI. Centralize theme decisions in CSS tokens; avoid inline styling and one-off global selectors.
- Respect the 1600 × 900 stage. Keep important content inside a safe area of roughly 90 px horizontally and 55 px vertically. Check headings, controls, footers, and visual boundaries on every slide at presentation size.
- Use plain language appropriate to the audience. Use specific examples instead of inflated claims. Every number needs a clear source or a clearly stated illustrative formula.
- Use CSS or inline SVG for diagrams and UI mockups. Avoid dependencies on remote fonts, images, APIs, analytics, or scripts. Keep a useful local fallback if a deck has optional media.
- Use semantic headings, lists, figures and captions, real form labels, button accessible names, useful image alt text, visible focus, and sufficient contrast.
- Avoid autoplay media and distracting perpetual motion. Honor prefers-reduced-motion for every animation and timed effect.
- Scope deck interactions beneath the deck root. Keep behavior out of the global runtime. On slide changes, reset temporary state as appropriate. Interactive controls must be real, keyboard-accessible controls; global navigation must not intercept their input keys.

## Authoring loop

1. Read this contract, the deck manifest, and existing slides needed to understand the story and design.
2. Outline the narrative and page count. Give each page one takeaway headline and a clear progression from setup to evidence or example to conclusion.
3. Implement semantic slide files with notes, stable IDs, and the shared component vocabulary. Add deck-scoped CSS and JS only when required.
4. Run npm run build, npm run check, and npm test. Address every failure rather than weakening meaningful assertions.
5. Run npm run dev, open the browser, and review every page at presentation size and a smaller viewport. Check content, contrast, layout boundaries, keyboard controls, overview, notes, links, and interactions. Browser tests do not replace visual judgment.
6. Tell the user what changed, the local preview URL, validation results, and any remaining known limitations.

## Shared player controls

- Left/right and up/down arrows, and Space: previous or next; Shift+Space: previous.
- Home/End: first or last; number 1–9: direct jump.
- O: accessible slide overview; arrow keys choose cards, Enter opens one, Escape closes.
- N: speaker notes; F: fullscreen; ?: show controls; Escape: close non-modal overlays.
- Touch: horizontal swipe on non-interactive slide regions.
- Hash: stable IDs such as #calculator; legacy #slide-3 links are supported.
