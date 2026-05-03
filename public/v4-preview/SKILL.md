---
name: infohub-design
description: Use this skill to generate well-branded interfaces and assets for InfoHub, the real-time crypto derivatives intelligence platform (funding rates, open interest, liquidations, options across 33 exchanges), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping — Bloomberg-terminal-meets-Coinglass aesthetic: dark, dense, orange accent, tabular-numeric everywhere.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quickstart for this system
- Link `colors_and_type.css` — it provides every CSS var and semantic class.
- Body background: `var(--hub-black)` (#07090d). Card: `var(--hub-darker)` (#1b1f2b). Never pure #000 or #fff.
- Orange (`--hub-accent` #FFA500) is precious — only CTAs, active state, logo, extreme values.
- Green/red are reserved for market direction. Purple is reserved for Hub AI features.
- Every number uses JetBrains Mono + `font-variant-numeric: tabular-nums`. No exceptions.
- Icons: Lucide only, 2px stroke outline, 12–20px. Never emoji.
- Copy tone: flat Title Case labels + irreverent trader-native tooltips ("Funding apocalypse", "Shorts paying through the nose"). Never marketing fluff.
- Exchange logos live in `assets/exchanges/` — use the PNGs directly.
- Full UI-kit recreation of the terminal is in `ui_kits/terminal/`.
