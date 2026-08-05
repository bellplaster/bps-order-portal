import { ORDER_FORM_LAYOUT, PRODUCT_CATALOG } from "./catalog.js";

export const ORDER_VIEW_SCHEMA_VERSION = 1;

export function parseOrderPayload(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function createOrderViewSnapshot({
  payload,
  orderDetails = null,
  areas = null,
  capturedAt = null,
  layout = ORDER_FORM_LAYOUT,
  layoutSource = "submitted",
} = {}) {
  const source = parseOrderPayload(payload);
  const sourceAreas = areas && typeof areas === "object" && !Array.isArray(areas)
    ? areas
    : source.floors || {};
  const details = normaliseDetails(orderDetails || source);
  const normalisedAreas = Object.entries(sourceAreas).map(([id, area], index) => normaliseArea(id, area, index));
  const totals = calculateTotals(normalisedAreas);

  return {
    schemaVersion: ORDER_VIEW_SCHEMA_VERSION,
    capturedAt: String(capturedAt || source.createdAt || ""),
    layoutSource,
    layout: cloneJson(layout || ORDER_FORM_LAYOUT),
    activeArea: normalisedAreas.some((area) => area.id === source.activeArea)
      ? source.activeArea
      : normalisedAreas[0]?.id || "",
    details,
    areas: normalisedAreas,
    totals,
  };
}

export function resolveOrderViewSnapshot(payload, order = {}) {
  const source = parseOrderPayload(payload);
  const stored = source.viewSnapshot;
  if (stored && Number(stored.schemaVersion) === ORDER_VIEW_SCHEMA_VERSION) {
    const normalised = normaliseStoredSnapshot(stored);
    return {
      ...normalised,
      capturedAt: normalised.capturedAt || String(order.created_at || order.createdAt || ""),
      layoutSource: stored.layout ? "submitted" : "current",
      layout: cloneJson(stored.layout || ORDER_FORM_LAYOUT),
    };
  }

  return createOrderViewSnapshot({
    payload: source,
    capturedAt: order.created_at || order.createdAt || "",
    layout: ORDER_FORM_LAYOUT,
    layoutSource: "current",
  });
}

export function snapshotToOrderPayload(snapshot) {
  const resolved = normaliseStoredSnapshot(snapshot || {});
  const floors = {};
  resolved.areas.forEach((area) => {
    floors[area.id] = {
      label: area.label,
      shortCode: area.shortCode,
      acousticFormat: area.acousticFormat,
      items: area.items.map((item) => ({ key: item.key, quantity: item.quantity })),
      otherMaterials: area.otherMaterials.map((item) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
      })),
      otherProducts: area.otherProducts,
    };
  });

  return {
    reference: resolved.details.reference,
    customer: resolved.details.customer,
    contact: resolved.details.contact,
    mobile: resolved.details.mobile,
    requiredDate: resolved.details.requiredDate,
    timeSlot: resolved.details.timeSlot,
    deliveryType: resolved.details.deliveryType,
    extras: [...resolved.details.extras],
    deliveryAddress: resolved.details.deliveryAddress,
    addressLine1: resolved.details.addressLine1,
    addressLine2: resolved.details.addressLine2,
    deliveryInstructions: resolved.details.deliveryInstructions,
    activeArea: resolved.activeArea,
    floors,
  };
}

export function summariseOrderPayload(payload) {
  const source = parseOrderPayload(payload);
  if (source.viewSnapshot && Number(source.viewSnapshot.schemaVersion) === ORDER_VIEW_SCHEMA_VERSION) {
    const totals = source.viewSnapshot.totals || calculateTotals(source.viewSnapshot.areas || []);
    return normaliseTotals(totals);
  }

  const areas = Object.entries(source.floors || {}).map(([id, area], index) => normaliseArea(id, area, index));
  return calculateTotals(areas);
}

function normaliseStoredSnapshot(snapshot) {
  const areas = Array.isArray(snapshot?.areas)
    ? snapshot.areas.map((area, index) => normaliseArea(area?.id || `area-${index + 1}`, area, index, true))
    : [];
  return {
    schemaVersion: ORDER_VIEW_SCHEMA_VERSION,
    capturedAt: String(snapshot?.capturedAt || ""),
    layoutSource: String(snapshot?.layoutSource || "submitted"),
    layout: cloneJson(snapshot?.layout || ORDER_FORM_LAYOUT),
    activeArea: areas.some((area) => area.id === snapshot?.activeArea)
      ? snapshot.activeArea
      : areas[0]?.id || "",
    details: normaliseDetails(snapshot?.details || {}),
    areas,
    totals: calculateTotals(areas),
  };
}

function normaliseDetails(source) {
  return {
    reference: clean(source?.reference || source?.customerReference),
    customer: clean(source?.customer || source?.companyName),
    contact: clean(source?.contact || source?.siteContact),
    mobile: clean(source?.mobile || source?.siteContactPhone),
    requiredDate: clean(source?.requiredDate || source?.required_date),
    timeSlot: clean(source?.timeSlot || source?.time_slot).toUpperCase(),
    deliveryType: clean(source?.deliveryType || source?.delivery_type),
    extras: Array.isArray(source?.extras) ? source.extras.map(clean).filter(Boolean) : [],
    deliveryAddress: clean(source?.deliveryAddress || source?.delivery_address),
    addressLine1: clean(source?.addressLine1 || source?.siteAddress1),
    addressLine2: clean(source?.addressLine2 || source?.siteAddress2),
    deliveryInstructions: clean(source?.deliveryInstructions || source?.comments),
  };
}

function normaliseArea(id, source, index, snapshotArea = false) {
  const area = source && typeof source === "object" ? source : {};
  const items = Array.isArray(area.items)
    ? area.items.map((item) => normaliseItem(item, snapshotArea)).filter((item) => item.quantity > 0 && item.key)
    : [];
  const otherMaterials = Array.isArray(area.otherMaterials)
    ? area.otherMaterials.map(normaliseAdditionalItem).filter((item) => item.quantity > 0 && item.sku)
    : [];

  return {
    id: clean(id) || `area-${index + 1}`,
    label: clean(area.label) || legacyAreaLabel(id, index),
    shortCode: clean(area.shortCode),
    acousticFormat: clean(area.acousticFormat),
    items,
    otherMaterials,
    otherProducts: clean(area.otherProducts),
  };
}

function normaliseItem(item, snapshotItem) {
  const key = clean(item?.key);
  const product = PRODUCT_CATALOG[key] || {};
  return {
    key,
    quantity: positiveInteger(item?.quantity),
    sku: clean(snapshotItem ? item?.sku : product.sku) || clean(item?.sku) || clean(product.sku),
    label: clean(snapshotItem ? item?.label : product.label) || clean(item?.label) || key,
    description: clean(snapshotItem ? item?.description : product.description) || clean(item?.description) || clean(product.description),
    section: clean(snapshotItem ? item?.section : product.section) || clean(item?.section) || clean(product.section) || "Products",
  };
}

function normaliseAdditionalItem(item) {
  return {
    sku: clean(item?.sku),
    description: clean(item?.description) || clean(item?.sku),
    quantity: positiveInteger(item?.quantity),
    section: "Additional products",
  };
}

function calculateTotals(areas) {
  let lineCount = 0;
  let unitCount = 0;
  (areas || []).forEach((area) => {
    [...(area.items || []), ...(area.otherMaterials || [])].forEach((item) => {
      if (positiveInteger(item?.quantity) < 1) return;
      lineCount += 1;
      unitCount += positiveInteger(item.quantity);
    });
  });
  return {
    areaCount: (areas || []).length,
    lineCount,
    unitCount,
  };
}

function normaliseTotals(value) {
  return {
    areaCount: positiveInteger(value?.areaCount),
    lineCount: positiveInteger(value?.lineCount),
    unitCount: positiveInteger(value?.unitCount),
  };
}

function positiveInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function legacyAreaLabel(id, index) {
  if (id === "ground") return "Ground Floor";
  if (id === "first") return "1st Floor";
  return `Area ${index + 1}`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
