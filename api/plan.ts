/**
 * Reads a song and writes the fastest way to master it (Vercel function, POST /api/plan).
 *
 * The app sends the score as text (src/lib/reading.ts); Claude reads it the way a piano teacher
 * would before a first lesson and answers with a Strategy (src/lib/strategyShape.ts): which part
 * to learn first, how to split each part into phrases, whether the hands start together, one
 * phrase at a time, or the lead hand through the whole part first, which patterns to learn on
 * their own before anything else, which spots to drill early, and how slow to start with the beat.
 * Mastery follows it and keeps adapting to how he plays on top.
 *
 * Needs ANTHROPIC_API_KEY in the Vercel project's environment variables.
 */
import Anthropic from '@anthropic-ai/sdk';
import { checkStrategy, STRATEGY_SCHEMA, type Shape } from '../src/lib/strategyShape.js';

const MAX_READING = 300_000;

const SYSTEM = `You are an expert piano teacher planning how one learner will master one piece as fast as possible, inside a practice app.

How the app teaches (you choose the plan; the app runs it and adapts live to every note he plays):
- A song is learnt part by part. A part is split into phrases. Each phrase is learnt in free play first (the music waits for each right note, no rhythm), then the part is played with the metronome, starting slow and climbing a tempo ladder (60%, 70%, 80%, 90%, 100%).
- Principles: he should get far more right than wrong; slow and without rhythm first, then with the beat; stop and go back before mistakes get practised; short daily sessions; keep the difficulty in the zone just above what he can do.
- The app already measures his accuracy per bar, per hand and per movement and adapts what comes next. Your job is the starting plan: the order and the way in that wastes the least practice for this particular piece.

What to decide, from the score you are given:
- order: which part to learn first. Usually song order, but learn first the part whose material comes back most (it pays off everywhere), and leave a part that only makes sense after another one until after it.
- For each part:
  - phrases: real musical phrases (where the melody breathes, cadences, where the pattern changes), 2 to 8 bars each, about 4 when unsure.
  - hands:
    - "together" when the hands mostly move in one rhythm (block chords with the melody, hands in unison or mirror); learning them apart would waste time.
    - "hand-by-phrase" for the usual melody plus accompaniment: each phrase hand by hand, then both.
    - "lead-hand-first" when the hands are independent (an ostinato or arpeggiated left hand under a syncopated melody, a busy hand that must run on its own): the lead hand through the whole part until it is automatic, then the other, then together.
  - lead: the hand to learn first, usually the harder or the one that carries the piece.
  - rung: where to start with the beat, 0 for dense or fast parts, 1 normally, 2 for very easy parts.
- patterns (at most 2): a figure that comes back through much of the piece (an ostinato, a repeated left-hand arpeggio, a recurring run) worth learning on its own before the parts, 2 to 4 bars, with its hand.
- focus (at most 4): the hard spots worth drilling as soon as their part starts (big leaps, fast runs, awkward chord changes, crossing hands, rhythms against each other), 2 to 4 bars, with the hand that needs it.

Use only bar numbers and part numbers from the score. Repeated parts ("same as") are learnt through the part they repeat; do not list them. Write the summary for the app's developer in plain words.`;

const client = new Anthropic();

export async function POST(request: Request): Promise<Response> {
  // Only the app itself may ask: every plan costs a model call.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return new Response('Forbidden', { status: 403 });

  let reading: string, shape: Shape;
  try {
    const body = await request.json() as { reading?: unknown; shape?: Shape };
    if (typeof body.reading !== 'string' || !body.reading || body.reading.length > MAX_READING || !body.shape?.parts?.length) throw new Error('bad body');
    reading = body.reading;
    shape = body.shape;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: STRATEGY_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: 'user', content: `Plan how to master this piece.\n\n${reading}` }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return new Response('No plan', { status: 502 });
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    const plan = checkStrategy(JSON.parse(text), shape, 'ai', '');
    if (!plan) return new Response('No plan', { status: 502 });
    return Response.json(plan);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return new Response('Busy', { status: 429 });
    if (error instanceof Anthropic.APIError) return new Response(`Model error ${error.status}`, { status: 502 });
    return new Response('No plan', { status: 502 });
  }
}
