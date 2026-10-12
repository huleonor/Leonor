/**
 * The AI piano coach (Vercel Function, POST /api/coach).
 *
 * The app sends a compact picture of the learner (skill levels, the difficulty coach's settings,
 * recent runs, the week's practice, where they are on the course) and either a chat history or a
 * request for this week's plan. Claude answers as the coach. The API key stays here on the server
 * (ANTHROPIC_API_KEY in the Vercel project); the app never sees it.
 *
 * The on-device engine still decides everything note by note; the coach only explains, plans and
 * encourages, so the app keeps working offline and costs stay small.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const SKILLS = ['treble', 'bass', 'ledger', 'accidentals', 'rhythm', 'eighths', 'dotted', 'together', 'chords', 'leaps'] as const;

const SYSTEM = `You are the coach inside Hugo's Piano, an app that teaches piano with real sheet music, a course of units, and a daily session. The app's engine already adjusts difficulty note by note (aiming for about 85% right first time); you are the human-feeling layer on top: you explain progress, plan the week and encourage.

You receive the learner's data as JSON in <learner> tags: skill levels (0-100, with how many chords were practised and days since), the difficulty settings the engine chose, their recent runs (accuracy, chords right first time, median seconds of hesitation, the skill that went worst), minutes and XP for the last 7 days, streak, and their place on the course.

How to coach:
- Reply in the learner's language (the "lang" field: "pt" means European Portuguese, "en" English).
- Be warm, specific and brief: refer to their actual numbers and skills, never invent data you were not given.
- Give one clear next action, preferably something they can do in the app today (a unit lesson, a skill practice, today's session, a song).
- Hesitation means reading is slow; wrong notes in tempo mean speed. Say which one you see.
- You cannot hear them play beyond this data. If data is thin, say so and suggest playing a lesson first.
- Stay on piano learning and practice; steer other topics back kindly.`;

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'focus', 'days', 'tip'],
  properties: {
    summary: { type: 'string', description: 'Two or three sentences: what changed lately and why, using their numbers.' },
    focus: { type: 'string', description: "The week's one main goal, a short phrase." },
    days: {
      type: 'array',
      description: 'Seven days, day 1 is today.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'title', 'skill', 'minutes', 'note'],
        properties: {
          day: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
          title: { type: 'string', description: 'Short title for the day, e.g. "Bass clef reading".' },
          skill: { type: 'string', enum: [...SKILLS], description: 'The skill the day trains.' },
          minutes: { type: 'integer', enum: [5, 10, 15, 20] },
          note: { type: 'string', description: 'One sentence: what to do and why.' },
        },
      },
    },
    tip: { type: 'string', description: 'One practical practice tip for this week.' },
  },
} as const;

interface Body {
  kind: 'chat' | 'plan';
  lang: 'pt' | 'en';
  learner: unknown;
  messages?: { role: 'user' | 'assistant'; content: string }[];
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function parse(raw: string): Body | null {
  if (raw.length > 24_000) return null;
  try {
    const b = JSON.parse(raw) as Body;
    if (b.kind !== 'chat' && b.kind !== 'plan') return null;
    if (b.lang !== 'pt' && b.lang !== 'en') b.lang = 'en';
    if (b.kind === 'chat') {
      if (!Array.isArray(b.messages) || !b.messages.length) return null;
      // The last 12 turns, each kept short; the history must start with the learner.
      b.messages = b.messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 1500) }));
      while (b.messages.length && b.messages[0].role !== 'user') b.messages.shift();
      if (!b.messages.length || b.messages[b.messages.length - 1].role !== 'user') return null;
    }
    return b;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = parse(await req.text());
  if (!body) return json(400, { error: 'bad_request' });
  if (process.env.COACH_MOCK === '1') return json(200, mock(body));
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'coach_unavailable' });

  const client = new Anthropic();
  const learner = `<learner>${JSON.stringify({ lang: body.lang, ...(body.learner as object) })}</learner>`;
  try {
    if (body.kind === 'chat') {
      const msgs = body.messages!;
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [
          { role: 'user', content: `${learner}\n\n${msgs[0].content}` },
          ...msgs.slice(1),
        ],
      });
      if (response.stop_reason === 'refusal') return json(422, { error: 'refused' });
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return json(200, { reply: text });
    }

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `${learner}\n\nWrite my practice plan for the next seven days, starting today. Base it on my weakest and most overdue skills, mix in my place on the course, keep each day realistic for my daily goal, and leave one lighter day.` }],
    });
    if (response.stop_reason === 'refusal') return json(422, { error: 'refused' });
    if (response.stop_reason === 'max_tokens') return json(502, { error: 'incomplete' });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return json(200, { plan: JSON.parse(text) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'busy' });
    if (err instanceof Anthropic.APIError) return json(502, { error: 'upstream', status: err.status });
    return json(500, { error: 'failed' });
  }
}

/** Canned answers for local testing without an API key (COACH_MOCK=1, never set in production). */
function mock(b: Body) {
  const pt = b.lang === 'pt';
  if (b.kind === 'chat') {
    return { reply: pt
      ? 'Estás a ler bem a clave de sol, mas paras quase 3 segundos nas notas da clave de fá. Hoje faz o treino de clave de fá devagar: 10 minutos chegam.'
      : 'Your treble clef reading is solid, but you pause almost 3 seconds on bass clef notes. Today, do the bass clef practice slowly: 10 minutes is enough.' };
  }
  const days = [
    ['bass', pt ? 'Clave de fá' : 'Bass clef', 10], ['treble', pt ? 'Clave de sol' : 'Treble clef', 10], ['together', pt ? 'Mãos juntas' : 'Hands together', 15],
    ['rhythm', pt ? 'Pulsação' : 'Steady beat', 5], ['bass', pt ? 'Clave de fá, mais longe' : 'Bass clef, wider', 10], ['ledger', pt ? 'Linhas suplementares' : 'Ledger lines', 10], ['together', pt ? 'Música a duas mãos' : 'Two-hand song', 15],
  ] as const;
  return { plan: {
    summary: pt ? 'A clave de sol subiu de Starter para Building esta semana. A clave de fá ainda te faz hesitar perto de 3 segundos por nota.' : 'Treble clef went from Starter to Building this week. Bass clef still makes you pause about 3 seconds a note.',
    focus: pt ? 'Ler a clave de fá sem parar' : 'Read the bass clef without stopping',
    days: days.map(([skill, title, minutes], i) => ({ day: i + 1, title, skill, minutes, note: pt ? 'Devagar e sem ajudas: acerta à primeira.' : 'Slowly and without help: right first time.' })),
    tip: pt ? 'Diz o nome da nota em voz alta antes de a tocar.' : 'Say the note name out loud before you play it.',
  } };
}
