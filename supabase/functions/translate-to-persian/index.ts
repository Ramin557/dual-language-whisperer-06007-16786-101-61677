import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts, preservePlaceholders = true } = await req.json();
    
    if (!texts || !Array.isArray(texts)) {
      return new Response(
        JSON.stringify({ error: "texts array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Translating ${texts.length} strings to Persian...`);

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    const translations: Array<{ english: string; persian: string; warnings: string[] }> = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const systemPrompt = `You are a professional game localization translator specializing in English to Persian (Farsi-Iran) translation.

CRITICAL RULES:
1. Translate naturally and contextually for game UI and gameplay - NOT literal word-by-word
2. PRESERVE ALL placeholders exactly as they appear: {0}, {1}, %d, %s, \\n, etc.
3. Keep technical terms in English if commonly used in games (e.g., HP, MP, XP)
4. Use appropriate gaming terminology in Persian
5. Maintain the tone: formal for tutorials, casual for gameplay
6. NEVER remove or modify placeholders
7. Return ONLY the Persian translation, no explanations

Examples:
- "Welcome, {0}!" → "خوش آمدی، {0}!"
- "Level Up!\\nYou reached level {0}" → "ارتقای سطح!\\nبه سطح {0} رسیدی"
- "Health: %d/%d" → "سلامت: %d/%d"`;

      const userPrompt = `Translate these English game strings to natural Persian. Return translations in order, one per line:\n\n${batch.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("AI translation failed");
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content;

      if (!translatedText) {
        throw new Error("No translation received from AI");
      }

      // Parse the numbered translations
      const translatedLines = translatedText
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

      // Validate and collect results
      batch.forEach((originalText, idx) => {
        const persianText = translatedLines[idx] || originalText;
        const warnings: string[] = [];

        // Check placeholder preservation
        if (preservePlaceholders) {
          const originalPlaceholders = originalText.match(/\{[\d]+\}|%[dsfx]|\\n|\\t/g) || [];
          const translatedPlaceholders = persianText.match(/\{[\d]+\}|%[dsfx]|\\n|\\t/g) || [];
          
          if (originalPlaceholders.length !== translatedPlaceholders.length) {
            warnings.push(`Placeholder mismatch: found ${translatedPlaceholders.length}, expected ${originalPlaceholders.length}`);
          }
        }

        // Check length (warn if Persian is >150% of English)
        if (persianText.length > originalText.length * 1.5) {
          warnings.push(`Translation is ${Math.round((persianText.length / originalText.length) * 100)}% of original length`);
        }

        // Check for very long translations that might overflow UI
        if (persianText.length > 200) {
          warnings.push(`Long translation (${persianText.length} chars) may overflow UI`);
        }

        translations.push({
          english: originalText,
          persian: persianText,
          warnings,
        });
      });

      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Successfully translated ${translations.length} strings`);

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
