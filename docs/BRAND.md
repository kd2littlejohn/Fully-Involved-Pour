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
