const state = {
  catalog: {},
  layout: null,
  isSubmitting: false,
  editingOrder: null,
  activeFloor: "ground",
  draftSaveTimer: null,
  isRestoringDraft: false,
  suppressDraftUntilInput: false,
};

const DRAFT_STORAGE_KEY = "bps-knauf-order-form-draft-v5";
const DRAFT_VERSION = 5;
const floorLabels = { ground: "Ground Floor", first: "1st Floor" };

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindTabs();
  bindSubmission();
  bindLogout();
  bindDraftPersistence();
  bindOrderDetailInteractions();
  document.getElementById("refreshHistoryButton").addEventListener("click", loadOrderHistory);
  document.getElementById("cancelEditButton").addEventListener("click", cancelEdit);
  document.getElementById("orderDate").value = todayLocal();
  await loadCatalog();
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
    if (["logoutButton", "submitButton", "cancelEditButton"].includes(field.id)) return;
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
    restoreDraft();
    updateAllFloorCounts();
  } catch (error) {
    showMessage(`The order form could not be loaded. ${error.message || String(error)}`, "error");
  }
}

function renderFloorSheet(floor) {
  const container = document.getElementById(`${floor}OrderSheet`);
  container.replaceChildren();

  const top = document.createElement("div");
  top.className = "product-top-layout";
  top.append(renderMainBoardMatrix(floor, state.layout.mainBoard));
  top.append(renderSpecialtyBoards(floor, state.layout.specialtyBoards));
  container.append(top);

  const lower = document.createElement("div");
  lower.className = "product-lower-layout";
  state.layout.lowerColumns.forEach((sectionIds) => {
    const column = document.createElement("div");
    column.className = "product-layout-column";
    sectionIds.forEach((id) => {
      const def = state.layout.sections[id];
      if (def) column.append(renderSection(floor, def));
    });
    lower.append(column);
  });
  container.append(lower);
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
  const section=createSectionShell("compact-section other-materials-section",def.title);
  const header=document.createElement("div"); header.className="other-materials-header"; header.innerHTML="<span>Product Description</span><span>Qty</span>"; section.body.append(header);
  for(let index=0;index<def.rows;index+=1){
    const row=document.createElement("div");row.className="other-material-row";
    const description=document.createElement("input");description.type="text";description.maxLength=200;description.placeholder="Product description";description.dataset.otherMaterialDescription=floor;description.dataset.otherMaterialIndex=String(index);description.addEventListener("input",()=>{updateFloorCount(floor);markDraftChanged();});
    const quantity=document.createElement("input");quantity.type="number";quantity.min="0";quantity.max="999";quantity.step="1";quantity.placeholder="0";quantity.className="other-material-quantity";quantity.dataset.otherMaterialQuantity=floor;quantity.dataset.otherMaterialIndex=String(index);quantity.addEventListener("input",()=>{normaliseQuantityField(quantity);updateFloorCount(floor);markDraftChanged();});
    row.append(description,quantity);section.body.append(row);
  }
  return section.root;
}

function createSectionShell(className,title){const root=document.createElement("section");root.className=`product-section ${className}`;const heading=document.createElement("h3");heading.textContent=title;const body=document.createElement("div");body.className="product-section-body";root.append(heading,body);return{root,body};}

function createQuantityCell(floor,key){const td=document.createElement("td");if(!key){td.className="unavailable-cell";return td;}td.className="quantity-cell";td.append(createQuantityInput(floor,key));return td;}
function createStandaloneQuantity(floor,key){const wrap=document.createElement("div");wrap.className="standalone-quantity";wrap.append(createQuantityInput(floor,key));return wrap;}
function createQuantityInput(floor,key){
  const product=state.catalog[key]; const input=document.createElement("input");input.className="quantity-input";input.type="number";input.min="0";input.max="999";input.step="1";input.inputMode="numeric";input.autocomplete="off";input.placeholder="0";input.dataset.productKey=key;input.dataset.floor=floor;input.title=product?.label||key;input.setAttribute("aria-label",`${product?.label||key} quantity for ${floorLabels[floor]}`);
  input.addEventListener("input",()=>{normaliseQuantityField(input);updateFloorCount(floor);markDraftChanged();});
  input.addEventListener("focus",()=>input.select());
  input.addEventListener("keydown",(event)=>{if(event.key!=="Enter")return;event.preventDefault();focusNextQuantityField(floor,input,event.shiftKey?-1:1);});
  return input;
}

function normaliseQuantityField(field){if(field.value==="")return;const q=Number(field.value);if(!Number.isFinite(q)||q<0){field.value="";return;}field.value=String(Math.min(999,Math.floor(q)));}
function getFloorItems(floor){return Array.from(document.querySelectorAll(`.quantity-input[data-floor="${floor}"]`)).map((f)=>({key:f.dataset.productKey,quantity:Number(f.value||0)})).filter((i)=>Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=999);}
function getOtherMaterials(floor){const descriptions=Array.from(document.querySelectorAll(`[data-other-material-description="${floor}"]`));return descriptions.map((d)=>{const index=d.dataset.otherMaterialIndex;const q=document.querySelector(`[data-other-material-quantity="${floor}"][data-other-material-index="${index}"]`);return{description:d.value.trim(),quantity:Number(q?.value||0)};}).filter((item)=>item.description||item.quantity);}
function updateFloorCount(floor){const standard=getFloorItems(floor).length;const other=getOtherMaterials(floor).filter((item)=>item.description&&item.quantity>0).length;document.getElementById(`${floor}TabCount`).textContent=String(standard+other);}
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
    showSuccess(result);await loadOrderHistory();clearSavedDraft({statusText:result.updated?"Revision saved. Local draft cleared.":"Order submitted. Local draft cleared."});if(editing)resetOrderForm();else state.suppressDraftUntilInput=true;
  }catch(error){showMessage(error.message||String(error),"error");}finally{state.isSubmitting=false;const button=document.getElementById("submitButton");button.disabled=false;button.textContent=state.editingOrder?"Save changes":"Submit order";}}

function validateOrder(){
  const details=getOrderDetails();
  if(!details.contact)throw new Error("Enter the contact name.");
  if(!details.mobile)throw new Error("Enter the contact mobile number.");
  if(!details.requiredDate)throw new Error("Select the required date.");
  if(!details.requiredTime)throw new Error("Select the required time.");
  if(!details.timeSlot)throw new Error("Select a time slot.");
  if(!details.deliveryType)throw new Error("Select the delivery type.");
  if(details.deliveryType!=="Pickup (Customer to collect)"&&!details.deliveryAddress)throw new Error("Enter the delivery address.");
  const items=getFloorItems("ground").length+getFloorItems("first").length;
  const other=getOtherMaterials("ground").length+getOtherMaterials("first").length;
  if(items===0&&other===0)throw new Error("Enter a quantity for at least one product.");
  ["ground","first"].forEach((floor)=>getOtherMaterials(floor).forEach((item)=>{if(!item.description||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)throw new Error(`${floorLabels[floor]}: each Other Materials row requires a description and quantity from 1 to 999.`);}));
}

function buildPayload(){
  const submissionId=typeof crypto.randomUUID==="function"?`BPS-${crypto.randomUUID()}`:`BPS-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const details=getOrderDetails();const floors={};
  ["ground","first"].forEach((floor)=>{const items=getFloorItems(floor);const otherMaterials=getOtherMaterials(floor);if(items.length===0&&otherMaterials.length===0)return;floors[floor]={items,otherProducts:"",otherMaterials,acousticFormat:selectedRadioValue(`${floor}AcousticFormat`)||"Roll"};});
  return{submissionId,...details,customerReference:details.reference,jobName:details.customer,siteAddress1:details.deliveryAddress,siteAddress2:"",siteContact:details.contact,siteContactPhone:details.mobile,requesterName:details.contact,requesterPhone:details.mobile,comments:details.deliveryInstructions,floors};
}

function showSuccess(result){
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

  if(Array.isArray(order.other_materials)&&order.other_materials.length){const block=document.createElement("div");block.className="history-note-block";const h=document.createElement("strong");h.textContent="Other materials";block.append(h);order.other_materials.forEach((floor)=>floor.items.forEach((item)=>{const line=document.createElement("span");line.textContent=`${floor.floor_label}: ${item.description} × ${item.quantity}`;block.append(line);}));card.append(block);}
  if(Array.isArray(order.pending_mapping)&&order.pending_mapping.length){const details=document.createElement("details");details.className="history-mapping-block";const count=order.pending_mapping.reduce((t,f)=>t+(f.items?.length||0),0);const summary=document.createElement("summary");summary.textContent=`${count} product line${count===1?"":"s"} for manual processing`;details.append(summary);order.pending_mapping.forEach((floor)=>floor.items.forEach((item)=>{const line=document.createElement("span");line.textContent=`${floor.floor_label}: ${item.label} × ${item.quantity}`;details.append(line);}));card.append(details);}
  if(Array.isArray(order.files)&&order.files.length){const files=document.createElement("div");files.className="history-files";order.files.forEach((file)=>{const row=document.createElement("div");row.className="history-file-row";const info=document.createElement("div");info.className="history-file-info";const name=document.createElement("strong");name.textContent=file.filename;const detail=document.createElement("span");detail.textContent=[`Revision ${file.revision||1}`,file.floor_label,`${file.item_count} line${file.item_count===1?"":"s"}`].join(" · ");info.append(name,detail);row.append(info);if(file.download_url)row.append(createDownloadLink(file.download_url,file.filename));files.append(row);});card.append(files);}
  return card;
}

function actionButton(text,handler,extra=""){const b=document.createElement("button");b.className=`button button-secondary button-small ${extra}`.trim();b.type="button";b.textContent=text;b.addEventListener("click",handler);return b;}
function createDownloadLink(url,filename){const link=document.createElement("a");link.className="button button-secondary button-small download-button";link.href=url;link.textContent="Download XLSX";link.setAttribute("download",filename||"");return link;}

async function editOrder(submissionId){clearMessage();document.getElementById("successPanel").hidden=true;try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{headers:{Accept:"application/json"}});if(response.status===401){window.location.replace("/signin/");return;}const result=await response.json().catch(()=>({ok:false,error:"The order could not be loaded for editing."}));if(!response.ok||!result.ok)throw new Error(result.error||"The order could not be loaded for editing.");populateOrderForEditing(result);}catch(error){showMessage(error.message||String(error),"error");}}

function populateOrderForEditing(result){
  clearProductSelections();const payload=result.payload||{};setOrderDetails(payload);const floors=payload.floors||{};
  ["ground","first"].forEach((floor)=>{const p=floors[floor];if(!p)return;(p.items||[]).forEach((item)=>{const field=document.querySelector(`.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(item.key)}"]`);if(field)field.value=String(item.quantity);});(p.otherMaterials||[]).forEach((item,index)=>{const d=document.querySelector(`[data-other-material-description="${floor}"][data-other-material-index="${index}"]`);const q=document.querySelector(`[data-other-material-quantity="${floor}"][data-other-material-index="${index}"]`);if(d)d.value=item.description||"";if(q)q.value=String(item.quantity||"");});const acoustic=document.querySelector(`input[name="${floor}AcousticFormat"][value="${cssEscape(p.acousticFormat||"Roll")}"]`);if(acoustic)acoustic.checked=true;updateFloorCount(floor);});
  state.editingOrder={submissionId:result.order.submissionId,orderNumber:result.order.orderNumber,latestRevision:result.order.latestRevision};document.getElementById("editOrderNumber").textContent=result.order.orderNumber;document.getElementById("editRevisionText").textContent=`Saving will create Revision ${result.order.latestRevision+1}. Earlier files will remain available.`;document.getElementById("editModeBanner").hidden=false;document.getElementById("submitButton").textContent="Save changes";activateFloorTab(floors.ground?"ground":"first");state.suppressDraftUntilInput=false;saveDraftNow();window.scrollTo({top:0,behavior:"smooth"});
}

function setOrderDetails(p){
  document.getElementById("orderDate").value=p.orderDate||todayLocal();document.getElementById("accountReference").value=p.reference||p.customerReference||"BPS BRUNSW17";document.getElementById("customerName").value=p.customer||p.jobName||"BPS Brunswick Plastering Services";document.getElementById("contactName").value=p.contact||p.siteContact||"";document.getElementById("contactMobile").value=p.mobile||p.siteContactPhone||"";document.getElementById("deliveryAddress").value=p.deliveryAddress||p.siteAddress1||"";document.getElementById("deliveryInstructions").value=p.deliveryInstructions||p.comments||"";document.getElementById("requiredDate").value=p.requiredDate||"";document.getElementById("requiredTime").value=p.requiredTime||"";
  setRadio("timeSlot",p.timeSlot||"ANY");setRadio("deliveryType",p.deliveryType||"");document.querySelectorAll('input[name="deliveryExtra"]').forEach((field)=>{field.checked=(p.extras||[]).includes(field.value);});updatePickupAddressRequirement();
}
function setRadio(name,value){document.querySelectorAll(`input[name="${name}"]`).forEach((f)=>{f.checked=f.value===value;});}
function cancelEdit(){resetOrderForm();clearMessage();document.getElementById("successPanel").hidden=true;}
function resetOrderForm(){state.editingOrder=null;clearProductSelections();clearOrderDetails();activateFloorTab("ground");document.getElementById("editModeBanner").hidden=true;document.getElementById("editOrderNumber").textContent="";document.getElementById("editRevisionText").textContent="";document.getElementById("submitButton").textContent="Submit order";clearSavedDraft({statusText:"Form cleared."});state.suppressDraftUntilInput=true;}
function clearOrderDetails(){document.getElementById("orderDate").value=todayLocal();document.getElementById("accountReference").value="BPS BRUNSW17";document.getElementById("customerName").value="BPS Brunswick Plastering Services";["contactName","contactMobile","deliveryAddress","deliveryInstructions","requiredDate","requiredTime"].forEach((id)=>document.getElementById(id).value="");setRadio("timeSlot","ANY");setRadio("deliveryType","");document.querySelectorAll('input[name="deliveryExtra"]').forEach((f)=>f.checked=false);updatePickupAddressRequirement();}
function clearProductSelections(){document.querySelectorAll(".quantity-input,.other-material-quantity").forEach((f)=>f.value="");document.querySelectorAll("[data-other-material-description]").forEach((f)=>f.value="");["ground","first"].forEach((floor)=>{setRadio(`${floor}AcousticFormat`,"Roll");updateFloorCount(floor);});}

async function changeOrderArchiveStatus(submissionId,orderNumber,action){const verb=action==="archive"?"archive":"restore";if(action==="archive"&&!window.confirm(`Archive ${orderNumber}? The order and files will remain available.`))return;try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{method:"PATCH",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action})});const result=await response.json().catch(()=>({ok:false,error:`The order could not be ${verb}d.`}));if(!response.ok||!result.ok)throw new Error(result.error||`The order could not be ${verb}d.`);if(state.editingOrder?.submissionId===submissionId&&action==="archive")cancelEdit();await loadOrderHistory();}catch(error){showMessage(error.message||String(error),"error");}}
async function deleteOrder(submissionId,orderNumber){if(!window.confirm(`Permanently delete ${orderNumber}? This removes its order history and every generated file. This cannot be undone.`))return;const typed=window.prompt(`Type ${orderNumber} to confirm permanent deletion.`);if(typed!==orderNumber){showMessage("Deletion cancelled because the order number did not match.","error");return;}try{const response=await fetch(`/api/orders/${encodeURIComponent(submissionId)}`,{method:"DELETE",headers:{Accept:"application/json"}});const result=await response.json().catch(()=>({ok:false,error:"The order could not be deleted."}));if(!response.ok||!result.ok)throw new Error(result.error||"The order could not be deleted.");if(state.editingOrder?.submissionId===submissionId)cancelEdit();document.getElementById("successPanel").hidden=true;clearMessage();await loadOrderHistory();}catch(error){showMessage(error.message||String(error),"error");}}

function bindDraftPersistence(){window.addEventListener("beforeunload",()=>saveDraftNow({silent:true}));document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveDraftNow({silent:true});});}
function markDraftChanged(){state.suppressDraftUntilInput=false;scheduleDraftSave();}
function scheduleDraftSave(){if(state.isRestoringDraft||state.suppressDraftUntilInput)return;setDraftStatus("Saving draft…","saving");window.clearTimeout(state.draftSaveTimer);state.draftSaveTimer=window.setTimeout(()=>saveDraftNow(),180);}
function saveDraftNow(options={}){if(state.isRestoringDraft||state.suppressDraftUntilInput||!state.layout)return;window.clearTimeout(state.draftSaveTimer);const draft=collectDraft();if(!draftHasContent(draft)){try{localStorage.removeItem(DRAFT_STORAGE_KEY);}catch{}if(!options.silent)setDraftStatus("Changes save automatically on this device.","idle");return;}try{localStorage.setItem(DRAFT_STORAGE_KEY,JSON.stringify(draft));if(!options.silent)setDraftStatus(`Draft saved ${formatDraftTime(draft.updatedAt)}.`,"saved");}catch{if(!options.silent)setDraftStatus("Draft saving is unavailable in this browser.","error");}}
function collectDraft(){const floors={};["ground","first"].forEach((floor)=>{const quantities={};document.querySelectorAll(`.quantity-input[data-floor="${floor}"]`).forEach((f)=>{const value=Number(f.value||0);if(Number.isInteger(value)&&value>0&&value<=999)quantities[f.dataset.productKey]=value;});floors[floor]={quantities,otherMaterials:getOtherMaterials(floor),acousticFormat:selectedRadioValue(`${floor}AcousticFormat`)||"Roll"};});return{version:DRAFT_VERSION,updatedAt:new Date().toISOString(),activeFloor:state.activeFloor,editingOrder:state.editingOrder,details:getOrderDetails(),floors};}
function draftHasContent(draft){const d=draft.details||{};if(draft.editingOrder)return true;if(d.contact||d.mobile||d.deliveryAddress||d.deliveryInstructions||d.requiredDate||d.requiredTime||d.deliveryType||(d.extras||[]).length)return true;return Object.values(draft.floors||{}).some((f)=>Object.keys(f.quantities||{}).length||(f.otherMaterials||[]).length);}
function restoreDraft(){let draft;try{const raw=localStorage.getItem(DRAFT_STORAGE_KEY);if(!raw){setDraftStatus("Changes save automatically on this device.","idle");return;}draft=JSON.parse(raw);}catch{setDraftStatus("The previous browser draft could not be read.","error");return;}if(!draft||draft.version!==DRAFT_VERSION){clearSavedDraft();return;}state.isRestoringDraft=true;try{setOrderDetails(draft.details||{});["ground","first"].forEach((floor)=>{const f=draft.floors?.[floor]||{};Object.entries(f.quantities||{}).forEach(([key,q])=>{const field=document.querySelector(`.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(key)}"]`);if(field)field.value=String(q);});(f.otherMaterials||[]).forEach((item,index)=>{const d=document.querySelector(`[data-other-material-description="${floor}"][data-other-material-index="${index}"]`);const q=document.querySelector(`[data-other-material-quantity="${floor}"][data-other-material-index="${index}"]`);if(d)d.value=item.description||"";if(q)q.value=String(item.quantity||"");});setRadio(`${floor}AcousticFormat`,f.acousticFormat||"Roll");});state.editingOrder=draft.editingOrder||null;if(state.editingOrder){document.getElementById("editOrderNumber").textContent=state.editingOrder.orderNumber||"";document.getElementById("editRevisionText").textContent=`Saving will create Revision ${(state.editingOrder.latestRevision||0)+1}. Earlier files will remain available.`;document.getElementById("editModeBanner").hidden=false;document.getElementById("submitButton").textContent="Save changes";}activateFloorTab(["ground","first"].includes(draft.activeFloor)?draft.activeFloor:"ground");updateAllFloorCounts();state.suppressDraftUntilInput=false;setDraftStatus(`Draft restored from ${formatDraftTime(draft.updatedAt)}.`,"restored");}finally{state.isRestoringDraft=false;}}
function clearSavedDraft(options={}){window.clearTimeout(state.draftSaveTimer);try{localStorage.removeItem(DRAFT_STORAGE_KEY);}catch{}if(options.statusText)setDraftStatus(options.statusText,"saved");}
function setDraftStatus(text,status){const e=document.getElementById("draftStatus");if(!e)return;e.textContent=text;e.dataset.status=status||"idle";}
function formatDraftTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return"recently";return new Intl.DateTimeFormat("en-AU",{hour:"numeric",minute:"2-digit"}).format(date);}
function focusNextQuantityField(floor,current,direction){const fields=Array.from(document.querySelectorAll(`[data-floor-panel="${floor}"] .quantity-input, [data-floor-panel="${floor}"] .other-material-quantity`));const index=fields.indexOf(current);const next=fields[index+direction];if(!next)return;next.focus();next.select();next.scrollIntoView({block:"nearest",inline:"nearest"});}

function todayLocal(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}
function formatHistoryDate(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value||"");return new Intl.DateTimeFormat("en-AU",{dateStyle:"medium",timeStyle:"short"}).format(date);}
function cssEscape(value){return window.CSS?.escape?window.CSS.escape(String(value)):String(value).replace(/(["\\])/g,"\\$1");}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}
function showMessage(text,type){const message=document.getElementById("formMessage");message.textContent=text;message.className=`message message-${type}`;message.hidden=false;}
function clearMessage(){const message=document.getElementById("formMessage");message.hidden=true;message.textContent="";message.className="message";}
