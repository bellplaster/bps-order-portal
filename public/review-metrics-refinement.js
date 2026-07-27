(() => {
  function boardArea(line) {
    const label = String(line?.label || '');
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
      ['Order number', payload.reference],
      ['Required date', `${formatDate(payload.requiredDate)} · ${timeSlotLabel(payload.timeSlot)}`],
      ['Contact', payload.contact],
      ['Phone', payload.mobile],
      ['Address', formatAddressForDisplay(payload.deliveryAddress)],
      ['Delivery', deliveryTypeLabel(payload.deliveryType)],
      ['Extras', payload.extras.join(', ') || 'None'],
      ['Instructions', payload.deliveryInstructions || '—'],
    ];

    const detailsRoot = document.getElementById('reviewDetails');
    detailsRoot.replaceChildren();
    details.forEach(([label, content]) => {
      const item = document.createElement('div');
      item.className = reviewFieldClass(label);
      item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(content || '—')}</strong>`;
      detailsRoot.append(item);
    });

    const linesRoot = document.getElementById('reviewOrderLines');
    linesRoot.replaceChildren();
    let lineCount = 0;
    let unitCount = 0;
    let totalBoardArea = 0;
    const areas = Array.isArray(state.deliveryAreas) && state.deliveryAreas.length
      ? state.deliveryAreas
      : [{ id: 'ground', label: floorLabels.ground }, { id: 'first', label: floorLabels.first }];

    areas.forEach((areaDefinition) => {
      const areaId = areaDefinition.id;
      const lines = getFloorLines(areaId);
      if (!lines.length) return;

      const group = document.createElement('section');
      group.className = 'review-floor-group';

      const areaHeading = document.createElement('h3');
      areaHeading.className = 'review-area-heading';
      areaHeading.textContent = areaDefinition.label || floorLabels[areaId] || areaId;
      group.append(areaHeading);

      const heading = document.createElement('div');
      heading.className = 'review-column-heading';
      heading.innerHTML = '<span>SKU</span><span>Product</span><small>m²</small><small>Qty</small>';
      group.append(heading);

      lines.forEach((line) => {
        const area = boardArea(line);
        const row = document.createElement('div');
        row.className = 'review-line review-line-metrics';
        row.innerHTML = `
          <span class="review-line-sku">${escapeHtml(line.sku || '—')}</span>
          <strong class="review-line-product">${escapeHtml(line.label)}</strong>
          <em>${area === null ? '' : `${area.toFixed(2)} m²`}</em>
          <b>${line.quantity}</b>
        `;
        group.append(row);
        lineCount += 1;
        unitCount += Number(line.quantity || 0);
        if (area !== null) totalBoardArea += area;
      });
      linesRoot.append(group);
    });

    document.getElementById('reviewLineTotal').innerHTML = `<span>Product lines</span><strong>${lineCount}</strong>`;
    document.getElementById('reviewUnitTotal').innerHTML = `
      <span class="review-footer-metric review-footer-area"><small>Board area</small><strong>${totalBoardArea.toFixed(2)} m²</strong></span>
      <span class="review-footer-metric review-footer-units"><small>Total units</small><strong>${unitCount}</strong></span>
    `;
  }

  function enableEditablePostcode() {
    const postcode = document.getElementById('deliveryPostcode');
    if (!postcode) return false;

    postcode.readOnly = false;
    postcode.disabled = false;
    postcode.tabIndex = 0;
    postcode.inputMode = 'numeric';
    postcode.maxLength = 4;
    postcode.pattern = '[0-9]{4}';
    postcode.autocomplete = 'postal-code';

    if (postcode.dataset.editablePostcode !== 'true') {
      postcode.dataset.editablePostcode = 'true';
      postcode.addEventListener('input', () => {
        postcode.value = postcode.value.replace(/\D/g, '').slice(0, 4);
        postcode.setCustomValidity('');
        if (typeof syncStructuredAddress === 'function') syncStructuredAddress();
        else if (typeof parseAndStoreManualAddress === 'function') parseAndStoreManualAddress();
        if (typeof scheduleDraft === 'function') scheduleDraft();
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

  window.renderReview = refinedRenderReview;
  try { renderReview = refinedRenderReview; } catch (_error) { }

  if (!document.querySelector('script[data-manager-refinement="true"]')) {
    const loadFinalControlStyles = () => {
      let link = document.querySelector('link[data-final-control-state="true"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.finalControlState = 'true';
        document.head.append(link);
      }
      link.href = '/final-control-state.css?v=20260728-1';

      let reviewLink = document.querySelector('link[data-review-table-final="true"]');
      if (!reviewLink) {
        reviewLink = document.createElement('link');
        reviewLink.rel = 'stylesheet';
        reviewLink.dataset.reviewTableFinal = 'true';
        document.head.append(reviewLink);
      }
      reviewLink.href = '/review-table-final.css?v=20260728-1';
    };

    const loadLateHotfixStyles = () => {
      let link = document.querySelector('link[data-manager-hotfix-late="true"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.managerHotfixLate = 'true';
        document.head.append(link);
      }
      link.href = '/manager-hotfix.css?v=20260727-2';
      link.addEventListener('load', loadFinalControlStyles, { once: true });
      link.addEventListener('error', loadFinalControlStyles, { once: true });
    };

    const loadManagerRefinement = () => {
      const script = document.createElement('script');
      script.src = '/manager-refinement.js?v=20260727-3';
      script.async = false;
      script.dataset.managerRefinement = 'true';
      script.addEventListener('load', () => {
        ensureEditablePostcode();
        loadLateHotfixStyles();
      }, { once: true });
      script.addEventListener('error', loadLateHotfixStyles, { once: true });
      document.body.append(script);
    };

    const loadManagerHotfix = () => {
      if (document.querySelector('script[data-manager-hotfix="true"]')) {
        loadManagerRefinement();
        return;
      }
      const hotfix = document.createElement('script');
      hotfix.src = '/manager-hotfix.js?v=20260727-1';
      hotfix.async = false;
      hotfix.dataset.managerHotfix = 'true';
      hotfix.addEventListener('load', loadManagerRefinement, { once: true });
      hotfix.addEventListener('error', loadManagerRefinement, { once: true });
      document.body.append(hotfix);
    };

    const existingTabController = document.querySelector('script[data-tab-controls="true"]');
    if (existingTabController) {
      loadManagerHotfix();
    } else {
      const tabController = document.createElement('script');
      tabController.src = '/tab-controls.js?v=20260727-2';
      tabController.async = false;
      tabController.dataset.tabControls = 'true';
      tabController.addEventListener('load', loadManagerHotfix, { once: true });
      tabController.addEventListener('error', loadManagerHotfix, { once: true });
      document.body.append(tabController);
    }
  } else {
    ensureEditablePostcode();
  }
})();