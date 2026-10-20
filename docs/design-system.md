# Design system (extracted from the prototype)

The prototype's visual language is defined by hand-written CSS, not a utility framework. The
migration keeps that CSS as the source of truth: it is split back into its 22 original source files
under `src/styles/prototype/`, imported in the original cascade order. Values below were extracted
from that CSS and are centralised as tokens in `src/styles/tokens.css` (also exposed to Tailwind via
`@theme`).

## Three palettes ("scopes")

The prototype has a base palette, then re-themes the workspace and the public site. The cascade
order matters, so the tokens are declared per scope exactly as the prototype does.

| Token | Base `:root` | Workspace (`body.professional-theme`) | Public site (`.public`) |
| --- | --- | --- | --- |
| `--bg` | `#f7f8fa` | `#F6F8FA` | `#F6F8FA` |
| `--paper` | `#fff` | `#ffffff` | — |
| `--ink` (text primary) | `#202631` | `#202A36` | `#202A36` |
| `--muted` (text secondary) | `#727887` | `#626B76` | `#626B76` |
| `--line` (border) | `#e8e9ee` | `#E4E9EF` | `#E4E9EF` |
| `--accent` (primary) | `#5146e5` (violet) | `#315EF4` (blue) | `#315EF4` |
| `--accent-soft` | `#efedff` | `#E4E9EF` | `#EAF0FF` |
| `--green` (recorded activity) | `#26875c` | — | — |
| `--text-emphasis` | — | `#4169A1` | — |
| `--radius` (card) | `12px` | — | — |
| `--shadow` | `0 8px 28px #20263106` | `0 8px 28px #202a3609` | — |

Other frequent colours: `#244AD1` (primary hover, workspace), `#4338ca` (primary hover, base),
`#244A73` (navy, dialog backdrop `#244A7355`), `#172B4D`, `#0F766E` (teal accents), `#D92D20` /
`#B42318` (errors), `#14765B` (success), and the Work Pulse ramp
`#eff1f1 → #d5eddf → #a6d7bd → #66b58b → #2e8c60`.

Avatar backgrounds rotate through `#dddaf5 #dbe8df #f0dfd4 #eadbe9 #d7e5ed #f1e8cc`; recruiters use
`#E4E9EF` / `#E8EDF5`.

## Typography

| Role | Family | Notes |
| --- | --- | --- |
| Body | **DM Sans** 400/500/600/700 | `:root` font family; `font-synthesis:none`. |
| Headings, brand | **Manrope** 400–800 | `h1–h4, .brand`. |
| Base sizes | h1 30px/750, h2 21px, h3 16px; eyebrow 11px/700 uppercase, letter-spacing 1.6px | |
| Workspace | Body 16px; most UI text raised to 15px; form controls in dialogs 16px (prevents iOS zoom) | |
| Public site | 15px base | |

Fonts are self-hosted from `public/fonts/` with the same `@font-face` declarations
(`font-display: swap`). No external font CDN is used, as in the prototype.

## Shape and elevation

| Element | Value |
| --- | --- |
| Card | `border:1px solid var(--line)`, radius `12px`, padding `23px`, workspace shadow `0 3px 16px #202a3606` |
| Controls (button, input, select, textarea) | radius `7px`; `.btn` min-height 40px (`.sm` 32px, `.lg` 48px) |
| Icon button | 36×36px, radius 8px |
| Tag | radius 5px, padding `4px 8px` |
| Avatar | circle; 38px / `.lg` 68px / `.xl` 92px; 3–4px white ring |
| Dialog | radius 14px, `width:min(600px, 100% - 30px)`, `max-height:90vh`, shadow `0 24px 100px #22213d33`, blurred backdrop. Variants: `.notification-sheet` (right sheet), `.project-sheet` (full-height sheet), `.following-sheet`. |
| Toast | `#2f3043` background, radius 9px, bottom-right, 4 s |

## Icons

A single stroke icon set (24×24 viewBox, stroke-width 1.65, round caps) defined as path data in the
prototype (`paths` in `ui.js`), plus 32×32 feed action icons (`feed-action-icons.js`) and the
brand mark. These are ported 1:1 into `src/components/ui/icon.tsx`. Lucide was **not**
substituted because the prototype's icons are custom drawings, and swapping them would change the
visual identity.

## Spacing and layout

* Workspace header: 83px tall, max width 1380px, padding `0 30px`.
* Feed: `max-width:1420px`, three columns `305px | 1fr | 280px`, gap 24px. These shrink at 1300 and
  1050px and collapse at 680px.
* Sticky rails: `top:108px`, with internal scrolling.
* Public containers: `.ph-container` / `.container`.
* Page heading: flex, `margin-bottom:26px`, h1 27px.

## Motion

* Buttons: `background .15s, transform .15s`.
* Toast: `toast-in .2s`.
* Navigation dock: spring physics (stiffness 180, damping 22) scaling icons up to 1.45×.
* Share icon "is-sharing" state for 2 s; like rays animation.
* All of these respect `prefers-reduced-motion`; CSS media queries remove transitions.

## Form fields

Every labelled control is rendered as an **outlined floating-label field**:

```html
<label class="field">
  <span class="floating-field [is-textarea|is-select|is-date|is-compact] [has-value] [is-required]">
    <input placeholder=" " aria-labelledby="…">
    <span class="floating-label" id="…">Label<span class="floating-required" aria-hidden="true">*</span></span>
  </span>
</label>
```

`src/components/ui/field.tsx` renders this DOM directly. The prototype produced it with a
MutationObserver; the React version builds the same structure without DOM rewriting. Controls inside
`[data-no-floating-label]`, and checkboxes, radios, file inputs and colour inputs, stay plain.

## Tailwind

Tailwind CSS v4 is installed **without Preflight**: its reset would override the prototype's
element styles. Only `theme` and `utilities` layers are imported, and tokens are mapped with
`@theme inline` (for example `bg-paper`, `text-ink`, `border-line`, `text-accent`). Migrated screens
use the original class names so the cascade stays identical; utilities are available for new UI.
shadcn/ui was **not** adopted, for the same fidelity reason (its primitives ship their own visual
language). Accessible behavior such as dialog focus handling and menus comes from native elements
(`<dialog>`, `<details>`), as in the prototype.
