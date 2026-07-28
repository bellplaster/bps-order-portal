(() => {
  function boardArea(line) {
    const label = String(line?.label || "");
    const dimensionMatch = label.match(/\b(\d{3,4})\s*[×xX]\s*(\d{3,4})\b/);
    if (!dimensionMatch) return null;
    const first = Number(dimensionMatch[1]);
    const second = Number(dimensionMatch[2]);
    const width = Math.min(first, second);
    const length = Math.max(first, second);
    const quantity = Number(line?.quantity || 0);
    if (width < 900 || width > 1500 || length < 1800 || length > 6000 || quantity <= 0) return null;
    return (width * length * quantity) / 1_000_000;
  }

  function refinedRenderReview() {
    const payload = buildPayload();
    const details = [
      ["Order number", payload.reference],
      ["Required date", `${formatDate(payload.requiredDate)} · ${timeSlotLabel(payload.timeSlot)}`],
      ["Contact", payload.contact],
      ["Phone", payload.mobile],
      ["Address", formatAddressForDisplay(payload.deliveryAddress)],
      ["Delivery", deliveryTypeLabel(payload.deliveryType)],
      ["Extras", payload.extras.join(", ") || "None"],
      ["Instructions", payload.deliveryInstructions || "—"],
    ];
    const detailsRoot = document.getElementById("reviewDetails");
    detailsRoot.replaceChildren();
    details.forEach(([label, content]) => {
      const item = document.createElement("div");
      item.className = reviewFieldClass(label);
      item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(content || "—")}</strong>`;
      detailsRoot.append(item);
    });

    const linesRoot = document.getElementById("reviewOrderLines");
    linesRoot.replaceChildren();
    let lineCount = 0;
    let unitCount = 0;
    let totalBoardArea = 0;
    const areas = Array.isArray(state.deliveryAreas) && state.deliveryAreas.length
      ? state.deliveryAreas
      : [{ id: "ground", label: floorLabels.ground }, { id: "first", label: floorLabels.first }];

    areas.forEach((areaDefinition) => {
      const areaId = areaDefinition.id;
      const lines = getFloorLines(areaId);
      if (!lines.length) return;
      const group = document.createElement("section");
      group.className = "review-floor-group";
      const areaHeading = document.createElement("h3");
      areaHeading.className = "review-area-heading";
      areaHeading.textContent = areaDefinition.label || floorLabels[areaId] || areaId;
      group.append(areaHeading);
      const heading = document.createElement("div");
      heading.className = "review-column-heading";
      heading.innerHTML = "<span>SKU</span><span>Product</span><small>m²</small><small>Qty</small>";
      group.append(heading);
      lines.forEach((line) => {
        const area = boardArea(line);
        const row = document.createElement("div");
        row.className = "review-line review-line-metrics";
        row.innerHTML = `
          <span class="review-line-sku">${escapeHtml(line.sku || "—")}</span>
          <strong class="review-line-product">${escapeHtml(line.label)}</strong>
          <em>${area === null ? "" : area.toFixed(2)}</em>
          <b>${line.quantity}</b>
        `;
        group.append(row);
        lineCount += 1;
        unitCount += Number(line.quantity || 0);
        if (area !== null) totalBoardArea += area;
      });
      linesRoot.append(group);
    });

    document.getElementById("reviewLineTotal").innerHTML = `<span>Product lines</span><strong>${lineCount}</strong>`;
    document.getElementById("reviewUnitTotal").innerHTML = `
      <span class="review-footer-labels"><small>Total m²</small><small>Total Units</small></span>
      <strong class="review-footer-area-value">${totalBoardArea.toFixed(2)}</strong>
      <strong class="review-footer-units-value">${unitCount}</strong>
    `;
  }

  function enableEditablePostcode() {
    const postcode = document.getElementById("deliveryPostcode");
    if (!postcode) return false;
    postcode.readOnly = false;
    postcode.disabled = false;
    postcode.tabIndex = 0;
    postcode.inputMode = "numeric";
    postcode.maxLength = 4;
    postcode.pattern = "[0-9]{4}";
    postcode.autocomplete = "postal-code";
    if (postcode.dataset.editablePostcode !== "true") {
      postcode.dataset.editablePostcode = "true";
      postcode.addEventListener("input", () => {
        postcode.value = postcode.value.replace(/\D/g, "").slice(0, 4);
        postcode.setCustomValidity("");
        if (typeof syncStructuredAddress === "function") syncStructuredAddress();
        else if (typeof parseAndStoreManualAddress === "function") parseAndStoreManualAddress();
        if (typeof scheduleDraft === "function") scheduleDraft();
      });
    }
    return true;
  }

  function ensureEditablePostcode() {
    if (enableEditablePostcode()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (enableEditablePostcode() || attempts >= 50) window.clearInterval(timer);
    }, 100);
  }

  function loadStyles() {
    let link = document.querySelector('link[data-order-final="true"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.orderFinal = "true";
      document.head.append(link);
    }
    link.href = "/order-final.css?v=20260728-4";
  }

  function loadScriptOnce(src, marker) {
    return new Promise((resolve) => {
      const existing = document.querySelector(`script[data-${marker}="true"]`);
      if (existing) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset[marker.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", resolve, { once: true });
      document.body.append(script);
    });
  }

  async function loadRefinements() {
    loadStyles();
    await loadScriptOnce("/tab-controls.js?v=20260727-2", "tab-controls");
    await loadScriptOnce("/manager-hotfix.js?v=20260727-1", "manager-hotfix");
    await loadScriptOnce("/manager-refinement.js?v=20260727-3", "manager-refinement");
    ensureEditablePostcode();
  }

  window.renderReview = refinedRenderReview;
  try { renderReview = refinedRenderReview; } catch (_error) { }

  if (document.querySelector('script[data-manager-refinement="true"]')) {
    loadStyles();
    ensureEditablePostcode();
  } else {
    void loadRefinements();
  }
})();