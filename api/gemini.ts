export const config = {
  runtime: 'edge',
};

function safeJson(data: unknown) {
  // Some SDK objects include non-JSON types; this normalizes them for Response.
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return { error: 'Response is not JSON serializable' };
  }
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  return new Response(JSON.stringify(safeJson(data)), { ...init, headers });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return jsonResponse(null, { status: 204 });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'Missing env: GEMINI_API_KEY' }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // We intentionally accept the same payload shape as ai.models.generateContent(...)
    // from @google/genai, so the frontend can forward args directly.
    const result = await ai.models.generateContent(body as any);

    return jsonResponse(
      {
        text: result?.text ?? '',
        candidates: result?.candidates ?? null,
        usageMetadata: (result as any)?.usageMetadata ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'Gemini request failed';
    return jsonResponse({ error: message }, { status: 500 });
  }
}

