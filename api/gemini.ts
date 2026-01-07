export const config = {
  runtime: 'edge',
  // Google Gemini API is not available in Hong Kong (hkg1).
  // Using Singapore (sin1) provides good latency for Asian users while being outside the restricted region.
  regions: ['sin1'], 
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

function normalizeModelName(model: string): string {
  // Accept "gemini-..." or "models/gemini-..."
  const trimmed = model.trim();
  if (trimmed.startsWith('models/')) return trimmed.slice('models/'.length);
  return trimmed;
}

function toRestContents(contents: any): any[] {
  // SDK allows string prompt; REST expects contents[]
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (Array.isArray(contents)) return contents;
  // If someone passes a single content object
  if (contents && typeof contents === 'object') return [contents];
  return [{ role: 'user', parts: [{ text: '' }] }];
}

function extractTextFromResponse(resp: any): string {
  const parts = resp?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return jsonResponse(null, { status: 204 });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing env: GEMINI_API_KEY");
    return jsonResponse({ error: 'Missing env: GEMINI_API_KEY' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const params = body as any;
    const model = normalizeModelName(String(params?.model || ''));
    if (!model) return jsonResponse({ error: 'Missing field: model' }, { status: 400 });

    const cfg = params?.config || {};
    const systemInstruction = cfg?.systemInstruction;

    // Map SDK config -> REST generationConfig
    const generationConfig: Record<string, any> = {};
    const passThroughKeys = [
      'temperature',
      'topP',
      'topK',
      'candidateCount',
      'maxOutputTokens',
      'stopSequences',
      'presencePenalty',
      'frequencyPenalty',
      'seed',
      'responseMimeType',
      'responseModalities',
      'speechConfig',
      'thinkingConfig',
    ];
    for (const k of passThroughKeys) {
      if (cfg?.[k] !== undefined) generationConfig[k] = cfg[k];
    }

    const restBody: Record<string, any> = {
      contents: toRestContents(params?.contents),
    };
    if (systemInstruction !== undefined) restBody.systemInstruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) restBody.generationConfig = generationConfig;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(restBody),
    });

    const json = await resp.json().catch(() => ({}));
    
    if (!resp.ok) {
      console.error(`Gemini API Error (${resp.status}):`, JSON.stringify(json));
      const msg =
        (json as any)?.error?.message ||
        (json as any)?.message ||
        `Gemini REST error (${resp.status})`;
      return jsonResponse({ error: msg, detail: json }, { status: 500 });
    }

    return jsonResponse(
      {
        text: extractTextFromResponse(json),
        candidates: (json as any)?.candidates ?? null,
        usageMetadata: (json as any)?.usageMetadata ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Gemini Edge Function Exception:", e);
    const message = typeof e?.message === 'string' ? e.message : 'Gemini request failed';
    // Include a tiny bit more detail for debugging without leaking secrets.
    const detail = typeof e?.cause?.message === 'string' ? e.cause.message : undefined;
    return jsonResponse({ error: message, detail }, { status: 500 });
  }
}
