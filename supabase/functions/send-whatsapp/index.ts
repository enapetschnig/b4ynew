import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
}

interface SendWhatsAppRequest {
  to: string;
  body: string;
  recipientName?: string;
  contactId?: string;
  draftId?: string;
  mediaUrls?: MediaItem[];
}

/**
 * Formats a phone number to WHAPI format (international without + or spaces)
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0049')) {
    cleaned = '49' + cleaned.substring(4);
  } else if (cleaned.startsWith('0043')) {
    cleaned = '43' + cleaned.substring(4);
  } else if (cleaned.startsWith('0')) {
    cleaned = '49' + cleaned.substring(1);
  }
  
  return cleaned;
}

/**
 * Sends a single image via WHAPI
 */
async function sendImage(
  to: string, 
  mediaUrl: string, 
  caption: string | undefined,
  token: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch("https://gate.whapi.cloud/messages/image", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      media: mediaUrl,
      caption: caption || undefined,
    }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    return { success: false, error: result.error?.message || JSON.stringify(result) };
  }
  
  return { success: true, messageId: result.message?.id };
}

/**
 * Sends a single video via WHAPI
 */
async function sendVideo(
  to: string, 
  mediaUrl: string, 
  caption: string | undefined,
  token: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch("https://gate.whapi.cloud/messages/video", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      media: mediaUrl,
      caption: caption || undefined,
    }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    return { success: false, error: result.error?.message || JSON.stringify(result) };
  }
  
  return { success: true, messageId: result.message?.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GLOBAL_WHAPI_TOKEN = Deno.env.get("WHAPI_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwtToken);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const userId = claimsData.claims.sub as string;

    // Fetch user's personal WHAPI token from profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('whapi_token')
      .eq('user_id', userId)
      .maybeSingle();

    // Use user's token if available, otherwise fall back to global token
    const WHAPI_API_TOKEN = profileData?.whapi_token || GLOBAL_WHAPI_TOKEN;

    if (!WHAPI_API_TOKEN) {
      return new Response(JSON.stringify({ 
        error: "Kein WHAPI-Token konfiguriert. Bitte in den Einstellungen hinterlegen." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Using ${profileData?.whapi_token ? 'user-specific' : 'global'} WHAPI token`);

    const { to, body, recipientName, contactId, draftId, mediaUrls }: SendWhatsAppRequest = await req.json();

    if (!to || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedPhone = formatPhoneNumber(to);
    const hasMedia = mediaUrls && mediaUrls.length > 0;
    
    console.log(`Sending WhatsApp to ${formattedPhone}: ${body.substring(0, 50)}... (${hasMedia ? mediaUrls.length + ' media' : 'no media'})`);

    // Step 1: Send text message first
    const textResponse = await fetch("https://gate.whapi.cloud/messages/text", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: formattedPhone,
        body: body,
      }),
    });

    const textResult = await textResponse.json();

    if (!textResponse.ok) {
      console.error("WHAPI text error:", textResult);
      
      await supabase.from("messages").insert({
        user_id: userId,
        channel: "whatsapp",
        recipient_address: to,
        recipient_name: recipientName || null,
        body: body,
        status: "failed",
        error_message: textResult.error?.message || JSON.stringify(textResult),
        contact_id: contactId || null,
        draft_id: draftId || null,
      });

      return new Response(JSON.stringify({ 
        error: "Failed to send WhatsApp message",
        details: textResult 
      }), {
        status: textResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("WHAPI text success:", textResult.message?.id);

    // Step 2: Send media files sequentially
    const mediaResults: { url: string; success: boolean; messageId?: string; error?: string }[] = [];
    
    if (hasMedia) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const media = mediaUrls[i];
        const caption = i === 0 ? undefined : undefined; // No caption for media, text already sent
        
        console.log(`Sending media ${i + 1}/${mediaUrls.length}: ${media.type}`);
        
        let result;
        if (media.type === 'video') {
          result = await sendVideo(formattedPhone, media.url, caption, WHAPI_API_TOKEN);
        } else {
          result = await sendImage(formattedPhone, media.url, caption, WHAPI_API_TOKEN);
        }
        
        mediaResults.push({ url: media.url, ...result });
        
        if (!result.success) {
          console.error(`Failed to send media ${i + 1}:`, result.error);
        } else {
          console.log(`Media ${i + 1} sent:`, result.messageId);
        }
        
        // Small delay between media sends to avoid rate limiting
        if (i < mediaUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Log successful message with media count
    const allMediaSuccess = mediaResults.every(r => r.success);
    const { error: insertError } = await supabase.from("messages").insert({
      user_id: userId,
      channel: "whatsapp",
      recipient_address: to,
      recipient_name: recipientName || null,
      body: body + (hasMedia ? `\n\n[${mediaUrls.length} Medien angehängt]` : ''),
      status: allMediaSuccess ? "sent" : "partial",
      external_id: textResult.message?.id || null,
      sent_at: new Date().toISOString(),
      contact_id: contactId || null,
      draft_id: draftId || null,
    });

    if (insertError) {
      console.error("Error logging message:", insertError);
    }

    // Update draft status if provided
    if (draftId) {
      await supabase
        .from("drafts")
        .update({ status: "sent" })
        .eq("id", draftId)
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: textResult.message?.id,
      sent: textResult.sent,
      mediaResults: hasMedia ? mediaResults : undefined,
      mediaCount: hasMedia ? mediaUrls.length : 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Send WhatsApp error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
