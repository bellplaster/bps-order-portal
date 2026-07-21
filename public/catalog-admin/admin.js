const state = { products: [], file: null, importing: false };

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  document.getElementById("csvFile").addEventListener("change", selectFile);
  document.getElementById("importButton").addEventListener("click", importCatalogue);
  await loadStatus();
}

async function loadStatus() {
  try {
    const response = await fetch("/api/admin/products/import", { headers: { Accept: "application/json" } });
    if (response.status === 401) { window.location.replace("/signin/"); return; }
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Catalogue status could not be loaded.");
    document.getElementById("activeCount").textContent = Number(result.activeProductCount || 0).toLocaleString("en-AU");
    document.getElementById("latestImport").textContent = result.latestImport?.completed_at ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.latestImport.completed_at)) : "Not imported";
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function selectFile(event) {
  const file = event.target.files?.[0];
  state.file = file || null;
  state.products = [];
  document.getElementById("importButton").disabled = true;
  setProgress(0);

  if (!file) {
    document.getElementById("fileSummary").textContent = "Select the exported zISOHWhse.csv file.";
    return;
  }

  try {
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder("windows-1252").decode(bytes);
    const products = parseAccriviaProducts(text);
    state.products = products;
    document.getElementById("fileSummary").textContent = `${file.name}: ${products.length.toLocaleString("en-AU")} unique stock codes ready to import.`;
    document.getElementById("importButton").disabled = products.length === 0;
    hideMessage();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function importCatalogue() {
  if (state.importing || state.products.length === 0 || !state.file) return;
  state.importing = true;
  const button = document.getElementById("importButton");
  button.disabled = true;
  button.textContent = "Importing…";
  hideMessage();

  try {
    const begin = await api({ action: "begin", sourceName: state.file.name });
    const batchSize = 100;

    for (let start = 0; start < state.products.length; start += batchSize) {
      const products = state.products.slice(start, start + batchSize);
      await api({ action: "batch", importId: begin.importId, products });
      setProgress(Math.round(((start + products.length) / state.products.length) * 100));
    }

    const finish = await api({ action: "finish", importId: begin.importId });
    showMessage(`${Number(finish.activeProductCount || 0).toLocaleString("en-AU")} active products imported.`, "success");
    await loadStatus();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  } finally {
    state.importing = false;
    button.disabled = false;
    button.textContent = "Import catalogue";
  }
}

async function api(body) {
  const response = await fetch("/api/admin/products/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) { window.location.replace("/signin/"); throw new Error("Sign in is required."); }
  const result = await response.json().catch(() => ({ ok: false, error: "The import service returned an unreadable response." }));
  if (!response.ok || !result.ok) throw new Error(result.error || "The catalogue import failed.");
  return result;
}

function parseAccriviaProducts(text) {
  const rows = parseDelimited(text, ";");
  if (rows.length < 2) throw new Error("The CSV does not contain product rows.");
  const header = rows[0].map((value) => String(value || "").trim());
  const index = {
    warehouse: header.indexOf("Item / Warehouse"),
    available: header.indexOf("Available"),
    stockGroup: header.indexOf("Stock Group"),
    sku: header.indexOf("Stock Code"),
    description: header.indexOf("Description"),
  };
  if (index.sku < 0 || index.description < 0) throw new Error("The CSV must contain Stock Code and Description columns.");
  const products = new Map();
  for (const row of rows.slice(1)) {
    const sku = clean(row[index.sku]).toUpperCase();
    const description = clean(row[index.description]);
    if (!sku || !description) continue;
    products.set(sku, {
      sku,
      description,
      stockGroup: clean(row[index.stockGroup]),
      warehouse: clean(row[index.warehouse]),
      available: nullableNumber(row[index.available]),
    });
  }
  return [...products.values()];
}

function parseDelimited(text, delimiter) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function clean(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function nullableNumber(value) { const text = clean(value).replace(/,/g, ""); if (!text) return null; const number = Number(text); return Number.isFinite(number) ? number : null; }
function setProgress(value) { document.getElementById("progressBar").style.width = `${Math.max(0, Math.min(100, value))}%`; }
function showMessage(text, type) { const element = document.getElementById("message"); element.textContent = text; element.className = `message ${type}`; element.hidden = false; }
function hideMessage() { document.getElementById("message").hidden = true; }
