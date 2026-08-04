const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";

const STREET_ADDRESS_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "intersection",
]);
const NON_ADDRESS_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "natural_feature",
  "park",
  "school",
  "hospital",
  "store",
  "restaurant",
  "lodging",
]);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const placeId = String(url.searchParams.get("placeId") || "").trim();
  const query = String(url.searchParams.get("q") || "").trim();
  const mode = url.searchParams.get("mode") === "suburb" ? "suburb" : "street";
  const referrer = String(context.request.headers.get("Referer") || `${url.origin}/`);
  const apiKey = String(
    context.env.GOOGLE_PLACES_API_KEY ||
    context.env.GOOGLE_MAPS_API_KEY ||
    context.env.GOOGLE_MAPS_BROWSER_KEY ||
    "",
  ).trim();

  if (!apiKey) return json({ ok: false, error: "Address search is not configured." }, 503);

  try {
    if (placeId) return await resolvePlace(apiKey, placeId, mode, referrer);
    if (query.length < 2) return json({ ok: true, suggestions: [] });
    return await autocomplete(apiKey, query, mode, referrer);
  } catch (error) {
    console.error("Address search failed", error);
    return json({ ok: false, error: "Address suggestions are temporarily unavailable." }, 502);
  }
}

async function autocomplete(apiKey, input, mode, referrer) {
  const requestBody = {
    input: /\b(?:vic|victoria)\b/i.test(input) ? input : `${input}, Victoria`,
    includedRegionCodes: ["au"],
    locationRestriction: {
      rectangle: {
        low: { latitude: -39.25, longitude: 140.9 },
        high: { latitude: -33.8, longitude: 150.1 },
      },
    },
    languageCode: "en-AU",
    regionCode: "AU",
  };
  if (mode === "suburb") requestBody.includedPrimaryTypes = ["(cities)"];

  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.types",
      Referer: referrer,
    },
    body: JSON.stringify(requestBody),
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
    }))
    .filter((suggestion) => {
      const text = `${suggestion.text} ${suggestion.secondaryText}`;
      return /\b(?:VIC|Victoria)\b/i.test(text) && !/\b(?:NSW|New South Wales)\b/i.test(text);
    })
    .filter((suggestion) => {
      if (mode !== "street") return true;
      const hasAddressType = suggestion.types.some((type) => STREET_ADDRESS_TYPES.has(type));
      const isOnlyNonAddressPlace = suggestion.types.some((type) => NON_ADDRESS_TYPES.has(type)) && !hasAddressType;
      return !isOnlyNonAddressPlace;
    });

  if (mode === "suburb") {
    const suburbTypes = new Set(["locality", "postal_town", "sublocality", "sublocality_level_1", "administrative_area_level_2"]);
    suggestions.sort((a, b) => Number(b.types.some((type) => suburbTypes.has(type))) - Number(a.types.some((type) => suburbTypes.has(type))));
  }

  suggestions = await Promise.all(
    suggestions.slice(0, 7).map((suggestion) => enrichSuggestion(apiKey, suggestion, mode, referrer)),
  );

  return json({ ok: true, suggestions: suggestions.filter(Boolean) });
}

async function enrichSuggestion(apiKey, suggestion, mode, referrer) {
  if (!suggestion?.placeId) return null;
  try {
    const response = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(suggestion.placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "addressComponents",
        Referer: referrer,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return normaliseSuggestion(suggestion);

    const components = Array.isArray(payload.addressComponents) ? payload.addressComponents : [];
    const get = (type, short = false) => {
      const component = components.find((entry) => entry.types?.includes(type));
      return component ? String(component[short ? "shortText" : "longText"] || "") : "";
    };
    const state = String(get("administrative_area_level_1", true) || "").toUpperCase();
    if (state && state !== "VIC") return null;

    const route = get("route");
    if (mode === "street" && !route) return null;

    const suburb = get("locality") || get("postal_town") || get("sublocality_level_1") || get("sublocality") || get("administrative_area_level_2");
    const postcode = get("postal_code");
    const secondaryText = mode === "suburb"
      ? ["VIC", postcode].filter(Boolean).join(" ")
      : [suburb, "VIC", postcode].filter(Boolean).join(" ");

    return {
      ...suggestion,
      text: [suggestion.mainText, secondaryText].filter(Boolean).join(", "),
      secondaryText,
    };
  } catch (_error) {
    return normaliseSuggestion(suggestion);
  }
}

function normaliseSuggestion(suggestion) {
  const secondaryText = String(suggestion.secondaryText || "")
    .replace(/\bVictoria\b/gi, "VIC")
    .replace(/,?\s*Australia\s*$/i, "")
    .trim();
  return { ...suggestion, secondaryText };
}

async function resolvePlace(apiKey, placeId, mode, referrer) {
  const response = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,types",
      Referer: referrer,
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
  if (mode === "street" && !route) {
    return json({ ok: false, error: "Choose a street address rather than a business or landmark." }, 422);
  }

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
