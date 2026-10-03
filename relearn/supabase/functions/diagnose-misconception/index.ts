import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Key rotator helper for Edge Function
function getGeminiKeys(): string[] {
  const commaSeparated = Deno.env.get("GEMINI_API_KEYS");
  if (commaSeparated) {
    return commaSeparated.split(",").map((k) => k.trim()).filter(Boolean);
  }
  const single = Deno.env.get("GEMINI_API_KEY");
  return single ? [single.trim()] : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { challengeId, challengeTitle, challengeDescription, code, language, userId } = await req.json();

    if (!code || !language) {
      throw new Error("Missing required fields (code, language)");
    }

    const geminiKeys = getGeminiKeys();
    const groqKey = Deno.env.get("GROQ_API_KEY");

    let diagnosis = null;

    if (geminiKeys.length > 0) {
      // Rotate through Gemini keys if rate limited
      let lastError = null;
      for (let i = 0; i < geminiKeys.length; i++) {
        const apiKey = geminiKeys[i];
        try {
          const prompt = `You are an expert programming tutor analyzing student code.
Challenge: "${challengeTitle || challengeId}"
Description: ${challengeDescription || ""}
Target Language: ${language}

Student Submission:
\`\`\`${language}
${code}
\`\`\`

Evaluate if the solution is logically correct.
If incorrect:
1. Identify the underlying cognitive misconception.
2. Differentiate between syntax errors and genuine mental model misunderstandings.
3. Provide a clear conceptual explanation.
4. Formulate a targeted socratic intervention/hint.

Respond ONLY with a valid JSON object matching:
{
  "is_correct": boolean,
  "misconception": "Short name of misconception or null",
  "explanation": "Detailed explanation or null",
  "intervention": "Targeted hint or null"
}`;

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: "application/json",
                },
              }),
            }
          );

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`Gemini Key #${i + 1} error: ${errData?.error?.message || res.statusText}`);
          }

          const geminiData = await res.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          diagnosis = JSON.parse(rawText);
          break; // Success! Break out of rotation loop
        } catch (err) {
          lastError = err;
          console.warn(`Key #${i + 1} failed or rate-limited. Trying next key...`);
        }
      }

      if (!diagnosis) {
        throw lastError || new Error("All Gemini API keys exhausted.");
      }
    } else if (groqKey) {
      // Fallback to Groq if configured
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content: `You are an expert programming tutor analyzing student code for misconceptions.
Respond ONLY with a strict JSON object:
{
  "is_correct": boolean,
  "misconception": "Name of misconception or null",
  "explanation": "Explanation or null",
  "intervention": "Targeted hint or null"
}`,
            },
            {
              role: "user",
              content: `Language: ${language}\nCode:\n${code}`,
            },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      diagnosis = JSON.parse(data.choices[0].message.content);
    } else {
      throw new Error("No API key configured (neither GEMINI_API_KEYS nor GROQ_API_KEY).");
    }

    // Save attempt to Supabase attempts table if credentials provided
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    let attempt = null;
    if (supabaseUrl && supabaseAnonKey && userId) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });

      const { data: attemptData, error: attemptError } = await supabaseClient
        .from("attempts")
        .insert([
          {
            user_id: userId,
            challenge_id: challengeId,
            code,
            language,
            is_correct: diagnosis.is_correct,
            diagnosis,
          },
        ])
        .select()
        .single();

      if (!attemptError) {
        attempt = attemptData;
      }
    }

    return new Response(JSON.stringify({ diagnosis, attempt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
