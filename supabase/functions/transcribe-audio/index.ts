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
        // Fall through to Lovable AI fallback on permission/auth errors
        console.log("Falling back to Lovable AI for transcription...");
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

    // Fallback: Use Lovable AI with Gemini for transcription
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("No transcription service configured");
    }

    // Convert audio to base64 for Gemini
    // Use chunked approach to avoid stack overflow with large files
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let base64Audio = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      base64Audio += String.fromCharCode(...chunk);
    }
    base64Audio = btoa(base64Audio);

    // Determine correct MIME type
    const mimeType = audioFile.type || "audio/webm";
    console.log("Transcribing audio with MIME type:", mimeType, "size:", arrayBuffer.byteLength);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Du erhältst eine deutsche Sprachaufnahme. Transkribiere sie WORTGETREU.

WICHTIG:
- Gib NUR den transkribierten Text zurück, nichts anderes
- Behalte alle Namen und Anreden bei (z.B. "An Christoph", "Schreib an Maria", "Für Thomas")
- Keine Interpretation, keine Zusammenfassung, keine Erklärung
- Exakt das was gesprochen wurde, Wort für Wort

Transkript:`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Audio}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI transcription error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const text = aiResponse.choices?.[0]?.message?.content || "";

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
