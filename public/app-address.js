async function initialiseGoogleAddress() {
  try {
    const config = await fetchJson("/api/address-config");
    if (!config.configured || !config.apiKey) return;
    await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.apiKey)}&libraries=places&v=weekly`);
    const input = document.getElementById("deliveryAddressSearch");
    state.addressAutocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address"],
      types: ["address"],
    });
    state.addressAutocomplete.addListener("place_changed", () => {
      const place = state.addressAutocomplete.getPlace();
      if (!place?.address_components) return;
      const parsed = parseGoogleAddress(place.address_components);
      setValue("deliveryAddressSearch", place.formatted_address || [parsed.line1, parsed.line2].filter(Boolean).join(", "));
      setValue("deliveryAddress", value("deliveryAddressSearch"));
      setValue("deliveryAddressLine1", parsed.line1);
      setValue("deliveryAddressLine2", parsed.line2);
      document.getElementById("clearAddressButton").hidden = false;
      scheduleDraft();
    });
    input.addEventListener("input", () => {
      setValue("deliveryAddress", input.value);
      setValue("deliveryAddressLine1", "");
      setValue("deliveryAddressLine2", "");
      document.getElementById("clearAddressButton").hidden = !input.value;
      scheduleDraft();
    });
    input.addEventListener("blur", parseAndStoreManualAddress);
  } catch (error) {
    console.warn("Google address suggestions are unavailable.", error);
  }
}

function parseGoogleAddress(components) {
  const get = (type, short = false) => {
    const component = components.find((item) => item.types.includes(type));
    return component ? component[short ? "short_name" : "long_name"] : "";
  };
  const streetNumber = get("street_number");
  const route = get("route");
  const unit = get("subpremise");
  const suburb = get("locality") || get("postal_town") || get("sublocality");
  const stateName = get("administrative_area_level_1", true).toUpperCase();
  const postcode = get("postal_code");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  return {
    line1: unit ? `${unit}/${street}` : street,
    line2: [suburb, stateName === "VIC" ? "VIC" : stateName, postcode].filter(Boolean).join(" "),
  };
}

function parseAndStoreManualAddress() {
  const input = document.getElementById("deliveryAddressSearch");
  if (input.disabled) return;
  const text = input.value.trim().replace(/\s+/g, " ");
  setValue("deliveryAddress", text);
  if (!text || (value("deliveryAddressLine1") && value("deliveryAddressLine2"))) return;
  const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
  let line1 = "";
  let line2 = "";
  if (commaParts.length >= 2) {
    const tail = commaParts.slice(1).join(" ").replace(/\bVictoria\b/i, "VIC");
    if (/\bVIC\b/i.test(tail) && /\b(?:3\d{3}|8\d{3})\b/.test(tail)) {
      line1 = commaParts[0];
      line2 = tail;
    }
  }
  if (!line1) {
    const match = text.match(/^(.+?)\s+([^,]+?)\s+(VIC|Victoria)\s+(3\d{3}|8\d{3})$/i);
    if (match) {
      line1 = match[1].trim();
      line2 = `${match[2].trim()} VIC ${match[4]}`;
    }
  }
  if (line1 && line2) {
    setValue("deliveryAddressLine1", line1);
    setValue("deliveryAddressLine2", line2.replace(/\s+/g, " ").trim());
  }
}

function clearAddress() {
  ["deliveryAddressSearch", "deliveryAddress", "deliveryAddressLine1", "deliveryAddressLine2"].forEach((id) => setValue(id, ""));
  document.getElementById("clearAddressButton").hidden = true;
  scheduleDraft();
}

function updatePickupMode() {
  const pickup = selectedRadio("deliveryType") === "Pickup (Customer to collect)";
  const input = document.getElementById("deliveryAddressSearch");
  input.disabled = pickup;
  input.placeholder = pickup ? "Not required for pickup" : "Start typing a Victorian delivery address";
  if (pickup) {
    setValue("deliveryAddress", "Pickup");
    setValue("deliveryAddressLine1", "Pickup");
    setValue("deliveryAddressLine2", "");
  } else if (input.value === "Pickup") {
    clearAddress();
  }
}

function updateFutureDateConfirmation() {
  const orderDate = value("orderDateIso");
  const requiredDate = value("requiredDate");
  const show = Boolean(orderDate && requiredDate && daysBetween(orderDate, requiredDate) >= 180);
  document.getElementById("futureDateConfirmation").hidden = !show;
  if (!show) document.getElementById("confirmFutureRequiredDate").checked = false;
}

function setToday() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  setValue("orderDateIso", iso);
  setValue("orderDate", formatDate(iso));
  const required = document.getElementById("requiredDate");
  required.min = iso;
  required.removeAttribute("max");
}

function scheduleDraft() {
  if (state.suppressDraft || !state.account?.accountId) return;
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(saveDraft, 300);
}

function saveDraft() {
  const draft = buildPayload();
  draft.editingOrder = state.editingOrder;
  localStorage.setItem(draftKey(), JSON.stringify(draft));
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (!saved) return;
    state.editingOrder = saved.editingOrder || null;
    applyPayload(saved);
    if (state.editingOrder) {
      document.getElementById("editModeBanner").hidden = false;
      document.getElementById("editOrderNumber").textContent = state.editingOrder.orderNumber || saved.reference || "";
      document.getElementById("submitButton").textContent = "Update order";
    }
  } catch (_error) {
    clearDraft();
  }
}

function clearDraft() { localStorage.removeItem(draftKey()); }
function draftKey() { return `bell-order-draft-v1:${state.account?.accountId || "unknown"}`; }

function openHistory() {
  document.getElementById("historyDrawer").classList.add("is-open");
  document.getElementById("historyDrawer").setAttribute("aria-hidden", "false");
  document.getElementById("historyBackdrop").hidden = false;
  document.body.classList.add("drawer-open");
  loadOrderHistory();
}
function closeHistory() {
  document.getElementById("historyDrawer").classList.remove("is-open");
  document.getElementById("historyDrawer").setAttribute("aria-hidden", "true");
  document.getElementById("historyBackdrop").hidden = true;
  document.body.classList.remove("drawer-open");
}

async function logout() {
  await fetch("/api/logout", { method: "POST" }).catch(() => null);
  window.location.replace("/signin/");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 401) {
    window.location.replace("/signin/");
    throw new Error("Authentication required.");
  }
  const result = await response.json().catch(() => ({ ok: false, error: "The server returned an unreadable response." }));
  if (!response.ok || result.ok === false) throw new Error(result.error || "The request failed.");
  return result;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.append(script);
  });
}

function syncQuantityInputs(floor) {
  document.querySelectorAll(`[aria-label$="for ${floorLabels[floor]}"]`).forEach((input) => {
    const label = input.getAttribute("aria-label");
    const key = Object.keys(state.catalog).find((candidate) => label.startsWith(state.catalog[candidate]?.label || "__never__"));
    if (key) input.value = state.quantities[floor].get(key) || "";
  });
  document.querySelectorAll(`#${floor}OrderSheet .quantity-input`).forEach((input) => {
    const product = Object.entries(state.catalog).find(([, item]) => input.getAttribute("aria-label")?.startsWith(item.label));
    if (product) input.value = state.quantities[floor].get(product[0]) || "";
  });
}

function combinedLabel(label, detail) {
  const primary = String(label || "").trim();
  const secondary = String(detail || "").trim();
  if (!secondary || primary.toLowerCase().includes(secondary.toLowerCase())) return primary;
  return `${primary} · ${secondary}`;
}
function selectedRadio(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value || ""; }
function checkedValues(name) { return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value); }
function setRadio(name, selected) { document.querySelectorAll(`input[name="${name}"]`).forEach((input) => { input.checked = input.value === selected; }); }
function value(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setValue(id, valueToSet) { const element = document.getElementById(id); if (element) element.value = valueToSet || ""; }
function daysBetween(from, to) { return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000); }
function formatDate(iso) { if (!iso) return ""; const [year, month, day] = iso.split("-"); return `${day}-${month}-${year}`; }
function normaliseMobile(input) { let digits = String(input || "").replace(/\D/g, ""); if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`; if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`; if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`; if (/^(1300|1800)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`; if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`; return ""; }
function formatMobileTyping(input) { let digits = String(input || "").replace(/\D/g, ""); if (digits.startsWith("61")) digits = `0${digits.slice(2)}`; digits = digits.slice(0, 10); if (digits.startsWith("04")) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" "); if (/^0[2378]/.test(digits)) return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join(" "); if (/^(1300|1800)/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" "); if (digits.startsWith("13")) return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(" "); return digits; }
function fieldError(id, message) { document.getElementById(id)?.focus(); return new Error(message); }
function showGlobal(message, type = "error") { const box = document.getElementById("globalMessage"); box.textContent = message; box.className = `portal-message is-${type}`; box.hidden = false; window.scrollTo({ top: 0, behavior: "smooth" }); }
function showFormMessage(message, type = "error") { const box = document.getElementById("formMessage"); box.textContent = message; box.className = `portal-message is-${type}`; box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" }); }
function clearMessages() { document.getElementById("globalMessage").hidden = true; document.getElementById("formMessage").hidden = true; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }