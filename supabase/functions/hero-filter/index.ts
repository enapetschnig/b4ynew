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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nicht konfiguriert");
    }

    const { query, items, type } = await req.json();

    if (!query || !items || !Array.isArray(items)) {
      throw new Error("query und items sind erforderlich");
    }

    // Build a compact summary of items for the LLM
    const itemSummaries = items.map((item: Record<string, unknown>, i: number) => {
      if (type === "products") {
        const bd = item.base_data as Record<string, unknown> | null;
        return `[${i}] Nr:${item.nr} Name:${bd?.name || ""} Kat:${bd?.category || ""} Einheit:${bd?.unit_type || ""} EK:${item.base_price} VK:${item.list_price}`;
      }
      return `[${i}] Nr:${item.nr} Name:${item.name} Einheit:${item.unit_type || ""} Preis:${item.net_price_per_unit} Zeit:${item.time_minutes}min Mat:${item.materialCount || 0}`;
    }).join("\n");

    const systemPrompt = "Du bist ein Filterassistent für eine Preisliste. Der User beschreibt was er sucht. Du gibst NUR ein JSON-Array mit den Index-Nummern zurück die passen. Keine Erklärung, nur das Array. Beispiel: [0, 3, 7, 12]";

    const userPrompt = `Filtere diese ${type === "products" ? "Artikel" : "Leistungen"} nach der Anfrage: "${query}"\n\nListe:\n${itemSummaries}\n\nAntworte NUR mit einem JSON-Array der passenden Index-Nummern.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      throw new Error(`Gemini API: ${response.status}`);
    }

    const geminiData = await response.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Extract JSON array from response
    const match = content.match(/\[[\d\s,]*\]/);
    const indices: number[] = match ? JSON.parse(match[0]) : [];

    // Filter items by indices
    const filtered = indices
      .filter((i: number) => i >= 0 && i < items.length)
      .map((i: number) => items[i]);

    console.log(`hero-filter: "${query}" → ${filtered.length}/${items.length} Treffer`);

    return new Response(JSON.stringify({ items: filtered, count: filtered.length, query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("hero-filter error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
