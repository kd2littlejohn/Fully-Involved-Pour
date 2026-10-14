# FIP brand assets

Vector sources live in `web/src/assets/brand/`; PNGs in `web/public/` are rendered from them.

| File | Use |
| --- | --- |
| `fip-primary.svg` | Full lockup: monogram, FULLY INVOLVED POUR, divider, tagline. Gold. |
| `fip-horizontal.svg` | Compact lockup (monogram, divider, stacked name). Gold. Desktop app header. |
| `fip-icon.svg` | Monogram only. Gold, transparent. Favicon (`public/favicon.svg`), mobile top bar. |
| `fip-engraving.svg` | Monogram + name in one colour (`currentColor`): engraving, print, light backgrounds. |
| `fip-app-icon.svg` | Rounded dark tile with gold edge + monogram: PWA "any" icon. |
| `fip-app-icon-maskable.svg` | Full-bleed dark square, monogram inside the safe zone: PWA maskable / Apple touch icon. |

PNG exports: `public/favicon-32.png`, `public/favicon.png` (64), `public/apple-touch-icon.png` (180),
`public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, and transparent
`public/brand/fip-{primary,horizontal,icon,engraving-black,engraving-white}.png`.

The shapes were traced (potrace) from the approved one-colour logo in the brand sheet and filled
with an FIP gold gradient. On light backgrounds prefer `fip-engraving.svg` in a dark colour; the
gold tagline in `fip-primary.svg` is low-contrast on light.

Brand tagline: Drink What You Enjoy. Share What Matters.

## AXE artwork (pending: supplied by the FIP team)

AXE, the in-app personal sommelier, has its own mark. The approved files haven't been delivered
yet. Do not draw, trace or approximate them; the app uses an interim treatment until they arrive.

### Files needed

Add exactly these three files to `web/src/assets/brand/` (lower-case names, as written):

| File | What it is | Where it appears | Rendered size |
| --- | --- | --- | --- |
| `axe-symbol.svg` | The gold Glencairn glass and flame only. **No letters, no circle, no compass, no background.** | Centre AXE nav tab, desktop AXE nav pill, AXE insight card, inline "Ask AXE" prompts (bottle detail, My Bar, Your Palate, tasting forms), Home's Ask AXE quick action, the Blind reveal's Ask AXE button, chat header (until the compact wordmark arrives) | Square box, 22–40 px, sometimes on a dark disc |
| `axe-wordmark.svg` | Full wordmark: the symbol with "AXE" and "Your Personal Sommelier" | AXE Hub header | 96–128 px tall, width follows the artwork, centred, phones from 320 px wide |
| `axe-wordmark-compact.svg` | Compact wordmark: "AXE" (with or without the symbol), no tagline | AXE chat header title | 32 px tall, width follows the artwork |

### Requirements for each file

- **Transparent background**: no background rectangle, no solid fill behind the artwork.
- **Pure vector**: outlined text (no live fonts), no embedded PNG or JPEG.
- **Readable on the app's dark background** (`#11161c`).
- **Tight artboard**: the `viewBox` hugs the artwork, with at most a few percent of padding.
  - `axe-symbol.svg` uses a **square** `viewBox` with the artwork centred, so it sits correctly
    in the round nav tab.
- **Detail that holds up at 22 px** for the symbol.
- Optional: matching transparent PNGs at 2× and 3× for use outside the app. The app itself only
  needs the SVGs.

### How the swap works

All AXE artwork comes from `web/src/features/sommelier/AxeMark.tsx`. It looks for the three files
above and picks each one up automatically at build time, so no code changes are needed. Until a
file is present, its surface keeps the interim treatment:

- **Symbol:** the approved FIP monogram (`fip-icon.svg`), which contains the same glass and flame.
- **Wordmarks:** "AXE" set in the display font (with "Your Personal Sommelier" on the Hub).

When the files land, also update `web/src/features/sommelier/AxeMark.test.tsx`, which asserts the
interim state. Then run the web checks and review the Hub, chat header, nav tab and an insight
card at 320 px, 390 px and desktop.
