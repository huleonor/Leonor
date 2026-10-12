# Hugo's Piano: rules for every session

The anti-slop skill is guidance for avoiding generic AI design, not a theme: the look stays Duolingo's light app.

Read DESIGN.md before touching any UI. These rules are fixed unless the user changes them.

## Design system (Duolingo's app look)
- Colours only through the tokens in `src/styles.css` `:root`. Never hardcode a colour in a component or rule; add a token. The app is always white, like Duolingo: there is no dark theme.
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
- Screenshot phone and desktop before committing UI changes.
- No AI-purple gradients, no decorative dots, no emoji, at most one middle dot per line.
- One verb per action across the app. Button labels stay on one line.
- Loading, empty and error states for anything that loads.
- The logo is the penguin with round glasses (`public/icons/logo.png`, `<Logo />`). No characters or mascots in the UI for now; illustrations are big Phosphor icons on a tinted disc (`<Spot />`). Never use Duolingo's owl, logo or name in the app.
- The difficulty adapts invisibly: never show levels or "made easier" notes to the learner. Songs show no difficulty either.
- Step-by-step lessons (path lessons and a song's parts) keep Simply Piano's clear page in Duolingo's colours: pause, the step name, energy and streak chips, the n/N step pill with arrows. The staff is Simply Piano's: its lines run on across the whole screen, the clef and key signature stay at the left edge, played notes fade out behind them, and it grows with the screen. Nothing moves before he plays: the cursor starts on the first note, no run-up.
- The keyboard is help so he learns to read: hidden until he plays a wrong note or stalls, then a compact strip with every key the piece needs (next key gold) rises along the bottom and sinks again once he plays right. Options can keep it on.
- Every level teaches Simply Piano's way: free play first (the music waits for each note, no rhythm; hand by hand for two hands), then the same music "With the beat" with the metronome ticking (count-in, accent on beat 1). The metronome can be switched off in the options.
- Playing a whole song is minimal: close, progress bar, the score on a card, Listen and Learn step by step below, options under a gear. There the keyboard is help, not furniture: it rises only when he is stuck or plays a wrong note, shows a short stretch of keys with the right ones lit, and goes away again. "Play the first note to start" shows until he does.
- Life comes from state, Duolingo style: a streak chip that counts right notes, praise popping at milestones (5, 10, 15, 20, 30 in a row), the step pill springing forward, a step's verdict popping green or red.
- The piano connection is never a banner: a small piano-keys icon with an orange dot (green when connected) in the game bar and the lesson bars opens Settings.
- Tabs: Learn (the path), Songs, Shop. There is no Practice or Progress tab.
- Songs: the Songs tab shows only his library (small square covers); everything else lives in the marketplace, where one tap adds a song.
