import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  from?: string;
  subject: string;
  body: string;
  signature?: string;
  recipientName?: string;
  senderName?: string;
  replyTo?: string;
  webhookUrl: string;
}

function buildSimpleHtml(body: string, signature?: string): string {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>');
  const signatureHtml = signature
    ? `<br><br><span style="color:#666;">${escapeHtml(signature).replace(/\n/g, '<br>')}</span>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;">
${bodyHtml}${signatureHtml}
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, from, subject, body, signature, recipientName, senderName, replyTo, webhookUrl }: SendEmailRequest = await req.json();

    if (!to || !subject || !body || !webhookUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body, webhookUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = buildSimpleHtml(body, signature);

    // Format from as "Display Name <email>" if both are provided
    const formattedFrom = from
      ? (senderName ? `${senderName} <${from}>` : from)
      : undefined;

    console.log(`Sending email to ${to}, from: ${formattedFrom}, subject: "${subject}"`);

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: formattedFrom,
        subject,
        html,
        recipient_name: recipientName || undefined,
        reply_to: replyTo || undefined,
      }),
    });

    if (!webhookResponse.ok) {
      const errText = await webhookResponse.text().catch(() => "Unknown error");
      console.error("Webhook error:", webhookResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Email-Versand fehlgeschlagen: ${webhookResponse.status}`, details: errText }),
        { status: webhookResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await webhookResponse.json().catch(() => ({}));
    console.log("Email sent successfully via webhook");

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
