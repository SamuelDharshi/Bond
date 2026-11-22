# UI reference: what we studied and how Bond differs

Studied in headless Chrome (1440px and 390px full-page captures, the first-load sequence captured frame by frame, computed styles, network requests, the public stylesheet `site.css` and the inline landing script). Nothing from the reference is copied: its name, copy, logo, video and photo are not used. Bond keeps the **look, motion and rhythm** only.

## Findings (measured)

**Palette:** page `#ebebeb`, panels `#ffffff`, dark bands `#0b0b0b`, ink `#111111`, muted `#555555`, faint `#666666`, rules `#d4d4d4` (dark `#242424`), accent green `#1cc744` (text variant `#0e7a2c`), red `#ff5126`, amber `#a67c0e`. No gradients on the page itself; soft `0 12px 40px rgba(0,0,0,.07)` shadow on the stat strip.

**Type:** Space Grotesk (display, 600, tight negative tracking, h1 uppercase, 109px at 1440 = `clamp(38px, 7vw, 124px)`, h2 52px, line-height ~1), Inter (text, 15px), Geist Mono (nav, labels, numbers, 11 to 13px, uppercase labels with +0.06em tracking). Navigation labels are lowercase snake_case in mono.

**Layout rhythm:** 1280px container with `clamp(18px, 3.5vw, 44px)` gutters. Order: transparent top bar over the hero, eyebrow (green 8px square + mono caps), huge headline, centred lead and three pill buttons, a live stats strip, a three-card numbered section, a black "how it connects" band with four flow cards, four bracketed `[ 01 ]` facet cards, a "what is live" table with status pills, a black CTA block, a builder block, and a four-column footer with a legal line. Sections are padded `clamp(64px, 9vw, 120px)`.

**Shapes:** cards 16px radius with a 1px `#d4d4d4` border, bands and CTA 24px, buttons and pills fully rounded (999px). Hover: buttons turn green, nav links get a 2px green underline offset 6px.

**Background:** a 12.5 s 1280x720 looping _video_ of speckled ink (dark grey, green and purple clouds on grainy off-white) with a poster image. **No canvas, no WebGL, no three.js** (verified: 0 canvases, `window.THREE` undefined). Their "ink" is video, not 3D.

**Intro (measured):** nav starts `translateY(-100%)`, page starts `translateY(100vh)` over the full-height ink. After ~1 s both slide to place over **1500 ms** with `cubic-bezier(.65, 0, .35, 1)` while the ink shrinks to `70svh` with a bottom fade mask; the logo lockup fades in 700 ms later. Skipped for reduced motion or when a hash is present. The first frame (poster) shows two ring glyphs in speckled ink.

**Interactions:** sticky bar goes translucent (`rgba(235,235,235,.88)` + 12px blur + bottom rule) after 80px of scroll; smooth in-page anchor scrolling; link hover underlines; buttons transition 0.18 s. No cursor effects, no marquee, no scroll-jacking.

## How Bond maps onto it

| Reference            | Bond                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ink video            | Original canvas: stippled gaussian ink clouds pre-rendered as sprites, drifting and rotating, plus an SVG grain layer. Original ink-drawn "coins into a seal" SVG.                                                                                                         |
| Slide-over intro     | Same mechanism and timing (1500 ms, same easing), preceded by a ~1.8 s loader.                                                                                                                                                                                             |
| Loader               | Official Bitcoin Cash coin inks in as a stroke, fills BCH green, spins once, hands off to the Bond mark. First visit per session, click to skip, plain fade for reduced motion.                                                                                            |
| No 3D                | **Addition:** an ink-outlined toon 3D coin (official BCH face) that drops into the Bond seal and splits into Refund / Forfeit to charity / Reclaim on scroll. Lazy-loaded, paused off-screen, static ink poster on phones, low-power devices, reduced motion and no WebGL. |
| Facet and step cards | `[ 01 ]` cards: Contract, GitHub Action, WizardConnect, No backend.                                                                                                                                                                                                        |
| What is live table   | Contract txid, web app, Action repo, 12/12 on-chain tests, WizardConnect.                                                                                                                                                                                                  |
| Builder block        | Team block with pixel-art avatar placeholders (`packages/web/src/team.ts`).                                                                                                                                                                                                |

All tokens live in `packages/web/src/theme.css`.
