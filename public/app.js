const state = {
  catalog: {},
  layout: null,
  isSubmitting: false,
  editingOrder: null,
  activeFloor: "ground",
  draftSaveTimer: null,
  isRestoringDraft: false,
  suppressDraftUntilInput: false,
  productDirectory: [],
  productDirectoryLoaded: false,
  otherMaterials: { ground: [], first: [] },
  activeStep: "details",
  activeCategory: "boards",
};

const DRAFT_STORAGE_KEY = "bps-knauf-order-form-draft-v7";
const DRAFT_VERSION = 7;
const floorLabels = { ground: "Ground Floor", first: "1st Floor" };

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindTabs();
  bindSubmission();
  bindLogout();
  bindDraftPersistence();
  bindOrderDetailInteractions();
  bindKioskNavigation();
  bindCategoryNavigation();
  bindGlobalProductSearch();
  bindHistoryDrawer();
  bindCurrentOrderActions();

  document.getElementById("refreshHistoryButton").addEventListener("click", loadOrderHistory);
  document.getElementById("cancelEditButton").addEventListener("click", cancelEdit);
  document.getElementById("orderDate").value = todayLocal();

  await loadCatalog();
  await loadProductDirectory();
  restoreDraft();
  updateAllFloorCounts();
  activateCategory(state.activeCategory, { silent: true });
  setActiveStep(state.activeStep, { skipValidation: true, silent: true });
  renderCurrentOrder();
  await loadOrderHistory();
}

function bindTabs() {
  document.querySelectorAll("[data-floor-tab]").forEach((button) => {
    button.addEventListener("click", () => activateFloorTab(button.dataset.floorTab));
  });
}

function activateFloorTab(floor) {
  document.querySelectorAll("[data-floor-tab]").forEach((tab) => {
    const active = tab.dataset.floorTab === floor;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-floor-panel]").forEach((panel) => {
    const active = panel.dataset.floorPanel === floor;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  state.activeFloor = floor;

  const workspaceFloorLabel = document.getElementById("workspaceFloorLabel");
  if (workspaceFloorLabel) {
    workspaceFloorLabel.textContent = floorLabels[floor];
  }

  const search = document.getElementById("globalProductSearch");
  if (search) {
    search.setAttribute(
      "aria-label",
      `Search products to add to ${floorLabels[floor]}`,
    );
  }

  activateCategory(state.activeCategory, { silent: true });
  renderCurrentOrder();

  if (!state.isRestoringDraft) scheduleDraftSave();
}

function bindSubmission() {
  document.getElementById("orderForm").addEventListener("submit", submitOrder);
}

function bindLogout() {
  document.getElementById("logoutButton").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    window.location.replace("/signin/");
  });
}

function bindOrderDetailInteractions() {
  document.querySelectorAll(
    "#orderForm input:not(.quantity-input), #orderForm textarea, #orderForm input[type=radio], #orderForm input[type=checkbox]",
  ).forEach((field) => {
    if (["logoutButton", "submitButton", "cancelEditButton", "globalProductSearch"].includes(field.id)) return;
    field.addEventListener("input", markDraftChanged);
    field.addEventListener("change", markDraftChanged);
  });

  document.querySelectorAll('input[name="deliveryType"]').forEach((field) => {
    field.addEventListener("change", updatePickupAddressRequirement);
  });
}

function updatePickupAddressRequirement() {
  const isPickup = selectedRadioValue("deliveryType") === "Pickup (Customer to collect)";
  const address = document.getElementById("deliveryAddress");
  address.required = !isPickup;
  address.closest("label")?.classList.toggle("is-optional", isPickup);
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog", { headers: { Accept: "application/json" } });
    if (response.status === 401) { window.location.replace("/signin/"); return; }
    const result = await response.json().catch(() => ({ ok: false, error: "The order form service returned an unreadable response." }));
    if (!response.ok || !result.ok) throw new Error(result.error || result.message || "The order form could not be loaded.");
    state.catalog = result.products || {};
    state.layout = result.layout || null;
    if (!state.layout) throw new Error("The product layout is missing.");
    renderFloorSheet("ground");
    renderFloorSheet("first");
  } catch (error) {
    showMessage(`The order form could not be loaded. ${error.message || String(error)}`, "error");
  }
}


async function loadProductDirectory() {
  try {
    const response = await fetch("/api/products", {
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      window.location.replace("/signin/");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The product catalogue returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "The Accrivia product catalogue could not be loaded.");
    }

    state.productDirectory = (result.products || []).map((product) => ({
      ...product,
      skuSearch: compactSearch(product.sku),
      descriptionSearch: normaliseSearch(product.description),
      compactSearch: compactSearch(`${product.sku} ${product.description}`),
      searchTokens: normaliseSearch(`${product.sku} ${product.description}`).split(" ").filter(Boolean),
    }));
    state.productDirectoryLoaded = true;

    const globalSearch = document.getElementById("globalProductSearch");
    if (globalSearch) {
      globalSearch.disabled = false;
      globalSearch.placeholder = "Search stock code, product or size";
    }

    document.querySelectorAll("[data-product-search]").forEach((input) => {
      input.disabled = false;
      input.placeholder = "Search stock code or product description";
    });
  } catch (error) {
    state.productDirectoryLoaded = false;
    const globalSearch = document.getElementById("globalProductSearch");
    if (globalSearch) {
      globalSearch.disabled = true;
      globalSearch.placeholder = "Product catalogue unavailable";
    }

    document.querySelectorAll("[data-product-search]").forEach((input) => {
      input.disabled = true;
      input.placeholder = "Product catalogue unavailable";
    });
    showMessage(error.message || String(error), "error");
  }
}

function renderFloorSheet(floor) {
  const container = document.getElementById(`${floor}OrderSheet`);
  container.replaceChildren();

  const definitions = [
    {
      id: "boards",
      nodes: [
        renderMainBoardMatrix(floor, state.layout.mainBoard),
        renderSpecialtyBoards(floor, state.layout.specialtyBoards),
      ],
    },
    {
      id: "cornice",
      nodes: [
        renderSection(floor, state.layout.sections.cove),
        renderSection(floor, state.layout.sections.decorative),
      ],
    },
    {
      id: "compounds",
      nodes: [
        renderSection(floor, state.layout.sections.compounds),
      ],
    },
    {
      id: "partiwall",
      nodes: [
        renderSection(floor, state.layout.sections.partiwall),
        renderSection(floor, state.layout.sections.partiwall_accessories),
        renderSection(floor, state.layout.sections.partiwall_screws),
      ],
    },
    {
      id: "fixings",
      nodes: [
        renderSection(floor, state.layout.sections.screws),
        renderSection(floor, state.layout.sections.nails),
      ],
    },
    {
      id: "ceilings",
      nodes: [
        renderSection(floor, state.layout.sections.usg_tiles),
        renderSection(floor, state.layout.sections.knauf_tiles),
      ],
    },
    {
      id: "villaboard",
      nodes: [
        renderSection(floor, state.layout.sections.villaboard),
      ],
    },
    {
      id: "insulation",
      nodes: [
        renderSection(floor, state.layout.sections.insulation),
      ],
    },
    {
      id: "rondo",
      nodes: [
        renderSection(floor, state.layout.sections.rondo),
      ],
    },
    {
      id: "all_products",
      nodes: [
        renderSection(floor, state.layout.sections.other_materials),
      ],
    },
  ];

  definitions.forEach((definition) => {
    const panel = document.createElement("div");
    panel.className = "category-panel";
    panel.dataset.categoryPanel = definition.id;
    panel.hidden = definition.id !== state.activeCategory;

    const content = document.createElement("div");
    content.className =
      definition.id === "boards"
        ? "category-content category-content-boards"
        : "category-content";

    definition.nodes.filter(Boolean).forEach((node) => content.append(node));
    panel.append(content);
    container.append(panel);
  });
}

function renderMainBoardMatrix(floor, matrix) {
  const section = createSectionShell("main-board-section", matrix.title);
  const scroller = document.createElement("div");
  scroller.className = "table-scroller";
  const table = document.createElement("table");
  table.className = "product-table main-board-table";
  const thead = document.createElement("thead");

  const groupRow = document.createElement("tr");
  const lengthTitle = document.createElement("th");
  lengthTitle.className = "sticky-left";
  lengthTitle.textContent = "Length";
  groupRow.append(lengthTitle);

  const mergedGroups = [];
  matrix.groups.forEach((group) => {
    const previous = mergedGroups[mergedGroups.length - 1];
    if (previous && previous.group === group.group) {
      previous.span += group.span;
    } else {
      mergedGroups.push({
        group: group.group,
        span: group.span,
      });
    }
  });

  mergedGroups.forEach((group) => {
    const th = document.createElement("th");
    th.colSpan = group.span;
    th.textContent = group.group;
    groupRow.append(th);
  });

  const thicknessRow = document.createElement("tr");
  const thicknessCorner = document.createElement("th");
  thicknessCorner.className = "sticky-left";
  thicknessCorner.textContent = "";
  thicknessRow.append(thicknessCorner);

  matrix.groups.forEach((group) => {
    const th = document.createElement("th");
    th.colSpan = group.span;
    th.textContent = group.subgroup;
    thicknessRow.append(th);
  });

  const widthRow = document.createElement("tr");
  const mm = document.createElement("th");
  mm.className = "sticky-left unit-heading";
  mm.textContent = "mm";
  widthRow.append(mm);
  matrix.columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.variant;
    widthRow.append(th);
  });
  thead.append(groupRow, thicknessRow, widthRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  matrix.rows.forEach((row) => {
    const tr = document.createElement("tr");
    const label = document.createElement("th");
    label.className = "sticky-left row-label";
    label.textContent = row.length;
    tr.append(label);
    row.cells.forEach((key) => tr.append(createQuantityCell(floor, key)));
    tbody.append(tr);
  });
  table.append(tbody);
  scroller.append(table);
  section.body.append(scroller);
  return section.root;
}

function renderSpecialtyBoards(floor, groups) {
  const wrap = document.createElement("div");
  wrap.className = "specialty-stack";
  groups.forEach((group) => {
    const section = createSectionShell("specialty-section", group.title);
    group.rows.forEach((row) => {
      const line = document.createElement("div");
      line.className = "specialty-row";
      const label = document.createElement("div");
      label.innerHTML = `<strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.detail)}</span>`;
      line.append(label, createStandaloneQuantity(floor, row.key));
      section.body.append(line);
    });
    wrap.append(section.root);
  });
  return wrap;
}

function renderSection(floor, def) {
  if (def.type === "matrix") return renderMatrixSection(floor, def);
  if (def.type === "list") return renderListSection(floor, def);
  if (def.type === "insulation") return renderInsulationSection(floor, def);
  if (def.type === "otherMaterials") return renderOtherMaterialsSection(floor, def);
  return document.createElement("div");
}

function renderMatrixSection(floor, def) {
  const section = createSectionShell("compact-section", def.title);
  const scroller = document.createElement("div");
  scroller.className = "table-scroller";
  const table = document.createElement("table");
  table.className = "product-table compact-table";
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const first = document.createElement("th"); first.textContent = def.rowHeader || "Product"; trh.append(first);
  def.columns.forEach((column) => { const th=document.createElement("th"); th.textContent=column; trh.append(th); });
  thead.append(trh); table.append(thead);
  const tbody=document.createElement("tbody");
  def.rows.forEach((row) => {
    const tr=document.createElement("tr");
    const th=document.createElement("th");
    const s=document.createElement("span"); s.textContent=row.label; th.append(s);
    if (row.detail) { const small=document.createElement("small"); small.textContent=row.detail; th.append(small); }
    tr.append(th);
    row.cells.forEach((key)=>tr.append(createQuantityCell(floor,key)));
    tbody.append(tr);
  });
  table.append(tbody); scroller.append(table); section.body.append(scroller); return section.root;
}

function renderListSection(floor, def) {
  const section=createSectionShell("compact-section",def.title);
  def.rows.forEach((row)=>{
    const line=document.createElement("div"); line.className="list-product-row";
    const label=document.createElement("div");
    const strong=document.createElement("strong"); strong.textContent=row.label; label.append(strong);
    if(row.detail){const span=document.createElement("span");span.textContent=row.detail;label.append(span);}
    line.append(label,createStandaloneQuantity(floor,row.key)); section.body.append(line);
  });
  return section.root;
}

function renderInsulationSection(floor, def) {
  const section=createSectionShell("compact-section","KNAUF INSULATION");
  const thermal={id:"thermal",type:"matrix",title:"Thermal Batt",rowHeader:"Rating",columns:["430 mm","580 mm"],rows:def.thermalRows};
  const thermalWrap=renderMatrixSection(floor,thermal); thermalWrap.classList.add("nested-section"); section.body.append(thermalWrap);
  const format=document.createElement("fieldset"); format.className="acoustic-format"; format.innerHTML=`<legend>Acoustic format</legend><label><input type="radio" name="${floor}AcousticFormat" value="Roll" checked><span>Roll</span></label><label><input type="radio" name="${floor}AcousticFormat" value="Batt"><span>Batt</span></label>`;
  format.querySelectorAll("input").forEach((input)=>input.addEventListener("change",markDraftChanged)); section.body.append(format);
  const acoustic={id:"acoustic",type:"matrix",title:"Acoustic",rowHeader:"kg / mm",columns:["430 mm","580 mm"],rows:def.acousticRows};
  const acousticWrap=renderMatrixSection(floor,acoustic); acousticWrap.classList.add("nested-section"); section.body.append(acousticWrap);
  return section.root;
}

function renderOtherMaterialsSection(floor, def) {
  const section = createSectionShell(
    "compact-section other-materials-section searchable-materials-section",
    "PRODUCTS ADDED FROM SEARCH",
  );

  const intro = document.createElement("p");
  intro.className = "other-materials-intro";
  intro.textContent =
    `Use the search bar above to add any Accrivia product to ${floorLabels[floor]}.`;

  const selected = document.createElement("div");
  selected.className = "selected-materials";
  selected.dataset.selectedMaterials = floor;

  section.body.append(intro, selected);
  renderSelectedOtherMaterials(floor);
  return section.root;
}

function renderProductSearchResults(floor, query, search, results) {
  const matches = findProductMatches(query).slice(0, 10);
  results.replaceChildren();
  search._catalogueMatches = matches;
  search._catalogueIndex = matches.length ? 0 : -1;

  if (!query.trim()) {
    results.hidden = true;
    return;
  }

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "catalogue-no-results";
    empty.textContent = "No matching Accrivia product.";
    results.append(empty);
    results.hidden = false;
    return;
  }

  matches.forEach((product, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catalogue-result";
    button.classList.toggle("is-active", index === 0);
    button.dataset.resultIndex = String(index);

    const sku = document.createElement("strong");
    sku.textContent = product.sku;
    const description = document.createElement("span");
    description.textContent = product.description;

    const addLabel = document.createElement("em");
    addLabel.textContent = "Add";

    button.append(sku, description, addLabel);

    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => addOtherMaterial(floor, product, search, results));
    results.append(button);
  });

  results.hidden = false;
}

function handleProductSearchKeydown(event, floor, search, results) {
  const matches = search._catalogueMatches || [];
  if (!matches.length) {
    if (event.key === "Escape") results.hidden = true;
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    search._catalogueIndex = Math.max(0, Math.min(matches.length - 1, (search._catalogueIndex ?? 0) + direction));
    updateActiveCatalogueResult(results, search._catalogueIndex);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    addOtherMaterial(floor, matches[search._catalogueIndex ?? 0], search, results);
    return;
  }

  if (event.key === "Escape") {
    results.hidden = true;
  }
}

function updateActiveCatalogueResult(results, activeIndex) {
  results.querySelectorAll(".catalogue-result").forEach((button, index) => {
    button.classList.toggle("is-active", index === activeIndex);
  });
}

function addOtherMaterial(floor, product, search, results) {
  if (!product) return;
  const existing = state.otherMaterials[floor].find((item) => item.sku.toUpperCase() === product.sku.toUpperCase());

  if (existing) {
    const field = document.querySelector(`[data-other-material-sku="${floor}:${cssEscape(product.sku)}"]`);
    field?.focus();
    field?.select();
  } else {
    if (state.otherMaterials[floor].length >= 100) {
      showMessage(`${floorLabels[floor]} can contain no more than 100 Other Materials lines.`, "error");
      return;
    }

    state.otherMaterials[floor].push({
      sku: product.sku,
      description: product.description,
      quantity: 1,
    });
    renderSelectedOtherMaterials(floor);
    updateFloorCount(floor);
    markDraftChanged();

    requestAnimationFrame(() => {
      const field = document.querySelector(`[data-other-material-sku="${floor}:${cssEscape(product.sku)}"]`);
      field?.focus();
      field?.select();
    });
  }

  search.value = "";
  results.hidden = true;
  search._catalogueMatches = [];

  activateCategory("all_products");
  renderCurrentOrder();
}

function renderSelectedOtherMaterials(floor) {
  const container = document.querySelector(`[data-selected-materials="${floor}"]`);
  if (!container) return;
  container.replaceChildren();

  const items = state.otherMaterials[floor];
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "selected-materials-empty";
    empty.textContent = "No additional products added.";
    container.append(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "selected-materials-header";
  header.innerHTML = "<span>Stock code</span><span>Description</span><span>Qty</span><span></span>";
  container.append(header);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "selected-material-row";

    const sku = document.createElement("strong");
    sku.textContent = item.sku;
    const description = document.createElement("span");
    description.className = "selected-material-description";
    description.textContent = item.description;

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = "999";
    quantity.step = "1";
    quantity.value = String(item.quantity || 1);
    quantity.className = "other-material-quantity";
    quantity.dataset.otherMaterialSku = `${floor}:${item.sku}`;
    quantity.setAttribute("aria-label", `${item.sku} quantity`);
    quantity.addEventListener("focus", () => quantity.select());
    quantity.addEventListener("input", () => {
      normaliseQuantityField(quantity);
      item.quantity = Number(quantity.value || 0);
      updateFloorCount(floor);
      renderCurrentOrder();
      markDraftChanged();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-material-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.otherMaterials[floor] = state.otherMaterials[floor].filter((candidate) => candidate.sku !== item.sku);
      renderSelectedOtherMaterials(floor);
      updateFloorCount(floor);
      renderCurrentOrder();
      markDraftChanged();
    });

    row.append(sku, description, quantity, remove);
    container.append(row);
  });
}

function findProductMatches(query) {
  const normalised = normaliseSearch(query);
  const compact = compactSearch(query);
  if (!normalised || !compact) return [];
  const queryTokens = normalised.split(" ").filter(Boolean);

  return state.productDirectory
    .map((product) => ({ product, score: scoreProduct(product, normalised, compact, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.sku.localeCompare(b.product.sku))
    .map((entry) => entry.product);
}

function scoreProduct(product, normalised, compact, queryTokens) {
  if (product.skuSearch === compact) return 10000;
  if (product.skuSearch.startsWith(compact)) return 9000 - product.skuSearch.length;
  if (product.compactSearch === compact) return 8500;
  if (product.compactSearch.startsWith(compact)) return 8000 - product.compactSearch.length / 10;
  if (product.skuSearch.includes(compact)) return 7600;
  if (product.compactSearch.includes(compact)) return 7000 - product.compactSearch.indexOf(compact);

  const exactTokens = queryTokens.every((token) => product.descriptionSearch.includes(token) || product.skuSearch.includes(token));
  if (exactTokens) return 6000 + queryTokens.length * 100;

  const fuzzyTokens = queryTokens.every((token) => product.searchTokens.some((candidate) => tokenMatches(token, candidate)));
  if (fuzzyTokens) return 4000 + queryTokens.length * 50;
  return 0;
}

function tokenMatches(queryToken, candidate) {
  if (candidate.includes(queryToken) || queryToken.includes(candidate)) return true;
  const allowance = queryToken.length >= 9 ? 2 : queryToken.length >= 5 ? 1 : 0;
  return allowance > 0 && levenshteinDistance(queryToken, candidate, allowance) <= allowance;
}

function levenshteinDistance(left, right, maximum) {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMinimum = i;
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }
  return previous[right.length];
}

function normaliseSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearch(value) {
  return normaliseSearch(value).replace(/\s+/g, "");
}

function createSectionShell(className,title){const root=document.createElement("section");root.className=`product-section ${className}`;const heading=document.createElement("h3");heading.textContent=title;const body=document.createElement("div");body.className="product-section-body";root.append(heading,body);return{root,body};}

function createQuantityCell(floor,key){const td=document.createElement("td");if(!key){td.className="unavailable-cell";return td;}td.className="quantity-cell";td.append(createQuantityInput(floor,key));return td;}
function createStandaloneQuantity(floor,key){const wrap=document.createElement("div");wrap.className="standalone-quantity";wrap.append(createQuantityInput(floor,key));return wrap;}
function createQuantityInput(floor,key){
  const product=state.catalog[key]; const input=document.createElement("input");input.className="quantity-input";input.type="number";input.min="0";input.max="999";input.step="1";input.inputMode="numeric";input.autocomplete="off";input.placeholder="0";input.dataset.productKey=key;input.dataset.floor=floor;input.title=product?.label||key;input.setAttribute("aria-label",`${product?.label||key} quantity for ${floorLabels[floor]}`);
  input.addEventListener("input",()=>{
    normaliseQuantityField(input);
    updateQuantityAppearance(input);
    updateFloorCount(floor);
    renderCurrentOrder();
    markDraftChanged();
  });
  input.addEventListener("focus",()=>input.select());
  input.addEventListener("keydown",(event)=>{if(event.key!=="Enter")return;event.preventDefault();focusNextQuantityField(floor,input,event.shiftKey?-1:1);});
  return input;
}

function normaliseQuantityField(field){if(field.value==="")return;const q=Number(field.value);if(!Number.isFinite(q)||q<0){field.value="";return;}field.value=String(Math.min(999,Math.floor(q)));}
function getFloorItems(floor){return Array.from(document.querySelectorAll(`.quantity-input[data-floor="${floor}"]`)).map((f)=>({key:f.dataset.productKey,quantity:Number(f.value||0)})).filter((i)=>Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=999);}
function getOtherMaterials(floor) {
  return state.otherMaterials[floor]
    .map((item) => ({
      sku: item.sku,
      description: item.description,
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.sku && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 999);
}
function updateFloorCount(floor) {
  const standard = getFloorItems(floor).length;
  const other = getOtherMaterials(floor).length;
  document.getElementById(`${floor}TabCount`).textContent = String(standard + other);
  updateCategoryBadges();
}
function updateAllFloorCounts(){updateFloorCount("ground");updateFloorCount("first");}

function getOrderDetails(){return{
  orderDate:document.getElementById("orderDate").value,
  reference:document.getElementById("accountReference").value.trim(),
  customer:document.getElementById("customerName").value.trim(),
  contact:document.getElementById("contactName").value.trim(),
  mobile:document.getElementById("contactMobile").value.trim(),
  deliveryAddress:document.getElementById("deliveryAddress").value.trim(),
  deliveryInstructions:document.getElementById("deliveryInstructions").value.trim(),
  requiredDate:document.getElementById("requiredDate").value,
  requiredTime:document.getElementById("requiredTime").value,
  timeSlot:selectedRadioValue("timeSlot"),
  deliveryType:selectedRadioValue("deliveryType"),
  extras:Array.from(document.querySelectorAll('input[name="deliveryExtra"]:checked')).map((f)=>f.value),
};}
function selectedRadioValue(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||"";}

async function submitOrder(event){
  event.preventDefault();if(state.isSubmitting)return;clearMessage();document.getElementById("successPanel").hidden=true;
  try{validateOrder();const payload=buildPayload();const editing=Boolean(state.editingOrder);const endpoint=editing?`/api/orders/${encodeURIComponent(state.editingOrder.submissionId)}`:"/api/submit";state.isSubmitting=true;const button=document.getElementById("submitButton");button.disabled=true;button.textContent=editing?"Saving changes…":"Generating files…";showMessage(editing?`Generating an updated revision for ${state.editingOrder.orderNumber}…`:"Generating order files…","info");
    const response=await fetch(endpoint,{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)});if(response.status===401){window.location.replace("/signin/");return;}const result=await response.json().catch(()=>({ok:false,error:"The submission service returned an unreadable response."}));if(!response.ok||!result.ok){const stage=result.diagnostic?.lastStage?.stage;const parts=[result.error||"The order could not be generated."];if(stage)parts.push(`Failed stage: ${stage}.`);if(result.requestId)parts.push(`Request ID: ${result.requestId}.`);throw new Error(parts.join(" "));}
    showSuccess(result);await loadOrderHistory();clearSavedDraft({statusText:result.updated?"Revision saved. Local draft cleared.":"Order submitted. Local draft cleared."});if(editing){state.editingOrder=null;document.getElementById("editModeBanner").hidden=true;document.getElementById("editOrderNumber").textContent="";document.getElementById("editRevisionText").textContent="";}state.suppressDraftUntilInput=true;
  }catch(error){showMessage(error.message||String(error),"error");}finally{state.isSubmitting=false;const button=document.getElementById("submitButton");button.disabled=false;button.textContent=state.editingOrder?"Save changes":"Submit order";}}

function validateOrderDetails() {
  const details = getOrderDetails();

  if (!details.contact) throw new Error("Enter the contact name.");
  if (!details.mobile) throw new Error("Enter the contact mobile number.");
  if (!details.requiredDate) throw new Error("Select the required date.");
  if (!details.requiredTime) throw new Error("Select the required time.");
  if (!details.timeSlot) throw new Error("Select a time slot.");
  if (!details.deliveryType) throw new Error("Select the delivery type.");

  if (
    details.deliveryType !== "Pickup (Customer to collect)" &&
    !details.deliveryAddress
  ) {
    throw new Error("Enter the delivery address.");
  }
}

function validateProducts() {
  const items =
    getFloorItems("ground").length +
    getFloorItems("first").length;
  const other =
    getOtherMaterials("ground").length +
    getOtherMaterials("first").length;

  if (items === 0 && other === 0) {
    throw new Error("Add at least one product to the order.");
  }

  ["ground", "first"].forEach((floor) =>
    getOtherMaterials(floor).forEach((item) => {
      if (
        !item.sku ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 999
      ) {
        throw new Error(
          `${floorLabels[floor]}: each searched product requires a quantity from 1 to 999.`,
        );
      }
    }),
  );
}

function validateOrder() {
  validateOrderDetails();
  validateProducts();
}

function buildPayload(){
  const submissionId=typeof crypto.randomUUID==="function"?`BPS-${crypto.randomUUID()}`:`BPS-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const details=getOrderDetails();const floors={};
  ["ground","first"].forEach((floor)=>{const items=getFloorItems(floor);const otherMaterials=getOtherMaterials(floor);if(items.length===0&&otherMaterials.length===0)return;floors[floor]={items,otherProducts:"",otherMaterials,acousticFormat:selectedRadioValue(`${floor}AcousticFormat`)||"Roll"};});
  return{submissionId,...details,customerReference:details.reference,jobName:details.customer,siteAddress1:details.deliveryAddress,siteAddress2:"",siteContact:details.contact,siteContactPhone:details.mobile,requesterName:details.contact,requesterPhone:details.mobile,comments:details.deliveryInstructions,floors};
}

function showSuccess(result){
  setActiveStep("review", { skipValidation: true, silent: true });
  clearMessage();const panel=document.getElementById("successPanel");const title=document.getElementById("successTitle");const summary=document.getElementById("successSummary");const files=document.getElementById("generatedFiles");files.replaceChildren();const generated=Array.isArray(result.generatedFiles)?result.generatedFiles:[];title.textContent=result.updated?"Order updated":"Order created";
  summary.textContent=generated.length>0?(result.updated?`${generated.length} replacement file${generated.length===1?" was":"s were"} generated for Revision ${result.revisionNo}.`:`${generated.length} Accrivia file${generated.length===1?" was":"s were"} generated and saved.`):"The order was saved successfully. Bell Plaster will process the selected lines.";
  generated.forEach((file)=>{const item=document.createElement("div");item.className="generated-file";const info=document.createElement("div");info.className="generated-file-info";const name=document.createElement("strong");name.textContent=file.filename;const detail=document.createElement("span");detail.textContent=`${file.floorLabel} · ${file.itemCount} line${file.itemCount===1?"":"s"}`;info.append(name,detail);item.append(info);if(file.downloadUrl)item.append(createDownloadLink(file.downloadUrl,file.filename));files.append(item);});
  document.getElementById("orderNumberDisplay").textContent=result.customerReference||result.submissionId||"Not returned";panel.hidden=false;panel.scrollIntoView({behavior:"smooth",block:"center"});
}

async function loadOrderHistory(){
  const status=document.getElementById("orderHistoryStatus");const list=document.getElementById("orderHistoryList");status.textContent="Loading orders…";list.replaceChildren();
  try{const response=await fetch("/api/orders",{headers:{Accept:"application/json"}});if(response.status===401){window.location.replace("/signin/");return;}const result=await response.json().catch(()=>({ok:false,error:"The order history service returned an unreadable response."}));if(!response.ok||!result.ok)throw new Error(result.error||"Order history could not be loaded.");const orders=Array.isArray(result.orders)?result.orders:[];if(orders.length===0){status.textContent="No orders yet.";return;}status.textContent=`${orders.length} order${orders.length===1?"":"s"}`;orders.forEach((order)=>list.append(createHistoryOrderCard(order)));}catch(error){status.textContent=error.message||String(error);}}

function createHistoryOrderCard(order){
  const card=document.createElement("article");card.className="history-order";const header=document.createElement("div");header.className="history-order-header";const identity=document.createElement("div");const title=document.createElement("strong");title.textContent=order.customer_reference||order.submission_id;const meta=document.createElement("span");meta.textContent=[formatHistoryDate(order.updated_at||order.created_at),`Revision ${order.latest_revision||1}`].join(" · ");identity.append(title,meta);const actions=document.createElement("div");actions.className="history-header-actions";const badge=document.createElement("span");badge.className=`history-badge history-badge-${order.status||"unknown"}`;badge.textContent=String(order.status||"unknown").replace(/_/g," ");actions.append(badge);
  if(order.can_edit)actions.append(actionButton("Edit order",()=>editOrder(order.submission_id)));
  if(order.can_archive)actions.append(actionButton("Archive",()=>changeOrderArchiveStatus(order.submission_id,order.customer_reference,"archive")));
  if(order.can_restore)actions.append(actionButton("Restore",()=>changeOrderArchiveStatus(order.submission_id,order.customer_reference,"restore")));
  if(order.can_delete)actions.append(actionButton("Delete",()=>deleteOrder(order.submission_id,order.customer_reference),"button-danger"));
  header.append(identity,actions);card.append(header);

  const d=order.order_details||{};const detailGrid=document.createElement("div");detailGrid.className="history-detail-grid";[
    ["Contact",[d.contact,d.mobile].filter(Boolean).join(" · ")],["Required",[d.required_date,d.required_time,d.time_slot].filter(Boolean).join(" · ")],["Delivery",d.delivery_type],["Address",d.delivery_address],["Extras",Array.isArray(d.extras)?d.extras.join(", "):""]
  ].forEach(([label,value])=>{if(!value)return;const item=document.createElement("div");item.innerHTML=`<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;detailGrid.append(item);});if(detailGrid.children.length)card.append(detailGrid);
  if(d.delivery_instructions){const instructions=document.createElement("div");instructions.className="history-note-block";instructions.innerHTML=`<strong>Delivery instructions</strong><span>${escapeHtml(d.delivery_instructions)}</span>`;card.append(instructions);}

  if(Array.isArray(order.other_materials)&&order.other_materials.length){const block=document.createElement("div");block.className="history-note-block";const h=document.createElement("strong");h.textContent="Other materials";block.append(h);order.other_materials.forEach((floor)=>floor.items.forEach((item)=>{const line=document.createElement("span");line.textContent=`${floor.floor_label}: ${item.sku ? `${item.sku} — ` : ""}${item.description || "Product"} × ${item.quantity}`;block.append(line);}));card.append(block);}
  if(Array.isArray(order.pending_mapping)&&order.pending_mapping.length){const details=document.createElement("details");details.className="history-mapping-block";const count=order.pending_mapping.reduce((t,f)=>t+(f.items?.length||0),0);const summary=document.createElement("summary");summary.textContent=`${count} product line${count===1?"":"s"} for manual processing`;details.append(summary);order.pending_mapping.forEach((floor)=>floor.items.forEach((item)=>{const line=document.createElement("span");line.textContent=`${floor.floor_label}: ${item.label} × ${item.quantity}`;details.append(line);}));card.append(details);}
  if(Array.isArray(order.files)&&order.files.length){const files=document.createElement("div");files.className="history-files";order.files.forEach((file)=>{const row=document.createElement("div");row.className="history-file-row";const info=document.createElement("div");info.className="history-file-info";const name=document.createElement("strong");name.textContent=file.filename;const detail=document.createElement("span");detail.textContent=[`Revision ${file.revision||1}`,file.floor_label,`${file.item_count} line${file.item_count===1?"":"s"}`].join(" · ");info.append(name,detail);row.append(info);if(file.download_url)row.append(createDownloadLink(file.download_url,file.filename));files.append(row);});card.append(files);}
  return card;
}

function actionButton(text,handler,extra=""){const b=document.createElement("button");b.className=`button button-secondary button-small ${extra}`.trim();b.type="button";b.textContent=text;b.addEventListener("click",handler);return b;}
function createDownloadLink(url,filename){const link=document.createElement("a");link.className="button button-secondary button-small download-button";link.href=url;link.textContent="Download XLSX";link.setAttribute("download",filename||"");return link;}

async function editOrder(submissionId){clearMessage();document.getElementById("successPanel").hidden=true;try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{headers:{Accept:"application/json"}});if(response.status===401){window.location.replace("/signin/");return;}const result=await response.json().catch(()=>({ok:false,error:"The order could not be loaded for editing."}));if(!response.ok||!result.ok)throw new Error(result.error||"The order could not be loaded for editing.");populateOrderForEditing(result);}catch(error){showMessage(error.message||String(error),"error");}}

function populateOrderForEditing(result){
  clearProductSelections();const payload=result.payload||{};setOrderDetails(payload);const floors=payload.floors||{};
  ["ground","first"].forEach((floor)=>{const p=floors[floor];if(!p)return;(p.items||[]).forEach((item)=>{const field=document.querySelector(`.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(item.key)}"]`);if(field)field.value=String(item.quantity);});state.otherMaterials[floor]=(p.otherMaterials||[]).map((item)=>({sku:item.sku||"",description:item.description||item.description_raw||state.productDirectory.find((product)=>product.sku.toUpperCase()===String(item.sku||"").toUpperCase())?.description||"",quantity:Number(item.quantity||1)})).filter((item)=>item.sku);renderSelectedOtherMaterials(floor);const acoustic=document.querySelector(`input[name="${floor}AcousticFormat"][value="${cssEscape(p.acousticFormat||"Roll")}"]`);if(acoustic)acoustic.checked=true;updateFloorCount(floor);});
  state.editingOrder={submissionId:result.order.submissionId,orderNumber:result.order.orderNumber,latestRevision:result.order.latestRevision};document.getElementById("editOrderNumber").textContent=result.order.orderNumber;document.getElementById("editRevisionText").textContent=`Saving will create Revision ${result.order.latestRevision+1}. Earlier files will remain available.`;document.getElementById("editModeBanner").hidden=false;document.getElementById("submitButton").textContent="Save changes";activateFloorTab(floors.ground?"ground":"first");state.suppressDraftUntilInput=false;saveDraftNow();closeHistoryDrawer();setActiveStep("products",{skipValidation:true});renderCurrentOrder();window.scrollTo({top:0,behavior:"smooth"});
}

function setOrderDetails(p){
  document.getElementById("orderDate").value=p.orderDate||todayLocal();document.getElementById("accountReference").value=p.reference||p.customerReference||"BPS BRUNSW17";document.getElementById("customerName").value=p.customer||p.jobName||"BPS Brunswick Plastering Services";document.getElementById("contactName").value=p.contact||p.siteContact||"";document.getElementById("contactMobile").value=p.mobile||p.siteContactPhone||"";document.getElementById("deliveryAddress").value=p.deliveryAddress||p.siteAddress1||"";document.getElementById("deliveryInstructions").value=p.deliveryInstructions||p.comments||"";document.getElementById("requiredDate").value=p.requiredDate||"";document.getElementById("requiredTime").value=p.requiredTime||"";
  setRadio("timeSlot",p.timeSlot||"ANY");setRadio("deliveryType",p.deliveryType||"");document.querySelectorAll('input[name="deliveryExtra"]').forEach((field)=>{field.checked=(p.extras||[]).includes(field.value);});updatePickupAddressRequirement();
}
function setRadio(name,value){document.querySelectorAll(`input[name="${name}"]`).forEach((f)=>{f.checked=f.value===value;});}
function cancelEdit(){resetOrderForm();clearMessage();document.getElementById("successPanel").hidden=true;}
function resetOrderForm(){state.editingOrder=null;clearProductSelections();clearOrderDetails();activateFloorTab("ground");activateCategory("boards",{silent:true});setActiveStep("details",{skipValidation:true,silent:true});document.getElementById("editModeBanner").hidden=true;document.getElementById("editOrderNumber").textContent="";document.getElementById("editRevisionText").textContent="";document.getElementById("submitButton").textContent="Submit order";document.getElementById("successPanel").hidden=true;clearSavedDraft({statusText:"Form cleared."});state.suppressDraftUntilInput=true;renderCurrentOrder();}
function clearOrderDetails(){document.getElementById("orderDate").value=todayLocal();document.getElementById("accountReference").value="BPS BRUNSW17";document.getElementById("customerName").value="BPS Brunswick Plastering Services";["contactName","contactMobile","deliveryAddress","deliveryInstructions","requiredDate","requiredTime"].forEach((id)=>document.getElementById(id).value="");setRadio("timeSlot","ANY");setRadio("deliveryType","");document.querySelectorAll('input[name="deliveryExtra"]').forEach((f)=>f.checked=false);updatePickupAddressRequirement();}
function clearProductSelections(){document.querySelectorAll(".quantity-input").forEach((f)=>f.value="");["ground","first"].forEach((floor)=>{state.otherMaterials[floor]=[];renderSelectedOtherMaterials(floor);setRadio(`${floor}AcousticFormat`,"Roll");updateFloorCount(floor);});}

async function changeOrderArchiveStatus(submissionId,orderNumber,action){const verb=action==="archive"?"archive":"restore";if(action==="archive"&&!window.confirm(`Archive ${orderNumber}? The order and files will remain available.`))return;try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{method:"PATCH",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action})});const result=await response.json().catch(()=>({ok:false,error:`The order could not be ${verb}d.`}));if(!response.ok||!result.ok)throw new Error(result.error||`The order could not be ${verb}d.`);if(state.editingOrder?.submissionId===submissionId&&action==="archive")cancelEdit();await loadOrderHistory();}catch(error){showMessage(error.message||String(error),"error");}}
async function deleteOrder(submissionId,orderNumber){if(!window.confirm(`Permanently delete ${orderNumber}? This removes its order history and every generated file. This cannot be undone.`))return;const typed=window.prompt(`Type ${orderNumber} to confirm permanent deletion.`);if(typed!==orderNumber){showMessage("Deletion cancelled because the order number did not match.","error");return;}try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{method:"DELETE",headers:{Accept:"application/json"}});const result=await response.json().catch(()=>({ok:false,error:"The order could not be deleted."}));if(!response.ok||!result.ok)throw new Error(result.error||"The order could not be deleted.");if(state.editingOrder?.submissionId===submissionId)cancelEdit();document.getElementById("successPanel").hidden=true;clearMessage();await loadOrderHistory();}catch(error){showMessage(error.message||String(error),"error");}}


function bindKioskNavigation() {
  document.querySelectorAll("[data-step-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.stepTarget;

      try {
        if (target === "products") validateOrderDetails();
        if (target === "review") {
          validateOrder();
          renderReviewStep();
        }
        setActiveStep(target);
      } catch (error) {
        showMessage(error.message || String(error), "error");
        setActiveStep(target === "review" ? "products" : "details", {
          skipValidation: true,
        });
      }
    });
  });

  document
    .getElementById("continueToProductsButton")
    .addEventListener("click", () => {
      try {
        validateOrderDetails();
        setActiveStep("products");
      } catch (error) {
        showMessage(error.message || String(error), "error");
      }
    });

  document
    .getElementById("reviewOrderButton")
    .addEventListener("click", () => {
      try {
        validateOrder();
        renderReviewStep();
        setActiveStep("review");
      } catch (error) {
        showMessage(error.message || String(error), "error");
      }
    });

  document
    .getElementById("backToProductsButton")
    .addEventListener("click", () => setActiveStep("products", {
      skipValidation: true,
    }));

  document
    .getElementById("editDetailsButton")
    .addEventListener("click", () => setActiveStep("details", {
      skipValidation: true,
    }));

  document
    .getElementById("editProductsButton")
    .addEventListener("click", () => setActiveStep("products", {
      skipValidation: true,
    }));

  document
    .getElementById("startNewOrderButton")
    .addEventListener("click", resetOrderForm);
}

function setActiveStep(step, options = {}) {
  if (!["details", "products", "review"].includes(step)) {
    step = "details";
  }

  document.querySelectorAll("[data-kiosk-step]").forEach((panel) => {
    const active = panel.dataset.kioskStep === step;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  document.querySelectorAll("[data-step-target]").forEach((button) => {
    const steps = ["details", "products", "review"];
    const currentIndex = steps.indexOf(step);
    const buttonIndex = steps.indexOf(button.dataset.stepTarget);
    button.classList.toggle("is-active", buttonIndex === currentIndex);
    button.classList.toggle("is-complete", buttonIndex < currentIndex);
    button.setAttribute(
      "aria-current",
      buttonIndex === currentIndex ? "step" : "false",
    );
  });

  state.activeStep = step;

  if (step === "review") {
    renderReviewStep();
  }

  if (step === "products") {
    renderCurrentOrder();
    requestAnimationFrame(() => {
      document.querySelector(
        `[data-floor-panel="${state.activeFloor}"] [data-category-panel="${state.activeCategory}"]`,
      )?.scrollTo?.({ top: 0 });
    });
  }

  if (!options.silent && !state.isRestoringDraft) {
    scheduleDraftSave();
  }
}

function bindCategoryNavigation() {
  document.querySelectorAll("[data-category-target]").forEach((button) => {
    button.addEventListener("click", () => {
      activateCategory(button.dataset.categoryTarget);
    });
  });
}

function activateCategory(category, options = {}) {
  const button = document.querySelector(
    `[data-category-target="${cssEscape(category)}"]`,
  );

  if (!button) {
    category = "boards";
  }

  document.querySelectorAll("[data-category-target]").forEach((item) => {
    item.classList.toggle(
      "is-active",
      item.dataset.categoryTarget === category,
    );
  });

  document.querySelectorAll("[data-category-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.categoryPanel !== category;
  });

  const activeButton = document.querySelector(
    `[data-category-target="${cssEscape(category)}"]`,
  );

  document.getElementById("activeCategoryTitle").textContent =
    activeButton?.dataset.categoryTitle || "Products";
  document.getElementById("activeCategoryDescription").textContent =
    activeButton?.dataset.categoryDescription || "";

  state.activeCategory = category;

  if (category === "all_products") {
    requestAnimationFrame(() => {
      document.getElementById("globalProductSearch")?.focus();
    });
  }

  if (!options.silent && !state.isRestoringDraft) {
    scheduleDraftSave();
  }
}

function bindGlobalProductSearch() {
  const search = document.getElementById("globalProductSearch");
  const results = document.getElementById("globalProductResults");

  search.addEventListener("input", () => {
    renderProductSearchResults(
      state.activeFloor,
      search.value,
      search,
      results,
    );
  });

  search.addEventListener("keydown", (event) => {
    handleProductSearchKeydown(
      event,
      state.activeFloor,
      search,
      results,
    );
  });

  search.addEventListener("focus", () => {
    if (search.value.trim()) {
      renderProductSearchResults(
        state.activeFloor,
        search.value,
        search,
        results,
      );
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      !event.target.closest(".global-product-search") &&
      !results.hidden
    ) {
      results.hidden = true;
    }
  });
}

function bindHistoryDrawer() {
  document
    .getElementById("openHistoryButton")
    .addEventListener("click", openHistoryDrawer);

  document
    .getElementById("closeHistoryButton")
    .addEventListener("click", closeHistoryDrawer);

  document
    .getElementById("historyBackdrop")
    .addEventListener("click", closeHistoryDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHistoryDrawer();
    }
  });
}

function openHistoryDrawer() {
  const drawer = document.getElementById("historyDrawer");
  const backdrop = document.getElementById("historyBackdrop");

  backdrop.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add("is-open");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  });
}

function closeHistoryDrawer() {
  const drawer = document.getElementById("historyDrawer");
  const backdrop = document.getElementById("historyBackdrop");

  drawer.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");

  window.setTimeout(() => {
    if (!backdrop.classList.contains("is-open")) {
      backdrop.hidden = true;
    }
  }, 220);
}

function bindCurrentOrderActions() {
  document
    .getElementById("clearOrderButton")
    .addEventListener("click", () => {
      const hasProducts =
        getOrderLines("ground").length +
        getOrderLines("first").length > 0;

      if (
        hasProducts &&
        !window.confirm("Clear every product from this order?")
      ) {
        return;
      }

      clearProductSelections();
      renderCurrentOrder();
      markDraftChanged();
    });
}

function getOrderLines(floor) {
  const standard = getFloorItems(floor).map((item) => {
    const product = state.catalog[item.key] || {};

    return {
      source: "standard",
      key: item.key,
      sku: product.sku || "",
      description: product.label || product.description || item.key,
      quantity: item.quantity,
    };
  });

  const searched = getOtherMaterials(floor).map((item) => ({
    source: "search",
    key: item.sku,
    sku: item.sku,
    description: item.description,
    quantity: item.quantity,
  }));

  return [...standard, ...searched];
}

function renderCurrentOrder() {
  const container = document.getElementById("currentOrderList");
  if (!container) return;

  const allLines = {
    ground: getOrderLines("ground"),
    first: getOrderLines("first"),
  };

  const lineCount =
    allLines.ground.length +
    allLines.first.length;
  const unitCount =
    [...allLines.ground, ...allLines.first]
      .reduce((total, item) => total + item.quantity, 0);

  document.getElementById("currentOrderSummary").textContent =
    `${lineCount} product${lineCount === 1 ? "" : "s"}`;
  document.getElementById("currentOrderLineCount").textContent =
    String(lineCount);
  document.getElementById("currentOrderUnitCount").textContent =
    String(unitCount);

  container.replaceChildren();

  if (lineCount === 0) {
    const empty = document.createElement("div");
    empty.className = "basket-empty";
    empty.innerHTML =
      "<span>＋</span><strong>Your order is empty</strong><p>Select a product or use the search above.</p>";
    container.append(empty);
    return;
  }

  ["ground", "first"].forEach((floor) => {
    if (!allLines[floor].length) return;

    const group = document.createElement("section");
    group.className = "basket-floor-group";

    const heading = document.createElement("header");
    heading.innerHTML =
      `<strong>${floorLabels[floor]}</strong><span>${allLines[floor].length} line${allLines[floor].length === 1 ? "" : "s"}</span>`;
    group.append(heading);

    allLines[floor].forEach((item) => {
      group.append(createBasketLine(floor, item));
    });

    container.append(group);
  });
}

function createBasketLine(floor, item) {
  const row = document.createElement("div");
  row.className = "basket-line";

  const info = document.createElement("button");
  info.type = "button";
  info.className = "basket-line-info";

  const name = document.createElement("strong");
  name.textContent = item.description;
  const sku = document.createElement("span");
  sku.textContent = item.sku || "Standard form product";
  info.append(name, sku);

  info.addEventListener("click", () => {
    activateFloorTab(floor);

    if (item.source === "search") {
      activateCategory("all_products");
      document
        .querySelector(
          `[data-other-material-sku="${floor}:${cssEscape(item.sku)}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const field = document.querySelector(
        `.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(item.key)}"]`,
      );
      const panel = field?.closest("[data-category-panel]");
      if (panel) activateCategory(panel.dataset.categoryPanel);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus();
    }
  });

  const controls = document.createElement("div");
  controls.className = "basket-line-controls";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  minus.setAttribute("aria-label", `Reduce ${item.description}`);

  const quantity = document.createElement("input");
  quantity.type = "number";
  quantity.min = "1";
  quantity.max = "999";
  quantity.value = String(item.quantity);
  quantity.setAttribute("aria-label", `${item.description} quantity`);

  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  plus.setAttribute("aria-label", `Increase ${item.description}`);

  const update = (nextValue) => {
    setOrderLineQuantity(floor, item, nextValue);
  };

  minus.addEventListener("click", () => update(item.quantity - 1));
  plus.addEventListener("click", () => update(item.quantity + 1));
  quantity.addEventListener("change", () => update(Number(quantity.value || 0)));
  quantity.addEventListener("focus", () => quantity.select());

  controls.append(minus, quantity, plus);
  row.append(info, controls);

  return row;
}

function setOrderLineQuantity(floor, item, value) {
  const quantity = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));

  if (item.source === "standard") {
    const field = document.querySelector(
      `.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(item.key)}"]`,
    );

    if (field) {
      field.value = quantity > 0 ? String(quantity) : "";
      updateQuantityAppearance(field);
    }
  } else {
    const selected = state.otherMaterials[floor].find(
      (candidate) =>
        candidate.sku.toUpperCase() === item.sku.toUpperCase(),
    );

    if (quantity <= 0) {
      state.otherMaterials[floor] = state.otherMaterials[floor].filter(
        (candidate) =>
          candidate.sku.toUpperCase() !== item.sku.toUpperCase(),
      );
    } else if (selected) {
      selected.quantity = quantity;
    }

    renderSelectedOtherMaterials(floor);
  }

  updateFloorCount(floor);
  renderCurrentOrder();
  markDraftChanged();
}

function updateQuantityAppearance(input) {
  input.classList.toggle(
    "has-value",
    Number(input.value || 0) > 0,
  );
}

function updateCategoryBadges() {
  document.querySelectorAll("[data-category-target]").forEach((button) => {
    const category = button.dataset.categoryTarget;
    const panels = Array.from(
      document.querySelectorAll(
        `[data-floor-panel="${state.activeFloor}"] [data-category-panel="${category}"]`,
      ),
    );

    const count = panels.reduce((total, panel) => {
      const standard = Array.from(
        panel.querySelectorAll(".quantity-input"),
      ).filter((field) => Number(field.value || 0) > 0).length;

      const searched =
        category === "all_products"
          ? getOtherMaterials(state.activeFloor).length
          : 0;

      return total + standard + searched;
    }, 0);

    let badge = button.querySelector(".category-count");

    if (!badge && count > 0) {
      badge = document.createElement("span");
      badge.className = "category-count";
      button.append(badge);
    }

    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
  });
}

function renderReviewStep() {
  const details = getOrderDetails();
  const detailsContainer = document.getElementById("reviewDetails");
  detailsContainer.replaceChildren();

  const detailRows = [
    ["Customer", details.customer],
    ["Contact", [details.contact, details.mobile].filter(Boolean).join(" · ")],
    ["Required", [details.requiredDate, details.requiredTime, details.timeSlot].filter(Boolean).join(" · ")],
    ["Delivery", details.deliveryType],
    ["Address", details.deliveryAddress || "Pickup from Bell Plaster"],
    ["Extras", details.extras.join(", ")],
    ["Instructions", details.deliveryInstructions],
  ];

  detailRows.forEach(([label, value]) => {
    if (!value) return;

    const item = document.createElement("div");
    const heading = document.createElement("span");
    heading.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value;
    item.append(heading, content);
    detailsContainer.append(item);
  });

  const productsContainer = document.getElementById("reviewOrderLines");
  productsContainer.replaceChildren();

  let lineTotal = 0;
  let unitTotal = 0;

  ["ground", "first"].forEach((floor) => {
    const lines = getOrderLines(floor);
    if (!lines.length) return;

    const group = document.createElement("section");
    group.className = "review-floor-group";

    const heading = document.createElement("header");
    heading.innerHTML =
      `<strong>${floorLabels[floor]}</strong><span>${lines.length} line${lines.length === 1 ? "" : "s"}</span>`;
    group.append(heading);

    lines.forEach((item) => {
      const row = document.createElement("div");
      row.className = "review-product-line";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = item.description;
      const sku = document.createElement("span");
      sku.textContent = item.sku || "Standard form product";
      info.append(name, sku);

      const quantity = document.createElement("strong");
      quantity.textContent = `× ${item.quantity}`;

      row.append(info, quantity);
      group.append(row);

      lineTotal += 1;
      unitTotal += item.quantity;
    });

    productsContainer.append(group);
  });

  document.getElementById("reviewLineTotal").textContent =
    `${lineTotal} product line${lineTotal === 1 ? "" : "s"}`;
  document.getElementById("reviewUnitTotal").textContent =
    `${unitTotal} total unit${unitTotal === 1 ? "" : "s"}`;
}

function bindDraftPersistence(){window.addEventListener("beforeunload",()=>saveDraftNow({silent:true}));document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveDraftNow({silent:true});});}
function markDraftChanged(){state.suppressDraftUntilInput=false;scheduleDraftSave();}
function scheduleDraftSave(){if(state.isRestoringDraft||state.suppressDraftUntilInput)return;setDraftStatus("Saving draft…","saving");window.clearTimeout(state.draftSaveTimer);state.draftSaveTimer=window.setTimeout(()=>saveDraftNow(),180);}
function saveDraftNow(options={}){if(state.isRestoringDraft||state.suppressDraftUntilInput||!state.layout)return;window.clearTimeout(state.draftSaveTimer);const draft=collectDraft();if(!draftHasContent(draft)){try{localStorage.removeItem(DRAFT_STORAGE_KEY);}catch{}if(!options.silent)setDraftStatus("Changes save automatically","idle");return;}try{localStorage.setItem(DRAFT_STORAGE_KEY,JSON.stringify(draft));if(!options.silent)setDraftStatus(`Draft saved ${formatDraftTime(draft.updatedAt)}.`,"saved");}catch{if(!options.silent)setDraftStatus("Draft saving is unavailable in this browser.","error");}}
function collectDraft(){const floors={};["ground","first"].forEach((floor)=>{const quantities={};document.querySelectorAll(`.quantity-input[data-floor="${floor}"]`).forEach((f)=>{const value=Number(f.value||0);if(Number.isInteger(value)&&value>0&&value<=999)quantities[f.dataset.productKey]=value;});floors[floor]={quantities,otherMaterials:getOtherMaterials(floor),acousticFormat:selectedRadioValue(`${floor}AcousticFormat`)||"Roll"};});return{version:DRAFT_VERSION,updatedAt:new Date().toISOString(),activeFloor:state.activeFloor,activeStep:state.activeStep,activeCategory:state.activeCategory,editingOrder:state.editingOrder,details:getOrderDetails(),floors};}
function draftHasContent(draft){const d=draft.details||{};if(draft.editingOrder)return true;if(d.contact||d.mobile||d.deliveryAddress||d.deliveryInstructions||d.requiredDate||d.requiredTime||d.deliveryType||(d.extras||[]).length)return true;return Object.values(draft.floors||{}).some((f)=>Object.keys(f.quantities||{}).length||(f.otherMaterials||[]).length);}
function restoreDraft(){let draft;try{const raw=localStorage.getItem(DRAFT_STORAGE_KEY);if(!raw){setDraftStatus("Changes save automatically","idle");return;}draft=JSON.parse(raw);}catch{setDraftStatus("The previous browser draft could not be read.","error");return;}if(!draft||draft.version!==DRAFT_VERSION){clearSavedDraft();return;}state.isRestoringDraft=true;try{setOrderDetails(draft.details||{});["ground","first"].forEach((floor)=>{const f=draft.floors?.[floor]||{};Object.entries(f.quantities||{}).forEach(([key,q])=>{const field=document.querySelector(`.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(key)}"]`);if(field)field.value=String(q);});state.otherMaterials[floor]=(f.otherMaterials||[]).map((item)=>({sku:item.sku||"",description:item.description||state.productDirectory.find((product)=>product.sku.toUpperCase()===String(item.sku||"").toUpperCase())?.description||"",quantity:Number(item.quantity||1)})).filter((item)=>item.sku);renderSelectedOtherMaterials(floor);setRadio(`${floor}AcousticFormat`,f.acousticFormat||"Roll");});state.editingOrder=draft.editingOrder||null;if(state.editingOrder){document.getElementById("editOrderNumber").textContent=state.editingOrder.orderNumber||"";document.getElementById("editRevisionText").textContent=`Saving will create Revision ${(state.editingOrder.latestRevision||0)+1}. Earlier files will remain available.`;document.getElementById("editModeBanner").hidden=false;document.getElementById("submitButton").textContent="Save changes";}activateFloorTab(["ground","first"].includes(draft.activeFloor)?draft.activeFloor:"ground");activateCategory(draft.activeCategory||"boards",{silent:true});setActiveStep(draft.activeStep||"details",{skipValidation:true,silent:true});updateAllFloorCounts();renderCurrentOrder();state.suppressDraftUntilInput=false;setDraftStatus(`Draft restored from ${formatDraftTime(draft.updatedAt)}.`,"restored");}finally{state.isRestoringDraft=false;}}
function clearSavedDraft(options={}){window.clearTimeout(state.draftSaveTimer);try{localStorage.removeItem(DRAFT_STORAGE_KEY);}catch{}if(options.statusText)setDraftStatus(options.statusText,"saved");}
function setDraftStatus(text,status){const e=document.getElementById("draftStatus");if(!e)return;e.textContent=text;e.dataset.status=status||"idle";}
function formatDraftTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return"recently";return new Intl.DateTimeFormat("en-AU",{hour:"numeric",minute:"2-digit"}).format(date);}
function focusNextQuantityField(floor,current,direction){const fields=Array.from(document.querySelectorAll(`[data-floor-panel="${floor}"] .quantity-input, [data-floor-panel="${floor}"] .other-material-quantity`));const index=fields.indexOf(current);const next=fields[index+direction];if(!next)return;next.focus();next.select();next.scrollIntoView({block:"nearest",inline:"nearest"});}

function todayLocal(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}
function formatHistoryDate(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value||"");return new Intl.DateTimeFormat("en-AU",{dateStyle:"medium",timeStyle:"short"}).format(date);}
function cssEscape(value){return window.CSS?.escape?window.CSS.escape(String(value)):String(value).replace(/(["\\])/g,"\\$1");}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}
function showMessage(text,type){
  const globalMessage=document.getElementById("globalMessage");
  const reviewMessage=document.getElementById("formMessage");

  [globalMessage,reviewMessage].filter(Boolean).forEach((message)=>{
    message.textContent=text;
    message.className=`${message.id==="globalMessage"?"kiosk-message":"message"} message-${type}`;
    message.hidden=false;
  });

  if(globalMessage){
    window.clearTimeout(showMessage._timer);
    showMessage._timer=window.setTimeout(()=>{globalMessage.hidden=true;},5000);
  }
}
function clearMessage(){
  ["globalMessage","formMessage"].forEach((id)=>{
    const message=document.getElementById(id);
    if(!message)return;
    message.hidden=true;
    message.textContent="";
    message.className=id==="globalMessage"?"kiosk-message":"message";
  });
}
