(() => {
  const MAX_RESULTS = 100;
  const DEFAULT_TAB = { id: 'tab-1', label: 'Tab 1' };
  let attempts = 0;
  let defaultTabInitialised = false;

  function setDefaultTabState() {
    state.deliveryAreas = [{ ...DEFAULT_TAB }];
    state.activeFloor = DEFAULT_TAB.id;
    state.quantities = { [DEFAULT_TAB.id]: new Map() };
    state.otherMaterials = { [DEFAULT_TAB.id]: [] };
    Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
    floorLabels[DEFAULT_TAB.id] = DEFAULT_TAB.label;
  }

  function initialiseDefaultTab() {
    if (defaultTabInitialised || typeof state === 'undefined') return;
    defaultTabInitialised = true;
    setDefaultTabState();
  }

  function patchResetOrder() {
    const original = window.resetOrder;
    if (typeof original !== 'function' || original.__tabOneDefault) return;
    const patched = function resetOrderWithTabOne(...args) {
      const result = original.apply(this, args);
      if (typeof applyPayload === 'function') {
        applyPayload({
          reference: '',
          contact: state.account?.defaultContactName || '',
          mobile: state.account?.defaultMobile || '',
          requiredDate: '',
          deliveryAddress: '',
          addressLine1: '',
          addressLine2: '',
          deliveryInstructions: '',
          timeSlot: 'ANY',
          deliveryType: '',
          extras: [],
          activeArea: DEFAULT_TAB.id,
          floors: {
            [DEFAULT_TAB.id]: {
              label: DEFAULT_TAB.label,
              items: [],
              otherMaterials: [],
            },
          },
        });
      } else {
        setDefaultTabState();
      }
      return result;
    };
    patched.__tabOneDefault = true;
    window.resetOrder = patched;
    try { resetOrder = patched; } catch (_error) { }
  }

  function refinePanelLabels(panel) {
    const selectedHeader = panel?.querySelector('.selected-additional-header');
    if (selectedHeader) {
      const labels = selectedHeader.querySelectorAll(':scope > span');
      if (labels[0]) labels[0].textContent = 'SKU';
      if (labels[1]) labels[1].textContent = 'Product';
      if (labels[2]) labels[2].textContent = 'Qty';
    }
  }

  function markBoardProductBoundaries(root) {
    const table = root?.querySelector('.unified-board-table');
    if (!table) return;

    table.querySelectorAll('.board-group-end').forEach((cell) => cell.classList.remove('board-group-end'));
    const productHeadings = [...table.querySelectorAll('thead tr:first-child .board-product-heading')];
    if (!productHeadings.length) return;

    const groupEnds = [];
    let columnTotal = 0;
    productHeadings.forEach((heading) => {
      columnTotal += Number(heading.colSpan || 1);
      groupEnds.push(columnTotal);
      heading.classList.add('board-group-end');
    });

    const markSpanningRow = (row) => {
      if (!row) return;
      let position = 0;
      [...row.cells].slice(1).forEach((cell) => {
        position += Number(cell.colSpan || 1);
        if (groupEnds.includes(position)) cell.classList.add('board-group-end');
      });
    };

    const headerRows = table.tHead?.rows || [];
    markSpanningRow(headerRows[1]);
    markSpanningRow(headerRows[2]);
    [...(table.tBodies?.[0]?.rows || [])].forEach(markSpanningRow);
  }

  function placeAdditionalProducts(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    if (!root) return;

    const grid = root.querySelector('.lower-catalogue-grid');
    const panel = root.querySelector('.additional-products-panel');
    markBoardProductBoundaries(root);
    if (!grid || !panel) return;

    refinePanelLabels(panel);
    panel.classList.add('additional-products-separated');

    if (grid.nextElementSibling !== panel) {
      grid.insertAdjacentElement('afterend', panel);
    }

    const heading = panel.querySelector('.additional-products-heading h3');
    if (heading) heading.textContent = 'Additional products';
    const input = panel.querySelector('.additional-search input');
    if (input) input.placeholder = 'Stock code, product name or size';
  }

  function placeAllAdditionalProducts() {
    if (typeof state === 'undefined' || !Array.isArray(state.deliveryAreas)) return;
    state.deliveryAreas.forEach((area) => placeAdditionalProducts(area.id));
  }

  function patchRenderer() {
    const original = window.renderUnifiedFloorSheet;
    if (typeof original !== 'function' || original.__additionalProductsRefined) return;
    const patched = function renderUnifiedFloorSheetWithSeparatedSearch(floor, ...args) {
      const result = original.call(this, floor, ...args);
      placeAdditionalProducts(floor);
      return result;
    };
    patched.__additionalProductsRefined = true;
    window.renderUnifiedFloorSheet = patched;
    try { renderUnifiedFloorSheet = patched; } catch (_error) { }
  }

  async function refinedSearchAdditionalProducts(floor, query) {
    clearTimeout(state.searchTimer);
    const results = document.querySelector(`[data-additional-results="${floor}"]`);
    if (!results) return;
    if (query.trim().length < 2) {
      results.hidden = true;
      results.replaceChildren();
      return;
    }

    state.searchTimer = setTimeout(async () => {
      try {
        const response = await fetchJson(`/api/products?q=${encodeURIComponent(query.trim())}`);
        const products = (response.products || []).slice(0, MAX_RESULTS);
        results.replaceChildren();
        if (!products.length) {
          results.innerHTML = '<p class="empty-state">No matching active products.</p>';
        } else {
          const header = document.createElement('div');
          header.className = 'additional-result-header';
          header.innerHTML = '<span>SKU</span><span>Product</span><span></span>';
          results.append(header);
          products.forEach((product) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'additional-result-row';
            row.innerHTML = `<strong>${escapeHtml(product.sku)}</strong><span>${escapeHtml(product.description)}</span><em>Add</em>`;
            row.addEventListener('click', () => addAdditionalProduct(floor, product));
            results.append(row);
          });
        }
        results.hidden = false;
      } catch (error) {
        results.innerHTML = `<p class="empty-state">${escapeHtml(error.message || String(error))}</p>`;
        results.hidden = false;
      }
    }, 220);
  }

  function patchSearch() {
    window.searchAdditionalProducts = refinedSearchAdditionalProducts;
    try { searchAdditionalProducts = refinedSearchAdditionalProducts; } catch (_error) { }
  }

  function initialise() {
    initialiseDefaultTab();
    patchResetOrder();
    patchRenderer();
    patchSearch();
    placeAllAdditionalProducts();
  }

  initialise();
  document.addEventListener('DOMContentLoaded', initialise);
  const timer = window.setInterval(() => {
    attempts += 1;
    initialise();
    if (attempts >= 50 || document.querySelector('.additional-products-separated')) window.clearInterval(timer);
  }, 100);
})();