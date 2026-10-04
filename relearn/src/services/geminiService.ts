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
  fixed_code?: string | null;
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
 * Universal Pedagogical AI Model Diagnosis
 * Works for any problem and any code submission independently of domain tree.
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

  const prompt = `You are an expert AI Pedagogue and Computer Science / STEM Diagnostic Model.
Your task: Analyze the student's submission.
Context problem (if applicable): "${challengeTitle} — ${challengeDescription}"

Student Submission:
\`\`\`${language || 'text'}
${code}
\`\`\`
${imageBase64 ? '\n(Student attached handwritten working/diagram image. Analyze it as well.)' : ''}

Rules:
1. If the submission is NOT valid code, algorithm, or mathematical formula (for example, if it's just a random English sentence, conversational text like "hi", "how are you", or non-technical prose):
   Set:
   "is_correct": false,
   "misconception": "Invalid Submission Format",
   "explanation": "Please give a proper submission, not just a sentence.",
   "intervention": "Provide functional code, an algorithm, or a mathematical expression to diagnose."

2. If it IS code or math:
   - Understand the student's intended algorithm or problem (even if different from the context problem).
   - Check if the logic is correct.
   - If incorrect, identify the exact cognitive misconception or bug (e.g. operator precedence, zero-division, off-by-one, type coercion, formula error).
   - Give a clear explanation of why this mental model is flawed.
   - Provide a Socratic hint/intervention AND the corrected code in "intervention" or "fixed_code".

Output ONLY a single valid JSON object:
{
  "is_correct": boolean,
  "misconception": string or null,
  "explanation": string,
  "intervention": string,
  "fixed_code": string or null
}`;

  const parts: object[] = [{ text: prompt }];
  if (imageBase64 && imageMimeType) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({ inlineData: { mimeType: imageMimeType, data: base64Data } });
  }

  const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

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
        if (res.status === 429) break;

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        let rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty Gemini response');

        // Clean any accidental markdown backticks
        rawText = rawText.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();

        return JSON.parse(rawText) as DiagnosisResult;
      } catch {
        // try next model / key
      }
    }
  }
  return null;
}

/**
 * Optical Character Recognition (OCR) for attached diagrams and handwritten notes.
 * Transcribes handwritten or screenshot code into plain text.
 */
export async function extractCodeFromImage(
  imageBase64: string,
  imageMimeType: string = 'image/jpeg'
): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) return null;

  const prompt = `Transcribe all computer code, algorithms, or mathematical formulas visible in this image verbatim.
Return ONLY the raw executable code or mathematical text.
Do not include any conversational greeting, explanations, or commentary.`;

  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const parts: object[] = [
    { text: prompt },
    { inlineData: { mimeType: imageMimeType, data: base64Data } }
  ];

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = GEMINI_KEYS[_keyIndex % GEMINI_KEYS.length];
    _keyIndex++;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1 }
        })
      });
      if (!res.ok) continue;

      const data = await res.json();
      let text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        text = text.replace(/```[a-zA-Z]*\n/i, '').replace(/```$/g, '').trim();
        return text;
      }
    } catch {
      // try next key
    }
  }
  return null;
}
