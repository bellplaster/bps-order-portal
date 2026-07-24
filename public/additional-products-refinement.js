(() => {
  const MAX_RESULTS = 100;
  let attempts = 0;

  function restructureFloor(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    const grid = root?.querySelector('.lower-catalogue-grid');
    const panel = root?.querySelector('.additional-products-panel');
    if (!root || !grid || !panel || grid.querySelector(':scope > .lower-catalogue-main')) return;

    const columns = [...grid.querySelectorAll(':scope > .lower-catalogue-column')];
    if (columns.length < 4) return;

    const main = document.createElement('div');
    main.className = 'lower-catalogue-main';
    const mainColumns = document.createElement('div');
    mainColumns.className = 'lower-catalogue-main-columns';
    columns.slice(0, 3).forEach((column) => mainColumns.append(column));
    main.append(mainColumns, panel);

    const rightColumn = columns[3];
    grid.replaceChildren(main, rightColumn);

    const heading = panel.querySelector('.additional-products-heading h3');
    if (heading) heading.textContent = 'Additional products';
    const input = panel.querySelector('.additional-search input');
    if (input) input.placeholder = 'Stock code, product name or size';
  }

  function restructureAll() {
    if (typeof state === 'undefined' || !Array.isArray(state.deliveryAreas)) return;
    state.deliveryAreas.forEach((area) => restructureFloor(area.id));
  }

  function patchRenderer() {
    const original = window.renderUnifiedFloorSheet;
    if (typeof original !== 'function' || original.__additionalProductsRefined) return;
    const patched = function renderUnifiedFloorSheetWithCompactSearch(floor, ...args) {
      const result = original.call(this, floor, ...args);
      restructureFloor(floor);
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
          header.innerHTML = '<span>SKU</span><span>Product description</span><span></span>';
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
    patchRenderer();
    patchSearch();
    restructureAll();
  }

  initialise();
  document.addEventListener('DOMContentLoaded', initialise);
  const timer = window.setInterval(() => {
    attempts += 1;
    initialise();
    if (attempts >= 50 || document.querySelector('.lower-catalogue-main')) window.clearInterval(timer);
  }, 100);
})();