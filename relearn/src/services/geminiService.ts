export interface DiagnosisResult {
  is_correct: boolean;
  misconception: string | null;
  explanation: string | null;
  intervention: string | null;
}

class GeminiKeyManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private keyCooldowns: Map<number, number> = new Map();

  constructor() {
    this.loadKeys();
  }

  public loadKeys() {
    const rawKeys: string[] = [];

    // 1. Check comma-separated VITE_GEMINI_API_KEYS
    const commaSeparated = import.meta.env.VITE_GEMINI_API_KEYS;
    if (commaSeparated) {
      rawKeys.push(...commaSeparated.split(',').map((k: string) => k.trim()).filter(Boolean));
    }

    // 2. Check numbered keys: VITE_GEMINI_API_KEY_1, VITE_GEMINI_API_KEY_2, etc.
    for (let i = 1; i <= 10; i++) {
      const key = import.meta.env[`VITE_GEMINI_API_KEY_${i}`];
      if (key && !rawKeys.includes(key.trim())) {
        rawKeys.push(key.trim());
      }
    }

    // 3. Fallback to single VITE_GEMINI_API_KEY
    const singleKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (singleKey && !rawKeys.includes(singleKey.trim())) {
      rawKeys.push(singleKey.trim());
    }

    this.keys = rawKeys;
    this.currentIndex = 0;
  }

  public getKeyCount(): number {
    return this.keys.length;
  }

  public getCurrentKeyIndex(): number {
    return this.currentIndex;
  }

  private markKeyRateLimited(index: number) {
    // Put key on cooldown for 60 seconds
    const cooldownUntil = Date.now() + 60 * 1000;
    this.keyCooldowns.set(index, cooldownUntil);
    console.warn(`[GeminiKeyManager] Key #${index + 1} marked as rate-limited until ${new Date(cooldownUntil).toLocaleTimeString()}`);
  }

  private isKeyAvailable(index: number): boolean {
    const cooldownUntil = this.keyCooldowns.get(index);
    if (!cooldownUntil) return true;
    if (Date.now() > cooldownUntil) {
      this.keyCooldowns.delete(index);
      return true;
    }
    return false;
  }

  public async executeWithRotation<T>(
    operation: (key: string, keyIndex: number) => Promise<T>,
    onRotationNotice?: (message: string) => void
  ): Promise<T> {
    if (this.keys.length === 0) {
      throw new Error(
        "No Gemini API keys found. Please set VITE_GEMINI_API_KEYS or VITE_GEMINI_API_KEY_1..4 in your .env file."
      );
    }

    const totalKeys = this.keys.length;
    let attempts = 0;

    while (attempts < totalKeys) {
      // Find an available key or advance
      const keyIndex = this.currentIndex;
      const key = this.keys[keyIndex];

      if (!this.isKeyAvailable(keyIndex)) {
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        attempts++;
        continue;
      }

      try {
        const result = await operation(key, keyIndex);
        return result;
      } catch (err: any) {
        const errorMessage = String(err?.message || err);
        const isQuotaOrRateLimit =
          err?.status === 429 ||
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("exceeded your current quota");

        if (isQuotaOrRateLimit) {
          this.markKeyRateLimited(keyIndex);
          const nextIndex = (keyIndex + 1) % totalKeys;
          this.currentIndex = nextIndex;
          attempts++;

          const notice = `Gemini Key #${keyIndex + 1} exhausted/rate-limited. Seamlessly cycling to Key #${nextIndex + 1} (${totalKeys - attempts} active key(s) remaining)...`;
          console.warn(`[GeminiKeyManager] ${notice}`);
          if (onRotationNotice) {
            onRotationNotice(notice);
          }

          continue; // retry with next key in loop
        }

        // Non-quota error, throw immediately
        throw err;
      }
    }

    throw new Error(
      `All ${totalKeys} Gemini API keys have exceeded their rate limits or quotas. Please wait a minute or add additional keys.`
    );
  }
}

export const geminiKeyManager = new GeminiKeyManager();

export async function diagnoseWithGemini(
  challengeTitle: string,
  challengeDescription: string,
  code: string,
  language: string,
  onRotationNotice?: (message: string) => void,
  imageBase64?: string,
  imageMimeType?: string
): Promise<DiagnosisResult> {
  return geminiKeyManager.executeWithRotation(async (apiKey, _keyIndex) => {
    const prompt = `You are an expert pedagogical AI analyzing a student's answer (code or handwritten work) for misconceptions.
Challenge: "${challengeTitle}"
Description: ${challengeDescription}
Target Domain/Language: ${language}

Student Submission:
\`\`\`${language}
${code}
\`\`\`
${imageBase64 ? "\n(The student has also attached an image of their handwritten work/diagram. Analyze the image to identify where their logic or formula breaks down.)" : ""}

Evaluate if the solution is logically correct.
If incorrect:
1. Identify the underlying cognitive misconception (e.g., sign error, wrong formula application, scope confusion).
2. Provide a clear, supportive conceptual explanation of what happened.
3. Formulate a targeted socratic intervention/hint that guides the student to correct their mental model.

Output ONLY valid JSON matching this schema:
{
  "is_correct": boolean,
  "misconception": string or null,
  "explanation": string or null,
  "intervention": string or null
}`;

    const parts: any[] = [{ text: prompt }];

    if (imageBase64 && imageMimeType) {
      // Remove the data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: base64Data
        }
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `HTTP error ${response.status}: ${response.statusText}`;
      const customErr: any = new Error(errorMsg);
      customErr.status = response.status;
      throw customErr;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No response generated from Gemini API.");
    }

    try {
      const parsed: DiagnosisResult = JSON.parse(rawText);
      return parsed;
    } catch {
      throw new Error(`Failed to parse Gemini JSON output: ${rawText}`);
    }
  }, onRotationNotice);
}
