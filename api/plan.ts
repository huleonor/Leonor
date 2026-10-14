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
 * Needs ANTHROPIC_API_KEY (Claude) or GROQ_API_KEY (Groq, for testing) in the Vercel project's
 * environment variables; PLAN_PROVIDER picks one when both are set.
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

const USER = (reading: string) => `Plan how to master this piece.\n\n${reading}`;

/** Claude reads the score and answers in the plan's schema (structured outputs). */
async function askClaude(reading: string): Promise<{ raw: unknown; by: string } | Response> {
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: STRATEGY_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: 'user', content: USER(reading) }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return new Response('No plan', { status: 502 });
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    return { raw: JSON.parse(text), by: response.model };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return new Response('Busy', { status: 429 });
    if (error instanceof Anthropic.APIError) return new Response(`Model error ${error.status}`, { status: 502 });
    return new Response('No plan', { status: 502 });
  }
}

/**
 * Groq, for testing the plan end to end with a free key (OpenAI-style chat API). Asks for the
 * schema strictly; a model that does not take a JSON schema gets JSON mode with the schema in the
 * prompt instead. GROQ_MODEL picks the model.
 */
async function askGroq(reading: string): Promise<{ raw: unknown; by: string } | Response> {
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const call = (format: 'schema' | 'json') => fetch(`${process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: format === 'schema' ? SYSTEM : `${SYSTEM}\n\nAnswer with one JSON object only, matching this JSON schema:\n${JSON.stringify(STRATEGY_SCHEMA)}` },
        { role: 'user', content: USER(reading) },
      ],
      response_format: format === 'schema' ? { type: 'json_schema', json_schema: { name: 'strategy', schema: STRATEGY_SCHEMA } } : { type: 'json_object' },
    }),
  });
  try {
    let res = await call('schema');
    if (res.status === 400) res = await call('json');
    if (res.status === 429) return new Response('Busy', { status: 429 });
    if (!res.ok) return new Response(`Model error ${res.status}`, { status: 502 });
    const data = await res.json() as { model?: string; choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return new Response('No plan', { status: 502 });
    return { raw: JSON.parse(text), by: `groq:${data.model ?? model}` };
  } catch {
    return new Response('No plan', { status: 502 });
  }
}

/** Which model plans: PLAN_PROVIDER (claude or groq) when set, else whichever key is there, Claude first. */
function provider(): 'claude' | 'groq' | null {
  const want = process.env.PLAN_PROVIDER;
  if (want === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (want === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GROQ_API_KEY) return 'groq';
  return null;
}

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

  const who = provider();
  if (!who) return new Response('No model key set', { status: 503 });
  const out = who === 'claude' ? await askClaude(reading) : await askGroq(reading);
  if (out instanceof Response) return out;
  const plan = checkStrategy(out.raw, shape, 'ai', '');
  if (!plan) return new Response('No plan', { status: 502 });
  return Response.json({ ...plan, by: out.by });
}
