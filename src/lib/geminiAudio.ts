// AI Guide — direct (on-device) Gemini analysis.
//
// WHY THIS EXISTS: the server route POST /human-leads/:id/audio-analysis does the
// same job, but until that backend is deployed with GEMINI_API_KEY the app has
// no way to analyse audio. leadAudioApi.analyze() tries the server first and
// falls back to this module only when the server route is missing (404), not
// configured (503) or unreachable.
//
// SECURITY TRADE-OFF (accepted by the product owner): the key is read from
// EXPO_PUBLIC_GEMINI_API_KEY, which Expo inlines into the JS bundle, so anyone
// with the APK can extract it. Restrict the key in Google AI Studio / Cloud
// Console and move to the server path once it is deployed.
//
// The prompt and the normalise() rules mirror HIT_Backend services/
// AudioAnalysisService.js, so both paths return the same shape.
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LeadAudioAnalysis, LeadAudioAnalysisData, MatchedProperty } from './api';

export const GEMINI_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
const MODEL = (process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash').trim();
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 150000;
/** Inline request cap is ~20 MB and base64 adds a third, so stay under 14 MB raw. */
export const DIRECT_MAX_BYTES = 14 * 1024 * 1024;
const NOT_MENTIONED = 'Not Mentioned';
const STAGES = [
  'New Lead', 'Contacted', 'Qualified', 'Site Visit Scheduled', 'Site Visit Done',
  'Negotiation', 'Booking', 'Won', 'Lost',
];
const STORE_KEY = (leadId: string) => `hit.leadAudio.${leadId}`;
const STORE_MAX = 25;

export const isDirectAiConfigured = () => GEMINI_KEY.length > 0;

/** Facts the prompt may use. Never includes the phone number. */
export interface LeadFacts {
  name?: string; project?: string; stage?: string; budget?: string;
  homeType?: string; location?: string; buyingType?: string;
}

function buildPrompt(lead: LeadFacts, matches: MatchedProperty[]): string {
  const facts = [
    lead.name && `Client name: ${lead.name}`,
    lead.project && `Project the lead enquired about: ${lead.project}`,
    lead.stage && `Current CRM stage: ${lead.stage}`,
    lead.budget && `Budget noted on the lead: ${lead.budget}`,
    lead.homeType && `Home type noted on the lead: ${lead.homeType}`,
    lead.buyingType && `Buying type noted on the lead: ${lead.buyingType}`,
    lead.location && `Location noted on the lead: ${lead.location}`,
  ].filter(Boolean).join('\n');

  const matchLines = matches.slice(0, 5).map((m, i) => `${i + 1}. ${[
    m.projectName, m.location, m.city, m.propertyType,
    m.bhkOptions?.length ? m.bhkOptions.join('/') : '',
    m.startingPrice ? `from Rs ${m.startingPrice}` : '',
    m.projectStatus,
  ].filter(Boolean).join(' | ')}`).join('\n');

  return `You are a real-estate sales assistant for an Indian real-estate CRM (HomeInTown).
You will hear ONE recorded conversation between a property sales person and a client.
The speech may be Hindi, English or Hinglish. Listen to all of it, then answer.

STRICT RULES
- Use ONLY what is actually said in the audio, plus the lead facts and the AVAILABLE PROPERTIES list below.
- NEVER invent client details, numbers, budgets, locations or property facts.
- If something was not said, write exactly "${NOT_MENTIONED}" (for list fields use an empty array).
- Only recommend a property or project if it appears in the AVAILABLE PROPERTIES list. If the list is empty, do not name any property.
- Give practical real-estate solutions: suitable configurations for the stated budget and family need, how to handle each objection (price, location, loan, possession, trust), and the next best step to move the deal forward.
- "suggestedStage" must be exactly one of: ${STAGES.join(', ')}.
- Write transcript in the language spoken; write Hindi/Hinglish in Roman script.
- Write all other fields in simple Hinglish or English that a sales person can read quickly.
- Messages and scripts must be ready to send/say, short, polite, and use the client's name if it was spoken or is given below.
- Return ONLY valid JSON, no markdown, matching exactly this shape:

{
  "language": "Hindi | English | Hinglish | Other",
  "transcript": "full transcript",
  "summary": "3-6 sentence summary of the conversation",
  "requirements": {
    "propertyType": "", "intent": "Buy | Rent | Investment | ${NOT_MENTIONED}",
    "location": "", "budget": "", "bhk": "", "area": "", "possession": "",
    "otherPreferences": [], "unclear": []
  },
  "leadAnalysis": {
    "interestLevel": "High | Medium | Low | ${NOT_MENTIONED}",
    "seriousness": "", "budgetClarity": "", "requirementClarity": "",
    "objections": [], "concerns": [], "buyingTimeline": ""
  },
  "recommendations": {
    "suitableProperties": [{ "name": "", "reason": "" }],
    "suitableConfigurations": [],
    "objectionHandling": [],
    "nextQuestions": [],
    "followUpStrategy": "",
    "suggestedStage": ""
  },
  "actionPlan": {
    "nextAction": "",
    "followUpMessage": "",
    "whatsappMessage": "",
    "callScript": "",
    "followUpWhen": "",
    "questionsForNextCall": []
  }
}

LEAD FACTS
${facts || '(none)'}

AVAILABLE PROPERTIES (matched to this lead by the system)
${matchLines || '(none)'}`;
}

function parseJson(text: string): any {
  if (!text) throw new Error('AI returned an empty answer');
  const cleaned = String(text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try the outer object */ }
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(cleaned.slice(a, b + 1)); } catch { /* fall through */ }
  }
  throw new Error('AI answer could not be read');
}

const str = (v: any, max = 4000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '');
const strOr = (v: any, max = 1000) => str(v, max) || NOT_MENTIONED;
const list = (v: any, max = 12, len = 500): string[] =>
  (Array.isArray(v) ? v : []).map((x) => str(typeof x === 'string' ? x : '', len)).filter(Boolean).slice(0, max);

function normalise(raw: any): { language: string; transcript: string; analysis: LeadAudioAnalysisData } {
  const r = raw && typeof raw === 'object' ? raw : {};
  const req = r.requirements || {};
  const la = r.leadAnalysis || {};
  const rec = r.recommendations || {};
  const ap = r.actionPlan || {};
  return {
    language: str(r.language, 40),
    transcript: str(r.transcript, 60000),
    analysis: {
      summary: strOr(r.summary, 3000),
      requirements: {
        propertyType: strOr(req.propertyType), intent: strOr(req.intent),
        location: strOr(req.location), budget: strOr(req.budget), bhk: strOr(req.bhk),
        area: strOr(req.area), possession: strOr(req.possession),
        otherPreferences: list(req.otherPreferences), unclear: list(req.unclear),
      },
      leadAnalysis: {
        interestLevel: strOr(la.interestLevel), seriousness: strOr(la.seriousness),
        budgetClarity: strOr(la.budgetClarity), requirementClarity: strOr(la.requirementClarity),
        objections: list(la.objections), concerns: list(la.concerns),
        buyingTimeline: strOr(la.buyingTimeline),
      },
      recommendations: {
        suitableProperties: (Array.isArray(rec.suitableProperties) ? rec.suitableProperties : [])
          .map((p: any) => ({ name: str(p?.name, 200), reason: str(p?.reason, 500) }))
          .filter((p: { name: string }) => p.name).slice(0, 5),
        suitableConfigurations: list(rec.suitableConfigurations),
        objectionHandling: list(rec.objectionHandling),
        nextQuestions: list(rec.nextQuestions),
        followUpStrategy: strOr(rec.followUpStrategy),
        suggestedStage: STAGES.includes(rec.suggestedStage) ? rec.suggestedStage : '',
      },
      actionPlan: {
        nextAction: strOr(ap.nextAction), followUpMessage: str(ap.followUpMessage, 2000),
        whatsappMessage: str(ap.whatsappMessage, 2000), callScript: str(ap.callScript, 3000),
        followUpWhen: strOr(ap.followUpWhen), questionsForNextCall: list(ap.questionsForNextCall),
      },
    },
  };
}

function providerMessage(status: number): string {
  if (status === 400) return 'AI could not read this audio. Try MP3, WAV or AAC.';
  if (status === 401 || status === 403) return 'AI key was rejected. Check the Gemini API key.';
  // Prepay project with no balance left (seen with the current key).
  if (status === 402) return 'AI credits are used up. Add credits in Google AI Studio billing.';
  if (status === 404) return 'AI model not found. Check EXPO_PUBLIC_GEMINI_MODEL.';
  if (status === 429) return 'AI is busy right now. Please try again in a minute.';
  return 'AI analysis failed. Please try again.';
}

/** Gemini treats M4A as MP4 audio. */
const geminiMime = (mime: string) => (/m4a/i.test(mime) ? 'audio/mp4' : mime);

// ── Local history (direct-mode analyses live on this phone only) ──
export async function loadLocalAnalyses(leadId: string): Promise<LeadAudioAnalysis[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY(leadId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function saveLocalAnalysis(item: LeadAudioAnalysis) {
  const prev = await loadLocalAnalyses(item.leadId);
  const next = [item, ...prev.filter((p) => p.id !== item.id)].slice(0, STORE_MAX);
  await AsyncStorage.setItem(STORE_KEY(item.leadId), JSON.stringify(next));
}

export async function analyzeAudioDirect(opts: {
  leadId: string; uri: string; name: string; mimeType: string;
  durationSec: number; source: 'recorded' | 'uploaded';
  lead?: LeadFacts; matches?: MatchedProperty[];
}): Promise<{ analysis: LeadAudioAnalysis; audioStored: boolean }> {
  if (!isDirectAiConfigured()) throw new Error('AI analysis is not configured.');
  const info: any = await FileSystem.getInfoAsync(opts.uri);
  if (!info.exists) throw new Error('Audio file not found. Please record or pick it again.');
  if (typeof info.size === 'number' && info.size > DIRECT_MAX_BYTES) {
    throw new Error('Audio must be 14 MB or smaller.');
  }
  const data = await FileSystem.readAsStringAsync(opts.uri, { encoding: FileSystem.EncodingType.Base64 });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: buildPrompt(opts.lead || {}, opts.matches || []) },
            { inline_data: { mime_type: geminiMime(opts.mimeType), data } },
          ],
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError'
      ? 'AI took too long. Try a shorter recording.'
      : 'Could not reach the AI service. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(providerMessage(res.status));

  const body: any = await res.json().catch(() => null);
  const text = (body?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('');
  if (!text && body?.promptFeedback?.blockReason) throw new Error('AI could not analyse this audio.');
  const { transcript, language, analysis } = normalise(parseJson(text));
  if (!transcript && analysis.summary === NOT_MENTIONED) {
    throw new Error('No clear speech was found in this audio.');
  }

  const now = new Date().toISOString();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Recordings and picked files live in the cache dir, which Android may clear.
  // Keep a copy in the app's documents dir so "Previous analyses" can still play it.
  let keptUri: string | null = null;
  try {
    const dir = `${FileSystem.documentDirectory}lead-audio/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const ext = (opts.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] || 'aac').toLowerCase();
    keptUri = `${dir}${id}.${ext}`;
    await FileSystem.copyAsync({ from: opts.uri, to: keptUri });
  } catch { keptUri = null; }

  const item: LeadAudioAnalysis = {
    id,
    leadId: opts.leadId,
    source: opts.source,
    createdAt: now,
    analyzedAt: now,
    language,
    transcript,
    analysis,
    audio: {
      // Playback uses the local file while it still exists on this phone.
      available: !!keptUri,
      url: keptUri,
      mimeType: opts.mimeType,
      sizeBytes: typeof info.size === 'number' ? info.size : 0,
      durationSec: Math.round(opts.durationSec || 0),
      name: opts.name,
    },
  };
  await saveLocalAnalysis(item).catch(() => {});
  return { analysis: item, audioStored: !!keptUri };
}
