(() => {
  function boardKeys() {
    const keys = new Set();
    const main = state.layout?.mainBoard;
    (main?.rows || []).forEach((row) => (row.cells || []).forEach((key) => key && keys.add(key)));
    (state.layout?.specialtyBoards || []).forEach((group) => (group.rows || []).forEach((row) => row.key && keys.add(row.key)));
    return keys;
  }

  function boardArea(line, keys) {
    if (!line.key || !keys.has(line.key)) return null;
    const label = String(line.label || '');
    const dimensionMatch = label.match(/\b(\d{3,4})\s*[×xX]\s*(\d{3,4})\b/);
    if (!dimensionMatch) return null;
    const width = Number(dimensionMatch[1]);
    const length = Number(dimensionMatch[2]);
    return width > 0 && length > 0 ? (width * length * Number(line.quantity || 0)) / 1_000_000 : null;
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

    const keys = boardKeys();
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
      const heading = document.createElement('h3');
      heading.className = 'review-column-heading';
      heading.innerHTML = `<span>${escapeHtml(areaDefinition.label || floorLabels[areaId] || areaId)}</span><small>m²</small><small>Qty</small>`;
      group.append(heading);
      lines.forEach((line) => {
        const area = boardArea(line, keys);
        const row = document.createElement('div');
        row.className = 'review-line review-line-metrics';
        row.innerHTML = `<div><strong>${escapeHtml(line.label)}</strong><span>${escapeHtml(line.sku || '')}</span></div><em>${area === null ? '' : `${area.toFixed(2)} m²`}</em><b>${line.quantity}</b>`;
        group.append(row);
        lineCount += 1;
        unitCount += Number(line.quantity || 0);
        if (area !== null) totalBoardArea += area;
      });
      linesRoot.append(group);
    });

    document.getElementById('reviewLineTotal').innerHTML = `<span>Product lines</span><strong>${lineCount}</strong>`;
    document.getElementById('reviewUnitTotal').innerHTML = `<span>Board area</span><strong>${totalBoardArea.toFixed(2)} m²</strong><span>Total units</span><strong>${unitCount}</strong>`;
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
      link.href = '/final-control-state.css?v=20260727-1';
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
      script.addEventListener('load', loadLateHotfixStyles, { once: true });
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
  }
})();