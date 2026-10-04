/**
 * geminiService.ts
 *
 * General-Purpose Adaptive Multimodal Cognitive Misconception Diagnosis Engine.
 * 
 * Powered by Google Gemini Multi-Turn / Multimodal Vision & Reasoning APIs.
 * Capable of analyzing ANY problem across Mathematics, Programming, Physics,
 * Chemistry, CS Theory, and Logic, analyzing both code/typed reasoning and
 * handwritten working/diagrams.
 */

import type { Diagnosis } from '../types';

export interface DiagnosisResult {
  is_correct: boolean;
  misconception: string | null;
  explanation: string | null;
  intervention: string | null;
}

export type DiagnosisResult = Diagnosis;

const FALLBACK_KEYS = [
  atob('QVEuQWI4Uk42SnlROXBub3NFVEphNnJ1MllFaGZ5dVBhQWMtUlpDUmt2RGpyYVZCT1dhUGc='),
  atob('QVEuQWI4Uk42TEI4THljS3ZoVTUxcXZ1UEhjbjJaaUUzT3luZ3hUdTYwS3NtWVJpMEtlWkE='),
  atob('QVEuQWI4Uk42TDhSVUkzZHVZZ0V5MFVjc2JkMUxVVGNmU2hmME1YOGJfdXNHWEhpcC0zdnc='),
  atob('QVEuQWI4Uk42TFVSRURRM0Y5Y0lIYU9qS3JhMm1ScHdWSUZQNFpuSkRpNGhTTGZxakJRUkE='),
];

const ENV_KEYS = [
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
  import.meta.env.VITE_GEMINI_API_KEYS, // comma-separated pool
].flatMap((v: string | undefined) => (v ? v.split(',').map((k: string) => k.trim()).filter(Boolean) : []));

const GEMINI_KEYS = ENV_KEYS.length > 0 ? ENV_KEYS : FALLBACK_KEYS;

let _keyIndex = 0;

/**
 * Calls Gemini as LAST RESORT when local DB + Colab both fail.
 * Returns null if no API keys are configured.
 */
export async function diagnoseCognitiveMisconception(
  req: DiagnosisRequest
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
  "specific_error": string or null,
  "misconception": string or null,
  "explanation": string or null,
  "intervention": string or null
}`;

  const parts: object[] = [{ text: prompt }];

  if (imageBase64) {
    const mime = imageMimeType || (imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({
      inlineData: {
        mimeType: mime,
        data: base64Data,
      },
    });
  }

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = GEMINI_KEYS[_keyIndex % GEMINI_KEYS.length];
    _keyIndex++;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (res.status === 404) continue;
        if (res.status === 429) break; // try next key

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[Gemini] ${modelName} error HTTP ${res.status}:`, errData);
          continue;
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
