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
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    
    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    // If ElevenLabs is configured, use it
    if (ELEVENLABS_API_KEY) {
      const apiFormData = new FormData();
      apiFormData.append("file", audioFile);
      apiFormData.append("model_id", "scribe_v2");
      apiFormData.append("language_code", "deu"); // German
      apiFormData.append("tag_audio_events", "false");
      apiFormData.append("diarize", "false");

      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: apiFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs STT error:", response.status, errorText);
        // Fall through to Gemini fallback on permission/auth errors
        console.log("Falling back to Gemini for transcription...");
      } else {
        const transcription = await response.json();
        
        return new Response(JSON.stringify({ 
          text: transcription.text,
          source: "elevenlabs"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: Use Gemini API directly for transcription
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("No transcription service configured. Set ELEVENLABS_API_KEY or GEMINI_API_KEY.");
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let base64Audio = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      base64Audio += String.fromCharCode(...chunk);
    }
    base64Audio = btoa(base64Audio);

    const mimeType = audioFile.type || "audio/webm";
    console.log("Transcribing audio with Gemini, MIME type:", mimeType, "size:", arrayBuffer.byteLength);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              {
                text: `Du erhältst eine deutsche Sprachaufnahme. Transkribiere sie WORTGETREU.

WICHTIG:
- Gib NUR den transkribierten Text zurück, nichts anderes
- Behalte alle Namen und Anreden bei (z.B. "An Christoph", "Schreib an Maria", "Für Thomas")
- Keine Interpretation, keine Zusammenfassung, keine Erklärung
- Exakt das was gesprochen wurde, Wort für Wort

Transkript:`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio,
                },
              },
            ],
          }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini transcription error:", response.status, errorText);
      throw new Error(`Gemini transcription error: ${response.status}`);
    }

    const geminiResponse = await response.json();
    const text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ 
      text,
      source: "gemini"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Transcription failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
