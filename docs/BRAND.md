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

AXE, the in-app personal sommelier, has its own mark. These are the official files supplied by
the FIP team. Do not redraw, trace, recolour or crop them.

| File | What it is | Canvas | Where it appears |
| --- | --- | --- | --- |
| `axe-symbol.svg` | The gold Glencairn glass and flame only. No letters, circle or compass. | 600 × 1090, transparent | Mobile centre nav tab (54 px tall, standing on its own with no disc or ring), desktop AXE nav pill, AXE insight card, inline "Ask AXE" prompts, Home's Ask AXE quick action, the Blind reveal's Ask AXE button |
| `axe-wordmark.svg` | Full wordmark with "Your Personal Sommelier" | 1180 × 725, transparent | AXE Hub header, `min(340px, 80vw)` wide |
| `axe-wordmark-compact.svg` | Compact "AXE" wordmark with the glass and flame, no tagline | 1200 × 900, transparent | AXE chat header title, 56 px tall |

All three are single-colour vector paths filled with the AXE gold gradient on a transparent
background, with no embedded images. The original PNG exports (transparent) and a preview sheet
were supplied with them but aren't needed by the app.

### How they're used

All AXE artwork comes from `web/src/features/sommelier/AxeMark.tsx`, which picks the three files
up from `web/src/assets/brand/`. Every placement keeps each file's own proportions:

- **Symbol:** drawn in a square box with `object-fit: contain`. It is tall (about 1 wide to 3
  tall), so the box is sized by the height it should reach.
- **Wordmarks:** given one dimension, with the other following the artwork.

If a file is ever removed, its surface falls back to the FIP monogram (`fip-icon.svg`) or to
"AXE" set in the display font. `web/src/features/sommelier/AxeMark.test.tsx` asserts that the
approved files are the ones in use.
