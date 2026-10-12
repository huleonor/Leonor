# Hugo's Piano: rules for every session

Read DESIGN.md before touching any UI. These rules are fixed unless the user changes them.

## Design system (Duolingo's measured tokens)
- Colours only through the tokens in `src/styles.css` `:root` (light) and its `prefers-color-scheme: dark` block. Never hardcode a colour in a component or rule; add a token.
- Ground `#ddf4ff`; white cards with a soft tinted shadow (`--shadow`), no borders on cards.
- Primary `#a5ed6e` with near-black text `#111111`. One interactive accent `#1cb0f6` (text links use `--blue-text`, underlined).
- Text `#3c3c3c`; muted `#777777` only for hints on white, never body copy on the blue ground.
- Game colours (energy pink, gem blue, flame orange, star gold) each have a `-text` shade for text; use it.
- Unit colours carry their own text colour (`--unit-ink`): near-black on bright colours, white on deep ones.
- One family: Nunito, bold (body 700, headings 900, 0.8px tracking). Hierarchy by weight, modest sizes (page titles 22px).
- One radius: 12px for buttons, cards, inputs, dialogs. Circles for nodes and dots, full pills for chips.
- Spacing on a 10px unit (10, 20, 30, 40).
- Motion: 300ms ease for every transition and one-shot animation; loops only where they mean something (Pip, the START bubble, a ready chest). Everything honours `prefers-reduced-motion`.
- Focus: 2px solid accent outline, 2px offset.

## Product UI rules (from the anti-slop skill)
- Icons: Phosphor only (`@phosphor-icons/react`), bold weight, fill for solid marks. Never hand-draw SVG icon paths; add the glyph to `Icons.tsx` or `GameIcons.tsx`.
- Zero em dashes and en dashes in anything the user sees. Use a hyphen, comma, colon or two sentences.
- Every text/background pair passes WCAG AA (4.5:1, 3:1 for large bold). Check new buttons and chips in both themes.
- Light and dark themes both work; screenshot both before committing UI changes.
- No AI-purple gradients, no decorative dots, no emoji, at most one middle dot per line.
- One verb per action across the app. Button labels stay on one line.
- Loading, empty and error states for anything that loads.
- Pip the penguin is the only mascot; at most one Pip per screen. Never use Duolingo's owl, logo or name in the app.
- The difficulty adapts invisibly: never show levels or "made easier" notes to the learner.
