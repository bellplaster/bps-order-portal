(() => {
  let placesPromise = null;

  function loadAdminUserManagement() {
    if (!document.getElementById("usersList") || document.querySelector('script[data-admin-user-management="true"]')) return;
    const script = document.createElement("script");
    script.src = "/admin-user-management.js?v=20260730-2";
    script.defer = true;
    script.dataset.adminUserManagement = "true";
    document.body.append(script);
  }

  function fetchJson(url) {
    return fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed (${response.status}).`);
      return payload;
    });
  }

  function cleanReference(value) {
    return String(value || "")
      .replace(/[^0-9-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+/g, "")
      .slice(0, 30);
  }

  function titleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/(^|[\s\-\/])([a-z])/g, (_match, boundary, letter) => `${boundary}${letter.toUpperCase()}`)
      .replace(/\b(Vic|Nsw|Qld|Sa|Wa|Tas|Nt|Act)\b/g, (match) => match.toUpperCase());
  }

  function sentenceCase(value) {
    const text = String(value || "");
    const index = text.search(/[A-Za-z]/);
    if (index < 0) return text;
    return `${text.slice(0, index)}${text[index].toUpperCase()}${text.slice(index + 1)}`;
  }

  function emit(field) {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function formatField(field, formatter) {
    if (!field) return;
    const formatted = formatter(field.value);
    if (formatted !== field.value) {
      field.value = formatted;
      emit(field);
    }
  }

  function initialiseFormatting() {
    const contact = document.getElementById("defaultContactName");
    const street = document.getElementById("defaultStreet");
    const suburb = document.getElementById("defaultSuburb");
    const instructions = document.getElementById("defaultInstructions");

    [[contact, titleCase], [street, titleCase], [suburb, titleCase], [instructions, sentenceCase]].forEach(([field, formatter]) => {
      if (!field || field.dataset.accountFormatBound === "true") return;
      field.dataset.accountFormatBound = "true";
      field.addEventListener("blur", () => formatField(field, formatter));
      field.addEventListener("change", () => formatField(field, formatter));
    });

    document.getElementById("accountForm")?.addEventListener("submit", () => {
      formatField(contact, titleCase);
      formatField(street, titleCase);
      formatField(suburb, titleCase);
      formatField(instructions, sentenceCase);
    }, true);
  }

  function initialiseReferenceField() {
    const input = document.getElementById("defaultReference");
    if (!input) return;
    input.oninput = null;
    input.inputMode = "text";
    input.pattern = "[0-9]+(?:-[0-9]+)*";
    input.maxLength = 30;
    input.title = "Use numbers with optional dashes, for example 8888-1.";
    input.value = cleanReference(input.value);
    if (input.dataset.referenceFormat === "true") return;
    input.dataset.referenceFormat = "true";
    input.addEventListener("input", () => {
      const cleaned = cleanReference(input.value);
      if (input.value !== cleaned) input.value = cleaned;
      input.setCustomValidity("");
    });
    input.addEventListener("invalid", () => input.setCustomValidity("Use numbers with single dashes, for example 8888-1."));
  }

  function loadPlaces(apiKey) {
    if (window.google?.maps?.places) return Promise.resolve();
    if (placesPromise) return placesPromise;
    placesPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existing) {
        const wait = window.setInterval(() => {
          if (!window.google?.maps?.places) return;
          window.clearInterval(wait);
          resolve();
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(wait);
          if (window.google?.maps?.places) resolve();
          else reject(new Error("Google Places did not initialise."));
        }, 10000);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => window.google?.maps?.places ? resolve() : reject(new Error("Google Places did not initialise."));
      script.onerror = () => reject(new Error("Google address search failed to load."));
      document.head.append(script);
    });
    return placesPromise;
  }

  function componentValue(components, type, short = false) {
    const component = (components || []).find((item) => item.types?.includes(type));
    return component ? component[short ? "short_name" : "long_name"] || "" : "";
  }

  function parseComponents(components) {
    const streetNumber = componentValue(components, "street_number");
    const route = componentValue(components, "route");
    const unit = componentValue(components, "subpremise");
    const baseStreet = [streetNumber, route].filter(Boolean).join(" ");
    return {
      street: titleCase(unit && baseStreet ? `${unit}/${baseStreet}` : baseStreet),
      suburb: titleCase(componentValue(components, "locality") || componentValue(components, "postal_town") || componentValue(components, "sublocality_level_1") || componentValue(components, "sublocality")),
      state: componentValue(components, "administrative_area_level_1", true).toUpperCase(),
      postcode: componentValue(components, "postal_code"),
    };
  }

  function showError(message) {
    const root = document.getElementById("accountMessage");
    if (!root) return;
    root.textContent = message;
    root.className = "portal-message is-error";
    root.hidden = false;
  }

  async function completeFromPlace(place, fields, source) {
    let components = place?.address_components || [];
    if ((!componentValue(components, "postal_code") || !componentValue(components, "administrative_area_level_1")) && place?.place_id) {
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ placeId: place.place_id });
        components = result?.results?.[0]?.address_components || components;
      } catch (_error) { }
    }
    const parsed = parseComponents(components);
    if (parsed.state && parsed.state !== "VIC") {
      showError("Choose a Victorian address or suburb.");
      return;
    }
    if (source === "street") {
      if (parsed.street) fields.street.value = parsed.street;
      if (parsed.suburb) fields.suburb.value = parsed.suburb;
    } else if (parsed.suburb) fields.suburb.value = parsed.suburb;
    if (parsed.postcode) fields.postcode.value = parsed.postcode;
    [fields.street, fields.suburb, fields.postcode].forEach(emit);
  }

  async function initialiseAddressSuggestions() {
    const fields = {
      street: document.getElementById("defaultStreet"),
      suburb: document.getElementById("defaultSuburb"),
      postcode: document.getElementById("defaultPostcode"),
    };
    if (!fields.street || !fields.suburb || !fields.postcode) return;
    fields.street.autocomplete = "off";
    fields.suburb.autocomplete = "off";
    fields.postcode.autocomplete = "off";
    try {
      const config = await fetchJson("/api/address-config");
      if (!config?.configured || !config?.apiKey) return;
      await loadPlaces(config.apiKey);
      const streetAutocomplete = new google.maps.places.Autocomplete(fields.street, {
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address", "place_id"],
        types: ["address"],
      });
      streetAutocomplete.addListener("place_changed", () => completeFromPlace(streetAutocomplete.getPlace(), fields, "street"));
      const suburbAutocomplete = new google.maps.places.Autocomplete(fields.suburb, {
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address", "name", "place_id"],
        types: ["(regions)"],
      });
      suburbAutocomplete.addListener("place_changed", () => completeFromPlace(suburbAutocomplete.getPlace(), fields, "suburb"));
    } catch (error) {
      console.warn("Account address autocomplete unavailable:", error);
    }
  }

  function initialise() {
    if (!document.body.classList.contains("account-page")) return;
    loadAdminUserManagement();
    initialiseReferenceField();
    initialiseFormatting();
    void initialiseAddressSuggestions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();