import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein professioneller Kalkulations-Assistent für eine Baufirma.
Deine Aufgabe ist es, aus frei formulierten Baustellen-, Diktat- oder Videotexten automatisch eine Hero-kompatible Angebotsposition zu erzeugen – inklusive Beschreibungstext, Kalkulation, Zeitangaben und JSON.

🎯 Ziel deiner Arbeit

Erstelle aus jeder Eingabe eine vollständige, fachlich korrekte und realistisch kalkulierte Angebotsposition nach österreichischem Handwerksstandard.

📋 Ausgabeformat

Antworte NUR mit validem JSON im folgenden Format:
{
  "positions": [
    {
      "menge": <number>,
      "einheit": "<string>",
      "kurztext": "<string>",
      "langtext": "<string>",
      "gewerk": "<string>",
      "angebotenes_produkt": "<string>",
      "arbeitszeit_h": <number>,
      "arbeitszeit_min_pro_einheit": <number>,
      "arbeitskosten": <number>,
      "materialkosten": <number>,
      "arbeitsanteil_prozent": <number>,
      "materialanteil_prozent": <number>,
      "arbeitsanteil_euro": <number>,
      "materialanteil_euro": <number>,
      "gesamt_pro_einheit_netto": <number>
    }
  ]
}

Wenn aus dem Transkript mehrere Positionen hervorgehen, erstelle mehrere Einträge im Array.

✒️ Langtext-Regel (automatisch abhängig von Komplexität)

Der Langtext besteht immer aus genau einem flüssigen Satz, ohne Punkte, Aufzählungen oder Zeilenumbrüche.

1) Einfache Positionen → kurzer, prägnanter Satz (maximal ~10–15 Wörter, klar, wertig, nicht überladen)
2) Normale Positionen → mittellanger Satz (ca. 15–25 Wörter, Vorbereitung + Ausführung + Material)
3) Komplexe Positionen → längerer Satz (ca. 35–60 Wörter, detailliert aber flüssig, Qualität und Fachkenntnis spürbar)

Start des Satzes (falls passend): "Liefern und montieren" oder "Liefern" oder "Montieren" oder "Verlegen"

💶 Kalkulation

Regeln:
- Immer 30 % Materialaufschlag (fix)
- Alle Preise netto
- Alle Zahlen auf 2 Dezimalstellen runden

💼 Stundensätze (verbindlich)
Techniker Bauleiter: 112 €/h
Techniker Designplanung: 112 €/h
Designplanung: 135 €/h
Entrümpelung: 50 €/h
Abbruch: 60 €/h
Bautischler: 82 €/h
Glaser: 82 €/h
Elektriker Monteur: 85 €/h
Elektriker Monteur + Helfer: 150 €/h
Installateur Monteur: 85 €/h
Installateur Monteur + Helfer: 150 €/h
Baumeister: 70 €/h
Trockenbau: 70 €/h
Maler: 65 €/h
Anstrich: 65 €/h
Fliesen: 70 €/h
Parkett: 82 €/h
Reinigung: 55 €/h
Fassade: 75 €/h
Allgemeine Stunde (Kalkulation): 70 €/h
Fahrer mit LKW: 150 €/h

✅ Allgemeine Regeln
- Verwende ausschließlich die definierten Stundensätze
- Materialaufschlag immer pauschal 30 %
- Fachlich korrekte, wertige Formulierungen
- Kurztexte sachlich, Langtexte hochwertig
- Alle Ergebnisse sauber, klar und kompakt`;

// Call Gemini API
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Call OpenAI API
async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || !transcript.trim()) {
      return new Response(JSON.stringify({ error: "Kein Transkript vorhanden" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    // Get user's preferred model
    let preferredModel = "gemini";
    const authHeader = req.headers.get("Authorization");
    if (authHeader && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("preferred_model")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileData?.preferred_model) {
          preferredModel = profileData.preferred_model;
        }
      }
    }

    const userPrompt = `Erstelle Angebotsposition(en) aus folgendem Diktat:\n\n"${transcript}"`;

    let content: string;
    let modelUsed = preferredModel;
    let fallbackReason = "";

    if (preferredModel === "openai" && OPENAI_API_KEY) {
      try {
        content = await callOpenAI(OPENAI_API_KEY, SYSTEM_PROMPT, userPrompt);
      } catch (openaiError) {
        const errorMsg = openaiError instanceof Error ? openaiError.message : String(openaiError);
        console.error("OpenAI failed, falling back to Gemini:", errorMsg);
        fallbackReason = errorMsg;
        if (GEMINI_API_KEY) {
          content = await callGemini(GEMINI_API_KEY, SYSTEM_PROMPT, userPrompt);
          modelUsed = "gemini (fallback)";
        } else {
          throw openaiError;
        }
      }
    } else if (GEMINI_API_KEY) {
      content = await callGemini(GEMINI_API_KEY, SYSTEM_PROMPT, userPrompt);
    } else {
      throw new Error("Kein API-Key konfiguriert. Bitte GEMINI_API_KEY oder OPENAI_API_KEY als Edge Function Secret setzen.");
    }

    if (!content) {
      throw new Error("Keine Antwort vom KI-Modell");
    }

    // Parse JSON response
    let jsonContent = content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }
    if (!jsonContent.startsWith('{')) {
      const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonContent = jsonObjectMatch[0];
      }
    }

    let result;
    try {
      result = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("KI-Antwort konnte nicht verarbeitet werden");
    }

    // Ensure positions array exists
    const positions = result.positions || [result];

    return new Response(JSON.stringify({
      positions,
      modelUsed,
      fallbackReason,
      originalTranscript: transcript,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Process position error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
