const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const placeId = String(url.searchParams.get("placeId") || "").trim();
  const query = String(url.searchParams.get("q") || "").trim();
  const mode = url.searchParams.get("mode") === "suburb" ? "suburb" : "street";
  const apiKey = String(
    context.env.GOOGLE_PLACES_API_KEY ||
    context.env.GOOGLE_MAPS_API_KEY ||
    context.env.GOOGLE_MAPS_BROWSER_KEY ||
    "",
  ).trim();

  if (!apiKey) return json({ ok: false, error: "Address search is not configured." }, 503);

  try {
    if (placeId) return await resolvePlace(apiKey, placeId);
    if (query.length < 2) return json({ ok: true, suggestions: [] });
    return await autocomplete(apiKey, query, mode);
  } catch (error) {
    console.error("Address search failed", error);
    return json({ ok: false, error: "Address suggestions are temporarily unavailable." }, 502);
  }
}

async function autocomplete(apiKey, input, mode) {
  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["au"],
      locationRestriction: {
        rectangle: {
          low: { latitude: -39.25, longitude: 140.9 },
          high: { latitude: -33.8, longitude: 150.1 },
        },
      },
      languageCode: "en-AU",
      regionCode: "AU",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Google Places autocomplete rejected", response.status, payload?.error?.status || "");
    return json({ ok: false, error: "Address suggestions are unavailable." }, 502);
  }

  let suggestions = (payload.suggestions || [])
    .map((entry) => entry?.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      placeId: prediction.placeId,
      text: prediction.text?.text || "",
      mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
      types: Array.isArray(prediction.types) ? prediction.types : [],
    }));

  if (mode === "suburb") {
    const suburbTypes = new Set(["locality", "postal_town", "sublocality", "sublocality_level_1", "administrative_area_level_2"]);
    suggestions.sort((a, b) => Number(b.types.some((type) => suburbTypes.has(type))) - Number(a.types.some((type) => suburbTypes.has(type))));
  }

  return json({ ok: true, suggestions: suggestions.slice(0, 7) });
}

async function resolvePlace(apiKey, placeId) {
  const response = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,types",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Google Places details rejected", response.status, payload?.error?.status || "");
    return json({ ok: false, error: "The selected address could not be confirmed." }, 502);
  }

  const components = Array.isArray(payload.addressComponents) ? payload.addressComponents : [];
  const get = (type, short = false) => {
    const component = components.find((entry) => entry.types?.includes(type));
    return component ? String(component[short ? "shortText" : "longText"] || "") : "";
  };
  const streetNumber = get("street_number");
  const route = get("route");
  const unit = get("subpremise");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const state = String(get("administrative_area_level_1", true) || "").toUpperCase();
  const suburb = get("locality") || get("postal_town") || get("sublocality_level_1") || get("sublocality") || get("administrative_area_level_2");
  const postcode = get("postal_code");

  if (state && state !== "VIC") return json({ ok: false, error: "Choose a Victorian address." }, 422);

  return json({
    ok: true,
    place: {
      street: unit && street ? `${unit}/${street}` : street,
      suburb,
      state: "VIC",
      postcode,
      formattedAddress: payload.formattedAddress || "",
    },
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
