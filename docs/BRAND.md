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

## AXE artwork

AXE, the in-app personal sommelier, has its own mark. Do not redraw, trace, recolour or crop any of
these files beyond what is described here.

### AXE Hub hero

`web/src/assets/axe-hero.webp` (1046 × 518) is the primary logo from the approved AXE brand sheet
(polished metallic AXE lettering, Glencairn glass and flame, "Your Personal Sommelier"). It is cut
from the sheet's primary-logo panel only, at the sheet's native resolution, with the panel captions
and the other panels left out. The artwork itself is unaltered.

The Hub shows it full width at its own proportions, never cropped or stretched (capped at 640 px on
wide screens). It is feathered into a warm glow that fades out at every edge, and on phones it runs
up behind the transparent top bar like Home's hero.

### Interface marks

| File | What it is | Canvas | Where it appears |
| --- | --- | --- | --- |
| `brand/axe-symbol.svg` | The gold Glencairn glass and flame only. No letters, circle or compass. | 600 × 1090, transparent | Mobile centre nav tab (46 px, in the indicator slot so its label lines up with the other tabs; no disc or ring), desktop AXE nav pill, AXE insight card, inline "Ask AXE" prompts, Home's Ask AXE quick action, the Blind reveal's Ask AXE button |
| `brand/axe-wordmark-compact.svg` | Compact "AXE" wordmark with the glass and flame, no tagline | 1200 × 900, transparent | AXE chat header title, 56 px tall |
| `brand/axe-wordmark.svg` | Full wordmark with "Your Personal Sommelier" | 1180 × 725, transparent | Not currently used; the Hub uses the hero artwork instead |

These SVGs are single-colour traces with a gold gradient. Their edges are distressed rather than
polished, unlike the approved metallic design. They stay in use for the small interface placements
until clean artwork is supplied (see below).

All interface marks come from `web/src/features/sommelier/AxeMark.tsx`. Every placement keeps each
file's own proportions:

- **Symbol:** drawn in a square box with `object-fit: contain`. It is tall (about 1 wide to 3
  tall), so the box is sized by the height it should reach.
- **Compact wordmark:** given a height, with the width following the artwork.

If a file is missing, its surface falls back to the FIP monogram (`fip-icon.svg`) or to "AXE" set in
the display font. `web/src/features/sommelier/AxeMark.test.tsx` asserts that the approved files are
the ones in use.

### Still needed for a fully polished set

Clean, final artwork in the polished metallic style of the approved brand sheet, each on a
transparent background:

1. **AXE symbol:** the glass and flame only, no letters, circle or compass.
   - Either a clean SVG with smooth, undistressed edges, or a transparent PNG at least
     512 px tall.
   - Square canvas, artwork centred.
   - It must hold up at 24–46 px.
2. **Compact AXE wordmark:** "AXE" with the glass and flame, no tagline.
   - Either a clean SVG, or a transparent PNG at least 600 px wide.
3. **Optional, higher-resolution hero:** the primary logo at 2000 px wide or more (WebP, PNG or
   high-quality JPEG).
   - The current cut is 1046 px wide, which is under 3× pixel density on large phones.

Drop replacements in with the same file names (or a PNG with a matching name, plus a one-line import
change in `AxeMark.tsx`).
