import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_form: 'du' | 'sie' | null;
}

interface ProcessRequest {
  transcript: string;
  channel: "email" | "whatsapp";
  contacts: Contact[];
  recipientName?: string;
  recipientAddress?: string;
  userSignature?: string;
}

// Default prompts following Lukasz's specification
const DEFAULT_EMAIL_PROMPT = `Du bist der persönliche Kommunikationsassistent von Lukasz Baranowski.
Deine Aufgabe ist es, gesprochene E-Mail-Texte in natürlich klingende, professionelle Geschäftsmails umzuwandeln.

Verbessere ausschließlich Stil, Klarheit und sprachliche Struktur.
Füge keine neuen Inhalte hinzu und verändere keine Aussagen.
Dichte nichts dazu und interpretiere nichts.
Bleibe inhaltlich strikt beim Originaltext.

Der Ton soll sachlich, klar, professionell und menschlich sein.
Der Text darf nicht auffällig nach KI klingen.
Verwende keine Floskeln, keine Emojis und keine Sonderzeichen.

Erstelle zusätzlich einen kurzen, sachlichen Betreff, der den Inhalt der E-Mail präzise zusammenfasst.
Der Betreff wird ausschließlich in das Betreff-Feld eingefügt und nicht im Text wiederholt.
Der E-Mail-Text beginnt direkt mit der korrekten Anrede.

Es wird keine Signatur erzeugt oder variiert. Die Signatur wird immer einheitlich vom System ergänzt.`;

const DEFAULT_WHATSAPP_PROMPT = `Du bist der persönliche Kommunikationsassistent von Lukasz Baranowski.
Deine Aufgabe ist es, gesprochene WhatsApp-Nachrichten in klare, professionelle Texte umzuwandeln.

Verbessere ausschließlich Stil, Klarheit und sprachliche Struktur.
Füge keine neuen Inhalte hinzu und verändere keine Aussagen.

Der Ton soll direkt, klar und professionell sein.
Der Text darf nicht auffällig nach KI klingen.
Verwende keine Floskeln, keine Emojis und keine Sonderzeichen.

Aufbau der Nachricht:
- Kurze Anrede (z.B. "Hallo Dijan," oder "Guten Tag Herr Müller,")
- Kurzer Einstiegssatz
- Bei Bedarf strukturierte Bulletpoints
- Keine langen Fließtexte

Abschluss je nach Anredeform:
- Du-Form: "Liebe Grüße, Lukasz"
- Sie-Form: "Liebe Grüße, Lukasz Baranowski"

Es wird keine weitere Signatur vom System ergänzt.`;

// Call Gemini API directly
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

// Call Gemini API for plain text (no JSON mode) - used for subject fallback
async function callGeminiText(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Call OpenAI API directly
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
    const { transcript, channel, contacts, recipientName, recipientAddress }: ProcessRequest = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    // Get user ID from auth header if available
    let userId: string | null = null;
    const isWhatsApp = channel === 'whatsapp';
    let userPrompt = isWhatsApp ? DEFAULT_WHATSAPP_PROMPT : DEFAULT_EMAIL_PROMPT;
    let preferredModel = "gemini";
    let promptSource = "default";
    let whatsappIncludeSubject = false;
    let useWhatsappSignature = true;
    let whatsappSignature: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;

      if (userId) {
        // Load user's active prompt based on channel
        const promptName = isWhatsApp ? 'whatsapp_main' : 'email_main';
        const { data: promptData, error: promptError } = await supabase
          .from("prompts")
          .select("content")
          .eq("user_id", userId)
          .eq("name", promptName)
          .eq("is_active", true)
          .maybeSingle();

        console.log(`Prompt loading: userId=${userId}, name=${promptName}, found=${!!promptData?.content}, error=${promptError?.message || 'none'}`);

        if (promptData?.content) {
          userPrompt = promptData.content;
          promptSource = "custom";
          console.log(`Using custom prompt (${promptData.content.length} chars)`);
        } else {
          console.log("Using default prompt");
        }

        // Load user's preferred model and message settings
        const { data: profileData } = await supabase
          .from("profiles")
          .select("preferred_model, use_whatsapp_signature, whatsapp_include_subject, whatsapp_signature")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileData?.preferred_model) {
          preferredModel = profileData.preferred_model;
        }
        if (profileData?.whatsapp_include_subject !== null && profileData?.whatsapp_include_subject !== undefined) {
          whatsappIncludeSubject = profileData.whatsapp_include_subject;
        }
        if (profileData?.use_whatsapp_signature !== null && profileData?.use_whatsapp_signature !== undefined) {
          useWhatsappSignature = profileData.use_whatsapp_signature;
        }
        if (profileData?.whatsapp_signature) {
          whatsappSignature = profileData.whatsapp_signature;
        }
      }
    }

    // Detect address form from transcript
    const duFormPattern = /in\s+du[- ]?form|duzen|informell/i;
    const sieFormPattern = /in\s+sie[- ]?form|siezen|förmlich|formell/i;
    
    let explicitAddressForm: 'du' | 'sie' | null = null;
    if (duFormPattern.test(transcript)) {
      explicitAddressForm = 'du';
    } else if (sieFormPattern.test(transcript)) {
      explicitAddressForm = 'sie';
    }

    // Clean transcript from address form instructions
    const cleanedTranscript = transcript
      .replace(/in\s+du[- ]?form/gi, '')
      .replace(/in\s+sie[- ]?form/gi, '')
      .trim();

    // Build contact list for matching
    const contactListStr = contacts.map(c => {
      const address = channel === 'email' ? c.email : c.phone;
      const form = c.address_form ? ` [${c.address_form === 'du' ? 'Du-Form' : 'Sie-Form'}]` : '';
      return `- ${c.name} (${address})${form}`;
    }).join('\n');

    // Build the processing prompt
    const addressFormInstruction = explicitAddressForm 
      ? `\n\nANREDEFORM: ${explicitAddressForm === 'du' ? 'Du-Form' : 'Sie-Form'} - Diese Form ist verbindlich anzuwenden.`
      : '\n\nANREDEFORM: Bestimme die passende Anredeform basierend auf der Kontaktliste oder dem Kontext.';

    const parsePrompt = `${userPrompt}
${addressFormInstruction}

WICHTIG: Extrahiere zuerst den Namen des Empfängers aus dem Transkript. Der Sprecher sagt oft "An [Name]", "Schreib an [Name]", "Für [Name]" oder ähnliches am Anfang.

Verfügbare Kontakte:
${contactListStr || 'Keine Kontakte verfügbar'}

Transkript: "${cleanedTranscript}"
${recipientName ? `Vorausgewählter Empfänger: ${recipientName}` : ''}

Aufgaben:
1. Finde den genannten Empfänger im Transkript und matche ihn mit der Kontaktliste
2. Entferne die Empfänger-Nennung aus dem eigentlichen Nachrichteninhalt
3. Bestimme die Anredeform: Wenn der gematchte Kontakt [Du-Form] oder [Sie-Form] hat, verwende DIESE Form verbindlich für Anrede, Text und Abschluss. Sonst: Explizit im Transkript angegeben > Default Sie-Form
4. Erstelle den Nachrichtentext gemäß den obigen Anweisungen
${channel === 'whatsapp' && !whatsappIncludeSubject ? '5. Erstelle KEINEN Betreff für WhatsApp-Nachrichten. Das subject-Feld soll leer sein.' : '5. Erstelle IMMER einen kurzen, prägnanten Betreff der den Inhalt zusammenfasst'}
${channel === 'whatsapp' && useWhatsappSignature && whatsappSignature ? `6. Verwende exakt diese Signatur als Abschluss der Nachricht (NICHT verändern): "${whatsappSignature}"` : ''}
${channel === 'whatsapp' && !useWhatsappSignature ? '6. Füge KEINEN Abschlussgruß oder Signatur ein. Die Nachricht endet nach dem inhaltlichen Text.' : ''}

Antworte NUR im folgenden JSON-Format:
{
  "detectedRecipient": "Name aus Transkript",
  "matchedContact": "Vollständiger Name aus Kontaktliste oder null",
  "addressForm": "du" oder "sie",
  "subject": "${channel === 'whatsapp' && !whatsappIncludeSubject ? 'Leer lassen für WhatsApp' : 'PFLICHTFELD - Betreff der den Inhalt zusammenfasst'}",
  "body": "Vollständiger Nachrichtentext",
  "summary": "Kurze Zusammenfassung in 1-2 Sätzen"
}`;

    const systemPrompt = "Du bist ein präziser Assistent für Geschäftskommunikation. Antworte immer nur mit validem JSON.";

    let content: string;
    let modelUsed = preferredModel;
    let fallbackReason = "";

    if (preferredModel === "openai" && OPENAI_API_KEY) {
      try {
        content = await callOpenAI(OPENAI_API_KEY, systemPrompt, parsePrompt);
      } catch (openaiError) {
        const errorMsg = openaiError instanceof Error ? openaiError.message : String(openaiError);
        console.error("OpenAI failed, falling back to Gemini:", errorMsg);
        fallbackReason = errorMsg;
        if (GEMINI_API_KEY) {
          content = await callGemini(GEMINI_API_KEY, systemPrompt, parsePrompt);
          modelUsed = "gemini (fallback)";
        } else {
          throw openaiError;
        }
      }
    } else if (GEMINI_API_KEY) {
      content = await callGemini(GEMINI_API_KEY, systemPrompt, parsePrompt);
    } else {
      throw new Error("Kein API-Key konfiguriert. Bitte GEMINI_API_KEY oder OPENAI_API_KEY als Edge Function Secret setzen.");
    }

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response - handle markdown code blocks and extract JSON
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
    
    let draft;
    try {
      draft = JSON.parse(jsonContent);
      console.log(`AI response parsed: subject="${draft.subject || ''}", addressForm="${draft.addressForm}", matchedContact="${draft.matchedContact}", promptSource=${promptSource}`);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(JSON.stringify({
        subject: "",
        body: content,
        summary: "Konnte Nachricht nicht strukturieren",
        channel,
        detectedRecipient: null,
        matchedContact: null,
        recipientName: null,
        recipientAddress: null,
        originalTranscript: transcript,
        addressForm: 'sie',
        parseError: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the matched contact from the list
    let matchedContactData: Contact | null = null;
    if (draft.matchedContact) {
      matchedContactData = contacts.find(c => 
        c.name.toLowerCase() === draft.matchedContact.toLowerCase() ||
        c.name.toLowerCase().includes(draft.matchedContact.toLowerCase()) ||
        draft.matchedContact.toLowerCase().includes(c.name.toLowerCase())
      ) || null;
    }

    // Determine final address form: explicit > contact setting > AI decision > default 'sie'
    let finalAddressForm = explicitAddressForm 
      || matchedContactData?.address_form 
      || draft.addressForm 
      || 'sie';

    // Determine final recipient
    const finalRecipientName = recipientName || matchedContactData?.name || draft.detectedRecipient || null;
    const finalRecipientAddress = recipientAddress || 
      (channel === 'email' ? matchedContactData?.email : matchedContactData?.phone) || 
      null;

    // Fallback: if AI didn't generate a subject, use a 2nd AI call to generate one from the body
    let finalSubject = draft.subject?.trim() || '';
    if (!finalSubject) {
      try {
        const subjectPrompt = `Erstelle einen kurzen, prägnanten Betreff (max 8 Wörter) der den Inhalt der folgenden Nachricht zusammenfasst. Antworte NUR mit dem Betreff-Text, ohne Anführungszeichen.\n\nNachricht:\n${draft.body}`;
        const sysPrompt = "Du gibst nur einen kurzen Betreff zurück, nichts anderes.";
        if (preferredModel === "openai" && OPENAI_API_KEY) {
          finalSubject = (await callOpenAI(OPENAI_API_KEY, sysPrompt, subjectPrompt)).trim();
        } else if (GEMINI_API_KEY) {
          finalSubject = (await callGeminiText(GEMINI_API_KEY, sysPrompt, subjectPrompt)).trim();
        }
        finalSubject = finalSubject.replace(/^["']|["']$/g, '');
        console.log(`Subject fallback generated: "${finalSubject}"`);
      } catch (e) {
        console.error("Subject fallback failed:", e);
      }
    }
    if (!finalSubject) finalSubject = "Nachricht";

    return new Response(JSON.stringify({
      subject: finalSubject,
      body: draft.body,
      summary: draft.summary,
      channel,
      detectedRecipient: draft.detectedRecipient,
      matchedContact: matchedContactData,
      recipientName: finalRecipientName,
      recipientAddress: finalRecipientAddress,
      originalTranscript: transcript,
      addressForm: finalAddressForm,
      promptSource,
      modelUsed,
      fallbackReason,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Process delegation error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
