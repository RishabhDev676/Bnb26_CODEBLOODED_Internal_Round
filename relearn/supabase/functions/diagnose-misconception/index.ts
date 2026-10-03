import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { challengeId, code, language, userId } = await req.json();

    if (!code || !language) {
      throw new Error("Missing required fields (code, language)");
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set");
    }

    // Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192", // Use a highly capable model
        messages: [
          {
            role: "system",
            content: `You are an expert programming tutor analyzing student code. 
Your goal is to identify if the code is correct for a typical introductory programming challenge, and if not, identify the SPECIFIC underlying misconception (not just the syntax error).
Distinguish between similar mistakes (e.g., typos vs misunderstanding scope vs misunderstanding reference semantics).

Respond ONLY with a strict JSON object with this exact structure:
{
  "is_correct": boolean,
  "misconception": "Short name of the misconception or null if correct",
  "explanation": "Detailed explanation of the logical flaw or null if correct",
  "intervention": "A targeted intervention or hint to help the student resolve the misconception, or null if correct"
}`
          },
          {
            role: "user",
            content: `Language: ${language}\nCode to analyze:\n\n${code}`
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message);
    }
    
    const diagnosis = JSON.parse(data.choices[0].message.content);

    // Save attempt to Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    let misconceptionId = null;

    if (!diagnosis.is_correct && diagnosis.misconception) {
        // Try to find if this misconception exists in the dictionary, if not create it or just store in attempt.
        // For simplicity, we just store it in the JSONB diagnosis column for now, but we could also link it.
    }

    const { data: attempt, error: attemptError } = await supabaseClient
      .from("attempts")
      .insert([
        {
          user_id: userId,
          challenge_id: challengeId,
          code,
          language,
          is_correct: diagnosis.is_correct,
          diagnosis: diagnosis
        }
      ])
      .select()
      .single();

    if (attemptError) {
      throw attemptError;
    }

    return new Response(JSON.stringify({ diagnosis, attempt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
