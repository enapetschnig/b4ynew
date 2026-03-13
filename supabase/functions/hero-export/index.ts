import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HERO_ENDPOINT = "https://login.hero-software.de/api/external/v9/graphql";

function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function heroGql(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(HERO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, variables: variables || {} }),
      });

      if (resp.status >= 502 && resp.status <= 504) {
        lastError = new Error(`HERO API: HTTP ${resp.status}`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      const text = await resp.text();
      if (!text.trim()) {
        lastError = new Error("HERO API: Leere Antwort");
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      const data = JSON.parse(text);
      if (data.errors) {
        throw new Error(`GraphQL: ${JSON.stringify(data.errors)}`);
      }
      return data.data;
    } catch (e) {
      if (e instanceof SyntaxError) {
        lastError = new Error("HERO API: Ungültige JSON-Antwort");
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error("HERO API: Unbekannter Fehler");
}

async function fetchAllServices(apiKey: string) {
  const pageSize = 200;
  const allItems: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const q = `query($first: Int, $offset: Int) {
      supply_services(first: $first, offset: $offset) {
        id nr name description manufacturer unit_type
        net_price_per_unit vat_percent time_minutes
        positions {
          __typename
          ... on Documents_SupplyProduct {
            id nr name quantity unit_type net_price_per_unit base_price list_price
          }
        }
      }
    }`;

    const data = await heroGql(apiKey, q, { first: pageSize, offset });
    const batch = (data.supply_services as Record<string, unknown>[]) || [];
    if (batch.length === 0) break;

    for (const item of batch) {
      // Strip HTML from description
      if (typeof item.description === "string") {
        item.description = stripHtml(item.description);
      }
      // Extract materials from positions
      const positions = (item.positions as Record<string, unknown>[]) || [];
      const materials = positions.filter(p => p.__typename === "Documents_SupplyProduct");
      item.materials = materials;
      item.materialCount = materials.length;
      delete item.positions;
    }

    allItems.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  allItems.sort((a, b) => {
    const nrA = String(a.nr || '');
    const nrB = String(b.nr || '');
    const numA = parseFloat(nrA);
    const numB = parseFloat(nrB);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return nrA.localeCompare(nrB);
  });

  return allItems;
}

async function fetchAllProducts(apiKey: string) {
  const pageSize = 200;
  const allItems: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const q = `query($first: Int, $offset: Int) {
      supply_product_versions(first: $first, offset: $offset) {
        nr internal_identifier base_price list_price vat_percent
        is_deleted price_quantity quantity_min quantity_interval delivery_time attributes
        base_data {
          name description category unit_type manufacturer manufacturer_nr
        }
      }
    }`;

    const data = await heroGql(apiKey, q, { first: pageSize, offset });
    const batch = (data.supply_product_versions as Record<string, unknown>[]) || [];
    if (batch.length === 0) break;

    for (const item of batch) {
      const bd = item.base_data as Record<string, unknown> | null;
      if (bd && typeof bd.description === "string") {
        bd.description = stripHtml(bd.description);
      }
    }

    allItems.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  allItems.sort((a, b) => {
    const nrA = String(a.nr || '');
    const nrB = String(b.nr || '');
    const numA = parseFloat(nrA);
    const numB = parseFloat(nrB);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return nrA.localeCompare(nrB);
  });

  return allItems;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERO_API_KEY = Deno.env.get("HERO_API_KEY");
    if (!HERO_API_KEY) {
      throw new Error("HERO_API_KEY nicht konfiguriert");
    }

    const { type } = await req.json();

    let items;
    if (type === "services") {
      items = await fetchAllServices(HERO_API_KEY);
    } else if (type === "products") {
      items = await fetchAllProducts(HERO_API_KEY);
    } else {
      throw new Error(`Unbekannter Typ: ${type}`);
    }

    console.log(`hero-export: ${type} → ${items.length} Einträge`);

    return new Response(JSON.stringify({ items, count: items.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("hero-export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
