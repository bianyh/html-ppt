# Shared layouts and components

Shared components are styled with project tokens and available in every deck. Each deck can use a theme without forking the controls or player.

## Layouts

- .deck-shell: a 1600 × 900 content frame with shared safe-area padding.
- .layout-split: two columns for a takeaway and supporting diagram or product mockup.
- .layout-cards: three parallel examples, steps, or principles.
- .layout-compare: a before/after or two-option comparison.
- .deck-kicker, .deck-eyebrow, .deck-title, .deck-lead, .deck-footer: consistent editorial hierarchy.

## Components

- .c-card for a short idea, evidence or comparison; add .c-card--accent for a primary item.
- .c-tag for short labels, never paragraph-length content.
- .c-button and .c-button--ghost for actual actions. Every button needs a deck-scoped handler.
- .c-metric for a sourced or clearly labeled illustrative quantity.
- .c-browser for a static product/interface illustration.
- .c-timeline for three sequential steps, with a clear action and cadence.
- .c-quote for a real, attributed quote. Do not invent attribution.
- .c-code for short, readable code examples.

Keep component markup semantic and styles content-agnostic. Add one-off visuals in that deck's CSS; propose a new shared component only after a second deck has a genuine use for it.

## Themes

Set the deck manifest theme property to an existing theme in styles/tokens.css. Shared components inherit --ink, --ink-soft, --paper, --paper-muted, --lime, --muted, --line, --radius-card and typography. Add a theme override there rather than restating values across a deck stylesheet. Runtime overlays and controls must remain legible on every theme.

The `ruc-demi` theme is the first brand-template example. It distills the supplied `小组会汇报模板.pptx` into editable HTML patterns: `.ruc-band` for the polygon title banner, `.ruc-agenda-list` for the agenda, `.ruc-content-layout` for content pages, and `.ruc-demi-logo` / `.ruc-logo` for the brand lockup. Start from `decks/ruc-demi/` when a new deck needs this academic blue visual system, and keep its content in HTML rather than baking text into images.
