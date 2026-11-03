/**
 * Writes the words on a song's reels (Vercel function, POST /api/reels).
 *
 * The app sends the score as text (src/lib/reading.ts) and, for each reel it built from the notes,
 * what that reel shows: its hand, its bars, the bass of each bar and the right hand's notes beat by
 * beat. Claude writes them the way a good short piano video talks: one idea per reel, a short
 * caption per bar that says what to look at or feel, and a tip before he plays it himself. The
 * app draws the reel from the notes; only the words come from here.
 *
 * Needs ANTHROPIC_API_KEY in the Vercel project's environment variables.
 */
import Anthropic from '@anthropic-ai/sdk';
import { checkReelWords, REEL_SCHEMA, type ReelFacts } from '../src/lib/reelShape.js';

const MAX_READING = 300_000;

const SYSTEM = `You write the on-screen words of short vertical piano videos (TikTok style, 20 to 35 seconds each) that teach one learner one piece, pattern by pattern.

Each video is drawn by the app from the real notes: the keys light up with their finger numbers while the music plays, first slowly, then at full speed; then he plays the same bars himself in a practice step. You write only the words:
- title: a small label, like "Part 1: left hand".
- hook: the one idea of this video in a big line, like "Four octaves carry the whole song: F G A E". Name the pattern, the shape or the trick that makes it easy. No hype.
- cues: one caption per bar that needs one, shown while that bar plays: what to look at, which finger, what stays the same, where the hand moves. Plain, concrete, glanceable.
- tip: one line at the end, before he plays it himself.

Rules: English. Short words. Use note letters (C D E F G A B) and finger numbers (1 thumb to 5 little finger). Only say what the facts show. Never use em dashes or en dashes; use a colon, a comma or two sentences. No emoji. Never mention levels or difficulty. The "intro" reel is the opening of the piece played once, as a trailer: its hook should make him want to play it.`;

const USER = (reading: string, reels: ReelFacts[]) =>
  `The piece:\n${reading}\n\nThe videos, in order (each with what it shows, bar by bar):\n${JSON.stringify(reels)}\n\nWrite the words for every video.`;

export async function POST(request: Request): Promise<Response> {
  // Only the app itself may ask: every answer costs a model call.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return new Response('Forbidden', { status: 403 });

  let reading: string, reels: ReelFacts[];
  try {
    const body = await request.json() as { reading?: unknown; reels?: ReelFacts[] };
    if (typeof body.reading !== 'string' || !body.reading || body.reading.length > MAX_READING || !Array.isArray(body.reels) || !body.reels.length || body.reels.length > 80) throw new Error('bad body');
    reading = body.reading;
    reels = body.reels;
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return new Response('No model key set', { status: 503 });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REEL_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: 'user', content: USER(reading, reels) }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return new Response('No words', { status: 502 });
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    const words = checkReelWords(JSON.parse(text), reels);
    if (!words) return new Response('No words', { status: 502 });
    return Response.json({ reels: Object.entries(words).map(([id, w]) => ({ id, ...w })), by: response.model });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return new Response('Busy', { status: 429 });
    if (error instanceof Anthropic.APIError) return new Response(`Model error ${error.status}`, { status: 502 });
    return new Response('No words', { status: 502 });
  }
}
