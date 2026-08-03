(() => {
  const PICKUP_ADDRESS = "125 Sussex Street, Pascoe Vale VIC 3044";
  const CHECKOUT_PATH = /^\/checkouts\/([^/]+)\/thank-you\/?$/i;

  function text(value) {
    return String(value ?? "").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function isPickup(value) {
    return /pickup|pick\s*up|collect/i.test(text(value));
  }

  function formatDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return text(value) || "Not specified";
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
  }

  function timeSlotLabel(value) {
    return ({ "1ST": "1st Load", "2ND": "2nd Load", AM: "AM", PM: "PM", ANY: "Anytime" })[
      text(value).toUpperCase()
    ] || text(value) || "Anytime";
  }

  function deliveryTypeLabel(value) {
    return ({
      "Pickup (Customer to collect)": "Customer pickup",
      "Manual Unload (Knauf Labour)": "Manual unload",
      "Mechanical (Forklift/Crane/Own)": "Mechanical delivery",
      "Mixed Unload (Hand + Machine)": "Mixed unload",
    })[text(value)] || text(value) || "Not specified";
  }

  function defaultAreaLabel(key, index) {
    if (key === "ground") return "Ground Floor";
    if (key === "first") return "1st Floor";
    return `Tab ${index + 1}`;
  }

  function buildGroupsFromPayload(payload) {
    const floors = payload?.floors && typeof payload.floors === "object" ? payload.floors : {};
    return Object.entries(floors).map(([key, area], index) => {
      const lines = [];
      for (const item of Array.isArray(area?.items) ? area.items : []) {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        const product = globalThis.state?.catalog?.[item?.key] || {};
        lines.push({
          sku: text(item?.sku || product.sku).toUpperCase(),
          description: text(item?.description || item?.name || product.description || product.label || item?.key || "Product"),
          quantity,
        });
      }
      for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        lines.push({
          sku: text(item?.sku).toUpperCase(),
          description: text(item?.description || item?.name || item?.sku || "Product"),
          quantity,
        });
      }
      return {
        key,
        label: text(area?.label || defaultAreaLabel(key, index)),
        lines,
      };
    }).filter((group) => group.lines.length);
  }

  function totalsFor(groups) {
    return groups.reduce((summary, group) => ({
      lineCount: summary.lineCount + group.lines.length,
      unitCount: summary.unitCount + group.lines.reduce((sum, line) => sum + line.quantity, 0),
    }), { lineCount: 0, unitCount: 0 });
  }

  function buildClientConfirmation(result) {
    let payload = {};
    try {
      if (typeof globalThis.buildPayload === "function") payload = globalThis.buildPayload();
    } catch (_error) {
      payload = {};
    }
    const groups = buildGroupsFromPayload(payload);
    return {
      submissionId: text(result?.submissionId),
      customerReference: text(result?.customerReference || payload.reference || result?.submissionId),
      companyName: text(result?.companyName || payload.customer || globalThis.state?.account?.companyName || "Customer"),
      createdAt: new Date().toISOString(),
      viewerRole: text(result?.viewerRole || globalThis.state?.account?.role),
      generatedFiles: Array.isArray(result?.generatedFiles) ? result.generatedFiles : [],
      groups,
      totals: totalsFor(groups),
      details: {
        contact: text(payload.contact),
        mobile: text(payload.mobile),
        requiredDate: text(payload.requiredDate),
        timeSlot: text(payload.timeSlot || "ANY"),
        deliveryType: text(payload.deliveryType),
        deliveryAddress: text(payload.deliveryAddress || [payload.addressLine1, payload.addressLine2].filter(Boolean).join(", ")),
        addressLine1: text(payload.addressLine1),
        addressLine2: text(payload.addressLine2),
        extras: Array.isArray(payload.extras) ? payload.extras : [],
        instructions: text(payload.deliveryInstructions),
      },
    };
  }

  function productInitials(description) {
    const words = text(description).split(/\s+/).filter(Boolean);
    return (words[0]?.[0] || "B") + (words[1]?.[0] || "P");
  }

  function renderProductGroups(groups) {
    return groups.map((group) => `
      <section class="checkout-summary-group">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="checkout-summary-lines">
          ${group.lines.map((line) => `
            <article class="checkout-summary-line">
              <div class="checkout-product-mark" aria-hidden="true">
                <span>${escapeHtml(productInitials(line.description).toUpperCase())}</span>
                <b>${line.quantity.toLocaleString("en-AU")}</b>
              </div>
              <div class="checkout-product-copy">
                <strong>${escapeHtml(line.description)}</strong>
                <span>${line.sku ? `SKU ${escapeHtml(line.sku)}` : "Additional product"}</span>
              </div>
              <div class="checkout-product-quantity">Qty ${line.quantity.toLocaleString("en-AU")}</div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  function fileTitle(file, fileCount) {
    const filename = text(file?.filename).toUpperCase();
    if (/-V1\.XLSX$/.test(filename)) return "Accrivia format · V1";
    if (/-V2\.XLSX$/.test(filename)) return "Site area format · V2";
    return fileCount > 1 ? text(file?.floorLabel || "Order spreadsheet") : "Accrivia order file";
  }

  function renderDownloads(files) {
    if (!files.length) return "";
    return `
      <section class="checkout-card checkout-downloads" aria-labelledby="checkoutDownloadsHeading">
        <div class="checkout-card-heading">
          <div>
            <span class="checkout-kicker">Order files</span>
            <h2 id="checkoutDownloadsHeading">Download spreadsheet${files.length === 1 ? "" : "s"}</h2>
          </div>
        </div>
        <div class="checkout-download-list">
          ${files.map((file) => `
            <a class="checkout-download" href="${escapeHtml(file.downloadUrl || file.download_url || "#")}" download="${escapeHtml(file.filename || "order.xlsx")}">
              <span class="checkout-download-icon" aria-hidden="true">X</span>
              <span><strong>${escapeHtml(fileTitle(file, files.length))}</strong><small>${escapeHtml(file.filename || "order.xlsx")}</small></span>
              <b>Download</b>
            </a>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDetails(model) {
    const details = model.details || {};
    const pickup = isPickup(details.deliveryType);
    const address = pickup ? PICKUP_ADDRESS : text(details.deliveryAddress || [details.addressLine1, details.addressLine2].filter(Boolean).join(", "));
    const rows = [
      ["Customer", model.companyName],
      ["Contact", [details.contact, details.mobile].filter(Boolean).join(" · ")],
      [pickup ? "Pickup address" : "Delivery address", address],
      ["Required", `${formatDate(details.requiredDate)} · ${timeSlotLabel(details.timeSlot)}`],
      ["Delivery", deliveryTypeLabel(details.deliveryType)],
      ["Extras", Array.isArray(details.extras) && details.extras.length ? details.extras.join(", ") : "None"],
      ["Instructions", details.instructions || "None"],
    ];
    return rows.map(([label, value]) => `
      <div class="checkout-detail-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value || "—")}</dd>
      </div>
    `).join("");
  }

  function renderMap(model) {
    const details = model.details || {};
    const pickup = isPickup(details.deliveryType);
    const address = pickup ? PICKUP_ADDRESS : text(details.deliveryAddress || [details.addressLine1, details.addressLine2].filter(Boolean).join(", "));
    const mapAddress = address || PICKUP_ADDRESS;
    return `
      <div class="checkout-map">
        <iframe
          title="${escapeHtml(pickup ? "Pickup location" : "Delivery location")}" 
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed"></iframe>
        <div class="checkout-map-label">
          <span>${pickup ? "Pickup location" : "Delivery address"}</span>
          <strong>${escapeHtml(mapAddress)}</strong>
        </div>
      </div>
    `;
  }

  function checkoutPath(submissionId) {
    return `/checkouts/${encodeURIComponent(submissionId)}/thank-you`;
  }

  function activateCheckoutLayout() {
    document.body.classList.add("checkout-success-active");
    const progress = document.querySelector(".two-step-nav");
    if (progress) progress.hidden = true;
    const adminTools = document.getElementById("adminOrderTools");
    if (adminTools) adminTools.hidden = true;
    document.querySelectorAll("[data-step]").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("is-active");
    });
  }

  function renderConfirmation(model, { updateUrl = false } = {}) {
    if (!model?.submissionId) return;
    activateCheckoutLayout();
    const screen = document.getElementById("successScreen");
    if (!screen) return;
    screen.hidden = false;

    const totals = model.totals || totalsFor(model.groups || []);
    const createdLabel = model.createdAt
      ? new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Melbourne",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(model.createdAt))
      : "Just now";

    screen.innerHTML = `
      <div class="checkout-confirmation-shell">
        <main class="checkout-confirmation-main">
          <header class="checkout-confirmation-heading">
            <div class="checkout-confirmation-tick" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img"><circle cx="24" cy="24" r="22"></circle><path d="m15 24 6 6 13-14"></path></svg>
            </div>
            <div>
              <span>Order #${escapeHtml(model.customerReference)}</span>
              <h1>Thank you, ${escapeHtml(model.companyName)}!</h1>
              <p>Submitted ${escapeHtml(createdLabel)}</p>
            </div>
          </header>

          <section class="checkout-card checkout-confirmed-card">
            ${renderMap(model)}
            <div class="checkout-confirmed-copy">
              <h2>Your order is confirmed</h2>
              <p>We have received the order and sent a confirmation email. Bell Plaster will process it for the selected date and time slot.</p>
            </div>
          </section>

          ${renderDownloads(model.generatedFiles || [])}

          <section class="checkout-card checkout-information" aria-labelledby="checkoutInformationHeading">
            <div class="checkout-card-heading">
              <div>
                <span class="checkout-kicker">Confirmation details</span>
                <h2 id="checkoutInformationHeading">Customer information</h2>
              </div>
              <button id="checkoutViewHistory" class="checkout-text-button" type="button">View order history</button>
            </div>
            <dl>${renderDetails(model)}</dl>
          </section>

          <footer class="checkout-confirmation-footer">
            <p>Need help? <a href="mailto:info@bellplaster.com.au?subject=${encodeURIComponent(`Portal order ${model.customerReference}`)}">Contact us</a></p>
            <button id="checkoutContinueOrdering" class="checkout-primary-button" type="button">Continue ordering</button>
          </footer>
        </main>

        <aside class="checkout-confirmation-summary">
          <details class="checkout-summary-details" open>
            <summary>
              <span>Order summary</span>
              <strong>${totals.unitCount.toLocaleString("en-AU")} unit${totals.unitCount === 1 ? "" : "s"}</strong>
            </summary>
            <div class="checkout-summary-content">
              ${renderProductGroups(model.groups || [])}
              <div class="checkout-summary-totals">
                <div><span>Product lines</span><strong>${totals.lineCount.toLocaleString("en-AU")}</strong></div>
                <div><span>Total units</span><strong>${totals.unitCount.toLocaleString("en-AU")}</strong></div>
                <div class="checkout-summary-required"><span>Required</span><strong>${escapeHtml(formatDate(model.details?.requiredDate))}<small>${escapeHtml(timeSlotLabel(model.details?.timeSlot))}</small></strong></div>
              </div>
            </div>
          </details>
        </aside>
      </div>
    `;

    document.getElementById("checkoutContinueOrdering")?.addEventListener("click", () => {
      history.pushState({}, "", "/");
      document.body.classList.remove("checkout-success-active");
      const progress = document.querySelector(".two-step-nav");
      if (progress) progress.hidden = false;
      if (typeof globalThis.resetOrder === "function") globalThis.resetOrder();
      else location.assign("/");
    });
    document.getElementById("checkoutViewHistory")?.addEventListener("click", () => {
      if (typeof globalThis.openHistory === "function") globalThis.openHistory();
      else location.assign("/orders/");
    });

    if (updateUrl) history.replaceState({ checkoutConfirmation: true }, "", checkoutPath(model.submissionId));
    document.title = `Order ${model.customerReference} confirmed | Bell Plaster`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadConfirmation(submissionId) {
    activateCheckoutLayout();
    const screen = document.getElementById("successScreen");
    if (screen) {
      screen.hidden = false;
      screen.innerHTML = '<div class="checkout-confirmation-loading"><span></span><p>Loading order confirmation…</p></div>';
    }
    const response = await fetch(`/api/order-confirmation/${encodeURIComponent(submissionId)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || "The order confirmation could not be loaded.");
    renderConfirmation(body.confirmation);
  }

  async function restoreCheckoutRoute() {
    const match = location.pathname.match(CHECKOUT_PATH);
    if (!match) return;
    try {
      await loadConfirmation(decodeURIComponent(match[1]));
    } catch (error) {
      const screen = document.getElementById("successScreen");
      if (screen) {
        screen.hidden = false;
        screen.innerHTML = `
          <div class="checkout-confirmation-error">
            <h1>Order confirmation unavailable</h1>
            <p>${escapeHtml(error?.message || String(error))}</p>
            <a href="/">Return to the order portal</a>
          </div>`;
      }
    }
  }

  const enhancedShowSuccess = (result) => {
    renderConfirmation(buildClientConfirmation(result), { updateUrl: true });
  };
  globalThis.showSuccess = enhancedShowSuccess;
  try { showSuccess = enhancedShowSuccess; } catch (_error) { }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreCheckoutRoute, { once: true });
  } else {
    restoreCheckoutRoute();
  }
})();
