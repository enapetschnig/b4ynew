import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  recipientName: string;
  senderName?: string;
  replyTo?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(RESEND_API_KEY);
    const { to, subject, body, recipientName, senderName, replyTo }: SendEmailRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format body with line breaks for HTML
    const htmlBody = body
      .replace(/\n/g, '<br>')
      .replace(/•/g, '&bull;');

    // Build email options
    const emailOptions: any = {
      from: `${senderName || 'Delegieren'} <info@chrisnapetschnig.at>`,
      to: [to],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="padding: 20px 0;">
              ${htmlBody}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999;">
              Gesendet von ${senderName || 'Delegieren'}
            </p>
          </body>
        </html>
      `,
      text: body,
    };

    // Add reply_to if provided
    if (replyTo) {
      emailOptions.reply_to = replyTo;
      console.log("Setting reply-to:", replyTo);
    }

    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send email",
        details: error.response?.body || null
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
