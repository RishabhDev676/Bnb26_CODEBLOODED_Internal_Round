/**
 * geminiService.ts
 *
 * LAST-RESORT ONLY fallback. Called ONLY when:
 *   1. The Colab-trained model is unavailable / not connected
 *   2. The local misconceptions database has no match
 *
 * This is NOT the primary AI engine. The Colab FLAN-T5 model is.
 * When Gemini IS called, the result is saved to the learned-mistakes
 * database so the same scenario never reaches Gemini again.
 */

export interface DiagnosisResult {
  is_correct: boolean;
  misconception: string | null;
  explanation: string | null;
  intervention: string | null;
}

const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
  import.meta.env.VITE_GEMINI_API_KEY_6,
  import.meta.env.VITE_GEMINI_API_KEY_7,
  import.meta.env.VITE_GEMINI_API_KEY_8,
  import.meta.env.VITE_GEMINI_API_KEY_9,
  import.meta.env.VITE_GEMINI_API_KEY_10,
  import.meta.env.VITE_GEMINI_API_KEYS,   // comma-separated pool
].flatMap((v: string | undefined) => (v ? v.split(',').map((k: string) => k.trim()).filter(Boolean) : []));

let _keyIndex = 0;

/**
 * Calls Gemini as LAST RESORT when local DB + Colab both fail.
 * Returns null if no API keys are configured.
 */
export async function callGeminiLastResort(
  challengeTitle: string,
  challengeDescription: string,
  code: string,
  language: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<DiagnosisResult | null> {
  if (GEMINI_KEYS.length === 0) return null;

  const prompt = `You are an expert pedagogical AI analyzing a student's submission for misconceptions.
Challenge: "${challengeTitle}"
Description: ${challengeDescription}
Language: ${language}

Student Submission:
\`\`\`${language}
${code}
\`\`\`
${imageBase64 ? '\n(The student attached a handwritten image. Analyze it for logic errors.)' : ''}

Identify any cognitive misconception. If the solution is correct say so.
Output ONLY valid JSON:
{
  "is_correct": boolean,
  "misconception": string or null,
  "explanation": string or null,
  "intervention": string or null
}`;

  const parts: object[] = [{ text: prompt }];
  if (imageBase64 && imageMimeType) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({ inlineData: { mimeType: imageMimeType, data: base64Data } });
  }

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = GEMINI_KEYS[_keyIndex % GEMINI_KEYS.length];
    _keyIndex++;

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          }),
        });
        if (res.status === 404) continue;
        if (res.status === 429) break; // try next key

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty Gemini response');

        return JSON.parse(rawText) as DiagnosisResult;
      } catch {
        // try next model / key
      }
    }
  }
  return null;
}
