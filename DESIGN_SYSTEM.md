# Design System — Art & Handmade Marketplace

**Step 2 deliverable.** Companion: `design-system.html` (live, interactive token/component preview — open it to see everything below rendered).

Design brief in one line: *digital art gallery + modern editorial magazine + creator marketplace.* Artwork is the hero; the interface stays quiet around it.

---

## 1. Color

Warm paper ground, ink-charcoal text, two sparing accents. Artwork supplies the rest of the color on any given page — the palette below is deliberately restrained so it never competes.

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#F2ECDD` | Page background |
| `--paper-deep` | `#E8DFC9` | Card/section fill, replaces box-shadow for depth |
| `--ink` | `#211D16` | Primary text, headlines |
| `--charcoal` | `#4A4438` | Secondary text, captions, metadata |
| `--stone` | `#B8AF9B` | Borders, dividers, disabled states, placeholders |
| `--clay` | `#A6532E` | Accent — sold/reserved badges, active nav, primary CTA fill |
| `--moss` | `#59613F` | Accent — made-to-order/custom/availability badges |
| `--paper-0` | `#FFFFFF` | Rare: gallery-label cards, image mattes |

Rules:
- Never introduce a third accent hue. Clay = urgency/scarcity/action. Moss = availability/craft status. That's the whole accent vocabulary.
- Dark mode is not in MVP scope — the gallery-wall metaphor depends on the warm paper ground.
- On any artwork-dense page, accents should appear on UI chrome only (badges, buttons, active filters), never as decorative background washes.

## 2. Typography

**Editorial / display — Fraunces** (variable, use the `opsz` axis at high values for display sizes — it gets softer and more characterful at large sizes, which is the point).
**UI / commerce — Instrument Sans** (geometric-humanist; used for navigation, prices, buttons, forms, metadata — anything that must be scannable and neutral).

Two families, clearly separated roles. Never use Fraunces for a price or a form label; never use Instrument Sans for an editorial headline.

| Style | Family | Size (desktop) | Weight | Notes |
|---|---|---|---|---|
| Display | Fraunces | 88px / 1.02 | 380 | Homepage hero only |
| H1 | Fraunces | 48px / 1.08 | 420 | Section/page titles |
| H2 | Fraunces | 30px / 1.15 | 440 | Subsection titles |
| H3 | Instrument Sans | 20px / 1.3 | 560 | Card titles, creator names |
| Body | Instrument Sans | 16px / 1.6 | 400 | Descriptions, paragraphs |
| Body small | Instrument Sans | 14px / 1.55 | 400 | Secondary copy |
| Label | Instrument Sans | 13px / 1.3 | 560, +1.5% tracking | Filters, tags, metadata rows — sentence case, not all-caps |
| Price/Data | Instrument Sans | 16px / 1.2 | 560, tabular-nums | Prices, edition counts, quantities |

Line length target: 60–75 characters for body copy. Serif display copy can run wider.

## 3. Spacing & Grid

Spacing scale (px): `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.

Layout: 12-column grid, max content width 1440px, gutter 24px (mobile: 16px). Editorial sections break the grid intentionally — a featured artwork block can span 7 columns while its supporting pair spans 5, rather than every block being an even fraction of 12. Avoid a uniform 4-column identical-card layout anywhere artwork is displayed (brief §53 explicitly rules this out).

```
Featured Art section — asymmetric composition:
┌─────────────────────────────┬───────────────┐
│                             │   Medium work  │
│                             ├───────────────┤
│      Large feature          │   Medium work  │
│                             ├───────┬───────┤
│                             │ Small │ Small │
└─────────────────────────────┴───────┴───────┘
```

## 4. Shape & Elevation

- Radius: `0px` on artwork frames, images, and primary cards — the gallery-wall metaphor wants sharp edges, not rounded SaaS corners.
- Radius `3px` on buttons, inputs, small controls — just enough to soften interactive elements without reading as "app."
- Radius `999px` (pill) is reserved for filter chips only, where the pill shape communicates "toggle."
- No drop shadows for depth. Use `--paper-deep` fills and 1px `--stone` hairlines instead. One exception: modals/overlays get a single soft shadow to separate them from page content.

## 5. Motion

Principle from the brief: **cinematic when discovering, calm when buying.**

- One orchestrated reveal on the homepage hero load (artwork pieces settle into place, staggered ~80ms apart, 600ms ease-out) — not repeated on every section scroll.
- Artwork image hover: scale to 1.03 + slight brightness lift, 300ms. No rotation, no shadow pop.
- Grid → detail page transition: the clicked thumbnail is the shared element that expands into the detail hero image (view-transition or FLIP technique), so navigation feels like walking closer to a piece on a wall, not a page reload.
- Filter/sort changes: results cross-fade (200ms), never a hard flash or full skeleton reload for small changes.
- Checkout flow: motion is turned down deliberately — only functional transitions (step change, validation error, success confirmation). No decorative animation on the payment screen.
- All motion respects `prefers-reduced-motion`: reveals and parallax collapse to instant/opacity-only fallbacks.

## 6. Core Components

**Gallery Label** — the signature component. A small card mimicking a museum wall label: artwork title (Fraunces, 18px), then medium + dimensions + creator name (Instrument Sans label style), price bottom-right (Data style). Used on every artwork card and in the detail page metadata block. This is functional signage, not decoration — it's the one place information density is allowed.

**Buttons**
- Primary: `--ink` fill, `--paper` text, 3px radius, no icon by default.
- Secondary: transparent fill, 1px `--ink` border.
- Ghost: text-only, used inline (e.g. "Contact Creator").
- Never append an arrow glyph to button text by default — only use one when the action genuinely navigates onward in a multi-step flow.

**Badges** — small rounded-rect (3px), used for status only: `Sold` / `Reserved` (clay), `Made to Order` / `Custom` (moss), `New` (stone outline, ink text — deliberately quiet, not a shouty "NEW" accent chip).

**Cards** — `--paper-deep` fill, 1px `--stone` hairline, 0 radius, generous internal padding (24px). No shadow.

**Navigation** — sits on `--paper`, hairline bottom border only, no shadow. Creator handle appears as `@handle` in Instrument Sans, never as a decorative eyebrow.

**Filters** — pill chips (999px radius — the one intentional use of full rounding), `--stone` border default, `--ink` fill when active.

## 7. Accessibility Notes

- Ink-on-paper contrast ratio: `#211D16` on `#F2ECDD` ≈ 13.9:1 — comfortably passes AA/AAA for body text.
- Clay (`#A6532E`) on paper ≈ 4.6:1 — sufficient for large text/icons but body-size clay text should be avoided; pair clay badges with ink text on a clay-tinted background rather than clay text on paper.
- All interactive elements get a visible focus ring (2px `--clay` outline, offset 2px) — never `outline: none` without a replacement.
- Motion described in §5 all has a reduced-motion fallback.

---

See `design-system.html` for the live rendering of all tokens and components above.
