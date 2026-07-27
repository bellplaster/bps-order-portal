(() => {
  let attempts = 0;
  let ready = false;

  patchGoogleAddressInitialiser();
  patchAddressCapitalisation();
  scheduleInitialisation();
  document.addEventListener("DOMContentLoaded", scheduleInitialisation, { once: true });

  function patchGoogleAddressInitialiser() {
    if (window.initialiseGoogleAddress?.__suburbOnlyPatched) return;
    const patched = async function initialiseSuburbOnlyGoogleAddress() {
      try {
        const config = await fetchJson("/api/address-config");
        if (!config.configured || !config.apiKey) return;
        await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.apiKey)}&libraries=places&v=weekly`);
        scheduleInitialisation();
      } catch (error) {
        console.warn("Google suburb suggestions are unavailable.", error);
      }
    };
    patched.__suburbOnlyPatched = true;
    window.initialiseGoogleAddress = patched;
    try { initialiseGoogleAddress = patched; } catch (_error) { }
  }

  function patchAddressCapitalisation() {
    const formatter = (value) => titleCase(String(value || "")
      .replace(/,?\s*Australia\s*$/i, "")
      .replace(/\bVictoria\b/gi, "VIC")
      .replace(/\s+/g, " ")
      .trim());
    window.formatAddressDisplay = formatter;
    try { formatAddressDisplay = formatter; } catch (_error) { }
  }

  function scheduleInitialisation() {
    if (ready) return;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (ready || attempts >= 120) {
        window.clearInterval(timer);
        return;
      }
      if (!window.google?.maps?.places?.Autocomplete) return;
      if (!document.querySelector(".structured-address-grid")) return;
      initialiseSuburbInput();
      if (ready) window.clearInterval(timer);
    }, 100);
  }

  function initialiseSuburbInput() {
    const current = document.getElementById("deliveryAddressSearch");
    const control = current?.closest(".address-control");
    if (!current || !control || current.dataset.managerSuburbReady === "true") {
      ready = current?.dataset.managerSuburbReady === "true";
      return;
    }

    const input = current.cloneNode(true);
    input.value = current.value;
    input.placeholder = "Suburb";
    input.autocomplete = "off";
    input.dataset.managerSuburbReady = "true";
    input.removeAttribute("data-suburb-autocomplete");
    current.replaceWith(input);

    input.addEventListener("input", () => {
      setValue("deliveryPostcode", "");
      input.setCustomValidity("");
      syncAddress();
      scheduleDraft?.();
    });

    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "place_id"],
      types: ["(regions)"],
    });
    state.addressAutocomplete = autocomplete;
    autocomplete.addListener("place_changed", async () => {
      const place = autocomplete.getPlace();
      let parsed = parseComponents(place?.address_components || []);
      if (!parsed.postcode && place?.place_id && google.maps.Geocoder) {
        try {
          const response = await new google.maps.Geocoder().geocode({ placeId: place.place_id });
          parsed = parseComponents(response.results?.[0]?.address_components || place?.address_components || []);
        } catch (_error) { }
      }
      if (parsed.state && parsed.state !== "VIC") {
        input.setCustomValidity("Choose a Victorian suburb.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      input.value = titleCase(parsed.suburb || input.value);
      setValue("deliveryPostcode", parsed.postcode || "");
      syncAddress();
      const clear = document.getElementById("clearAddressButton");
      if (clear) clear.hidden = false;
      window.setTimeout(syncAddress, 20);
      scheduleDraft?.();
    });
    ready = true;
  }

  function parseComponents(components) {
    const get = (type, short = false) => {
      const component = components.find((item) => item.types?.includes(type));
      return component ? component[short ? "short_name" : "long_name"] : "";
    };
    return {
      suburb: get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2"),
      state: String(get("administrative_area_level_1", true) || "").toUpperCase(),
      postcode: get("postal_code"),
    };
  }

  function syncAddress() {
    const street = value("deliveryStreet");
    const suburb = value("deliveryAddressSearch");
    const postcode = value("deliveryPostcode");
    const line2 = [suburb, "VIC", postcode].filter(Boolean).join(" ");
    setValue("deliveryAddressLine1", street);
    setValue("deliveryAddressLine2", line2);
    setValue("deliveryAddress", [street, line2].filter(Boolean).join(", "));
  }

  function titleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
      .replace(/\bVic\b/g, "VIC");
  }
})();
