# Hugo's Piano: rules for every session

The anti-slop skill is guidance for avoiding generic AI design, not a theme: the look stays Duolingo's light app.

Read DESIGN.md before touching any UI. These rules are fixed unless the user changes them.

## Design system (Duolingo's app look)
- Colours only through the tokens in `src/styles.css` `:root` (light) and its `prefers-color-scheme: dark` block. Never hardcode a colour in a component or rule; add a token.
- Light and white like the Duolingo app: white ground, cards with a 2px `#e5e5e5` border and no drop shadow, `#f7f7f7` for wells.
- Primary is the logo's blue `#2b93ba` (edge `#1f7395`) with white bold uppercase text on chunky buttons (4px darker edge that presses down). It is also the one interactive accent (text links use `--blue-text`, underlined). Green (`--ok`, `#58cc02`) is only for a right answer or note; red only for a wrong one.
- Text `#3c3c3c`; muted `#777777` only for hints and labels, never body copy.
- Game colours (energy pink, gem blue, flame orange, star gold) each have a `-text` shade for text; use it.
- Unit colours carry their own text colour (`--unit-ink`): white, dark brown on gold.
- One family: Nunito, bold (body 700, headings 900, 0.8px tracking). Hierarchy by weight, modest sizes (page titles 22px).
- One radius: 12px for buttons, cards, inputs, dialogs. Circles for nodes and dots, full pills for chips.
- Spacing on a 10px unit (10, 20, 30, 40).
- Motion is state-driven (`src/components/Motion.tsx`, the `motion` library): every animation answers a change of state, never decoration. Springs for feedback (answer footer sliding up, a right option popping, a wrong one shaking, numbers bumping when they change, the progress bar springing forward, sheets rising, the help keyboard rising and falling). CSS transitions 300ms ease for hovers and colours. Loops only where they mean something (the START bubble, a ready chest). The app runs inside `<MotionConfig reducedMotion="user">`.
- Focus: 2px solid accent outline, 2px offset.

## Product UI rules (from the anti-slop skill)
- Icons: Phosphor only (`@phosphor-icons/react`), bold weight, fill for solid marks. Never hand-draw SVG icon paths; add the glyph to `Icons.tsx` or `GameIcons.tsx`.
- Zero em dashes and en dashes in anything the user sees. Use a hyphen, comma, colon or two sentences.
- Body text passes WCAG AA (4.5:1). Bold white labels on Duolingo's game colours are the accepted exception, as in Duolingo itself; never put small regular-weight text on them.
- Light and dark themes both work; screenshot both before committing UI changes.
- No AI-purple gradients, no decorative dots, no emoji, at most one middle dot per line.
- One verb per action across the app. Button labels stay on one line.
- Loading, empty and error states for anything that loads.
- The logo is the penguin with round glasses (`public/icons/logo.png`, `<Logo />`). No characters or mascots in the UI for now; illustrations are big Phosphor icons on a tinted disc (`<Spot />`). Never use Duolingo's owl, logo or name in the app.
- The difficulty adapts invisibly: never show levels or "made easier" notes to the learner. Songs show no difficulty either.
- Lessons and songs follow Duolingo's lesson frame: a close button and a progress bar on top, a heading saying what to do, the content on a card, and one footer with the action. The piano keyboard is help, not furniture: it rises only when he is stuck or plays a wrong note, shows a short stretch of keys with the right ones lit, and goes away again.
- Songs: the Songs tab shows only his library (small square covers); everything else lives in the marketplace, where one tap adds a song.
