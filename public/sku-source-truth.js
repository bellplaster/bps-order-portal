(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__skuSourceTruth) return;

  const BOARD_SKUS = {
    "SHEETROCK ONE|10 mm|1200|6000": "10SR1260",
    "SHEETROCK ONE|10 mm|1350|6000": "10SR1360",
    "SHEETROCK ONE|13 mm|1200|6000": "13HD1260",
    "SHEETROCK ONE|10 mm|1200|4800": "10SR1248",
    "SHEETROCK ONE|10 mm|1350|4800": "10SR1348",
    "SHEETROCK ONE|13 mm|1200|4800": "13HD1248",
    "SHEETROCK ONE|13 mm|1350|4800": "13HD1348",
    "SHEETROCK PLUS|10 mm|1200|4800": "10SRP1248",
    "SHEETROCK PLUS|10 mm|1350|4800": "10SRP1348",
    "SHEETROCK ONE|10 mm|1200|4200": "10SR1242",
    "SHEETROCK ONE|10 mm|1350|4200": "10SR1342",
    "SHEETROCK ONE|13 mm|1200|4200": "13HD1242",
    "SHEETROCK PLUS|10 mm|1200|4200": "10SRP1242",
    "SHEETROCK ONE|10 mm|1200|3600": "10SR1236",
    "SHEETROCK ONE|10 mm|1350|3600": "10SR1336",
    "SHEETROCK ONE|13 mm|1200|3600": "13HD1236",
    "SHEETROCK ONE|13 mm|1350|3600": "13HD1336",
    "SHEETROCK PLUS|10 mm|1200|3600": "10SRP1236",
    "SHEETROCK PLUS|10 mm|1350|3600": "10SRP1336",
    "WETSTOP|13 mm|1200|3000": "13WA1230",
    "WETSTOP|13 mm|1350|3000": "13WA1330",
    "FIRESTOP|13 mm|1200|3600": "13FS1236",
    "FIRESTOP|13 mm|1350|3600": "13FS1336",
    "FIRESTOP|16 mm|1200|3600": "16FS1236",
    "IMPACTSTOP|13 mm|1200|3600": "13IMP1236",
    "IMPACTSTOP|13 mm|1350|3600": "13IMP1336",
    "MULTISTOP ONE|13 mm|1200|3600": "13MSO1236",
    "MULTISTOP ONE|16 mm|1200|3600": "16MSO1236",
    "MULTISTOP ONE HI|13 mm|1200|3600": "13MSOH1236",
    "FLEXIBOARD|6.5 mm|1200|3600": "06RB1236",
    "VILLABOARD|6 mm|1200|3600": "6V1236",
    "VILLABOARD|6 mm|1350|3600": "6V1336",
    "SHEETROCK ONE|10 mm|1200|3000": "10SR1230",
    "SHEETROCK ONE|10 mm|1350|3000": "10SR1330",
    "SHEETROCK ONE|13 mm|1200|3000": "13HD1230",
    "SHEETROCK ONE|13 mm|1350|3000": "13HD1330",
    "SHEETROCK PLUS|10 mm|1200|3000": "10SRP1230",
    "FIRESTOP|13 mm|1200|3000": "13FS1230",
    "FIRESTOP|16 mm|1200|3000": "16FS1230",
    "FIRESTOP|16 mm|1350|3000": "16FS1330",
    "VILLABOARD|6 mm|1200|3000": "6V1230",
    "VILLABOARD|6 mm|1350|3000": "6V1330",
    "SHEETROCK ONE|13 mm|1200|2700": "13HD1227",
    "FIRESTOP|13 mm|1200|2700": "13FS1227",
    "VILLABOARD|6 mm|1200|2700": "6V1227",
    "SHEETROCK ONE|10 mm|1200|2400": "10SR1224",
    "SHEETROCK ONE|13 mm|1200|2400": "13HD1224",
    "SHEETROCK PLUS|10 mm|1200|2400": "10SRP1224",
    "FIRESTOP|16 mm|1200|2400": "16FS1224",
    "VILLABOARD|6 mm|1200|2400": "6V1224",
    "VILLABOARD|6 mm|1350|2400": "6V1324"
  };

  const LISTS = {
    compounds: [
      ["BaseCote 45", "20 kg", "BC4520"],
      ["BaseCote 60", "20 kg", "BC6020"],
      ["BaseCote 90", "20 kg", "BC9020"],
      ["Uniflott", "5 kg", "40007195"],
      ["Redibase", "18 kg", "REDIBASE"],
      ["All Purpose Premix", "18 kg", "LCOTE18"],
      ["LiteFinish", "18 kg", "LFINISH18"],
      ["FinalCote", "20 kg", "FCOTE20"],
      ["Cornice Adhesive 45", "20 kg", "CAN4520"],
      ["Cornice Adhesive 60", "20 kg", "CAN6020"],
      ["Cornice Adhesive 90", "20 kg", "CAN9020"],
      ["Masonry Adhesive", "20 kg", "CMASON20"],
      ["Back-Block Adhesive", "20 kg", "BBADHESIVE20"],
      ["Casting Plaster", "20 kg", "CAST20"],
      ["Firesound Sausage", "600 ml", "6026194133"]
    ],
    accessories: [
      ["Stud Adhesive", "5.2 kg", "SADHPB5.2KG"],
      ["Paper Tape", "75 m", "5PT75S"],
      ["Paper Tape", "150 m", "15-610"],
      ["Fibreglass Tape", "90 m", "EASYTAPE90M"]
    ],
    decorative: [
      ["Cairo 3 Step 75 mm", "", "75C42DCCAIRO3S"],
      ["New York 90 mm", "", "90C42DCNY"],
      ["Sydney 90 mm", "", "90C42DCSYDNEY"],
      ["Manly 75 mm", "", "75C42DCMANLY"]
    ],
    partiwallExtra: [
      ["Aluminium Clips Angled (each)", "", "RPWALLCLIP"],
      ["Aluminium Clips Flat (each)", "", "__UNAVAILABLE__"],
      ["50mm Partiwall Batt (3 Pack)", "", "IIPWBATT"],
      ["16mm Small Head DP", "", "LS55"],
      ["25mm Coarse NP", "", "NPBUZYCO725-PWR"],
      ["32mm Coarse NP", "", "NPBUZYCO732-PWR"],
      ["38mm Laminating", "", "LAMZ1038500"]
    ]
  };

  const SCREW_SKUS = {
    "LOOSE|NEEDLE POINT (S)|25 MM": "NPBUZYF0625-PWR",
    "LOOSE|NEEDLE POINT (S)|32 MM": "NPBUZYF0632-PWR",
    "LOOSE|COARSE (W)|25 MM": "NPBUZYCO725-PWR",
    "LOOSE|COARSE (W)|32 MM": "NPBUZYCO732-PWR",
    "COLLATED|NEEDLE POINT (S)|25 MM": "CNPBUZYF0625-PWR",
    "COLLATED|NEEDLE POINT (S)|32 MM": "CNPBUZYF0632-PWR",
    "COLLATED|COARSE (W)|25 MM": "CNPBUZYC0632-PWR",
    "COLLATED|COARSE (W)|32 MM": "CNPBUZYC0632-PWR"
  };

  const RONDO_SKUS = {
    "P01 EXTERNAL ANGLE 90°|2400": "P0102400",
    "P01 EXTERNAL ANGLE 90°|2700": "P0102700",
    "P01 EXTERNAL ANGLE 90°|3000": "P0103000",
    "P01 EXTERNAL ANGLE 90°|3600": "P0103600",
    "P01A EXTERNAL ANGLE 135°|2400": "P01A2400",
    "P01A EXTERNAL ANGLE 135°|2700": "P01A2700",
    "P01A EXTERNAL ANGLE 135°|3000": "P01A3000",
    "P01A EXTERNAL ANGLE 135°|3600": "P01A3600",
    "PS17 INTERNAL ANGLE 90°|2400": "PS172400",
    "PS17 INTERNAL ANGLE 90°|2700": "PS172700",
    "PS17 INTERNAL ANGLE 90°|3000": "PS173000",
    "PS17 INTERNAL ANGLE 90°|3600": "PS173600",
    "PSIA INTERNAL ANGLE 135°|2400": "PA13524",
    "PSIA INTERNAL ANGLE 135°|2700": "PA13527",
    "PSIA INTERNAL ANGLE 135°|3000": "PA13530",
    "PSIA INTERNAL ANGLE 135°|3600": "PA13536",
    "P18 INT|2400": "P1802400",
    "P40 INT|1800": "P4001800",
    "PVC CASING BEAD 10 MM|3000": "PCB1030",
    "BATTENS NAIL UP|6000": "30106000"
  };

  const COVE_SKUS = {
    "4800|55 MM": "55C48",
    "4800|75 MM": "75C48",
    "4800|90 MM": "90C48"
  };

  const THERMAL_SKUS = {
    "WALL|2.0 90MM|430 MM": "4006093",
    "WALL|2.0 90MM|580 MM": "4006094",
    "WALL|2.5 HD 90MM|430 MM": "4006071",
    "WALL|2.5 HD 90MM|580 MM": "4006072",
    "CEILING|3|430 MM": "4006100",
    "CEILING|3|580 MM": "4006101",
    "CEILING|3.5|430 MM": "4006102",
    "CEILING|3.5|580 MM": "4006103"
  };

  const ACOUSTIC_SKUS = {
    "11|75|450 MM": "4006007",
    "11|75|600 MM": "4006009",
    "11|90|450 MM": "4006011",
    "11|90|600 MM": "4006013",
    "14|75|450 MM": "4005951",
    "14|75|600 MM": "4005953",
    "14|90|450 MM": "4005957",
    "14|90|600 MM": "4005959"
  };

  const PARTIWALL_SKUS = {
    "SHAFTLINER MOULDSTOP 25 MM|3000": "25SW0630",
    "SHAFTLINER MOULDSTOP 25 MM|3600": "25SW0636",
    "H-SECTION 25 MM|3000": "R25HS3055",
    "H-SECTION 25 MM|3600": "R25HS3655",
    "140 WALL TRACK (J)|3000": "14003000"
  };

  let appliedLayout = null;

  const sourceTruthRenderer = function renderWithSkuSourceTruth(floor, ...args) {
    applySourceTruth();
    const result = previousRenderer.call(this, floor, ...args);
    patchRenderedCatalogue(floor);
    return result;
  };
  sourceTruthRenderer.__skuSourceTruth = true;
  window.renderUnifiedFloorSheet = sourceTruthRenderer;

  function applySourceTruth() {
    if (!state?.layout || appliedLayout === state.layout) return;
    appliedLayout = state.layout;
    if (!state.catalog) state.catalog = {};

    applyMainBoards();
    applySpecialtyBoards();
    applyVillaboard();
    applyCompoundsAndAccessories();
    applyFasteners();
    applyRondo();
    applyCornices();
    applyInsulation();
    applyPartiwall();
  }

  function applyMainBoards() {
    const definition = state.layout.mainBoard;
    if (!definition) return;
    let columnIndex = 0;
    (definition.groups || []).forEach((group) => {
      const span = Number(group.span || 0);
      const product = canonicalProduct(group.group);
      const thickness = canonicalThickness(group.subgroup);
      for (let offset = 0; offset < span; offset += 1) {
        const sourceIndex = columnIndex + offset;
        const width = String(definition.columns?.[sourceIndex]?.variant || "").replace(/\s*mm$/i, "").trim();
        (definition.rows || []).forEach((row) => {
          const signature = `${product}|${thickness}|${width}|${String(row.length)}`;
          const sku = BOARD_SKUS[signature];
          row.cells[sourceIndex] = sku
            ? assignKey(row.cells[sourceIndex], `board-${signature}`, sku, `${product} ${thickness} ${width} x ${row.length}`)
            : null;
        });
      }
      columnIndex += span;
    });
    definition.rows = (definition.rows || []).filter((row) => String(row.length) !== "1800");
  }

  function applySpecialtyBoards() {
    (state.layout.specialtyBoards || []).forEach((group) => {
      const product = canonicalProduct(group.title);
      group.rows = (group.rows || []).filter((row) => {
        const dims = parseDimensions(`${row.label || ""} ${row.detail || ""}`);
        if (!dims) return false;
        const signature = `${product}|${canonicalThickness(dims.thickness)}|${dims.width}|${dims.length}`;
        const sku = BOARD_SKUS[signature];
        if (!sku) return false;
        row.key = assignKey(row.key, `board-${signature}`, sku, `${product} ${dims.thickness} ${dims.width} x ${dims.length}`);
        return true;
      });
    });
  }

  function applyVillaboard() {
    const entry = Object.values(state.layout.sections || {}).find((section) => /villaboard/i.test(String(section?.title || "")));
    if (!entry) return;
    const widths = (entry.columns || []).map((value) => String(value).replace(/\s*mm$/i, "").trim());
    (entry.rows || []).forEach((row) => {
      const length = String(row.label ?? row.length ?? "");
      row.cells = widths.map((width, index) => {
        const signature = `VILLABOARD|6 mm|${width}|${length}`;
        const sku = BOARD_SKUS[signature];
        return sku ? assignKey(row.cells?.[index], `board-${signature}`, sku, `Villaboard 6 mm ${width} x ${length}`) : null;
      });
    });
    entry.rows = (entry.rows || []).filter((row) => String(row.label ?? row.length ?? "") !== "1800");
  }

  function applyCompoundsAndAccessories() {
    const section = state.layout.sections?.compounds;
    if (!section) return;
    const desired = [...LISTS.compounds, ...LISTS.accessories];
    section.rows = desired.map(([label, detail, sku]) => {
      const found = findListRow(section.rows, label, detail);
      const key = assignKey(found?.key, `list-${sku}`, sku, label, detail);
      return { ...(found || {}), label, detail, key };
    });
  }

  function applyFasteners() {
    const screws = state.layout.sections?.screws;
    if (screws) {
      const columns = (screws.columns || ["25 mm", "32 mm"]).map((value) => canonical(value));
      const desiredRows = [
        ["Loose - Needle Point (S)", "LOOSE", "NEEDLE POINT (S)"],
        ["Loose - Coarse (W)", "LOOSE", "COARSE (W)"],
        ["Collated - Needle Point (S)", "COLLATED", "NEEDLE POINT (S)"],
        ["Collated - Coarse (W)", "COLLATED", "COARSE (W)"]
      ];
      screws.rows = desiredRows.map(([label, group, item]) => {
        const found = (screws.rows || []).find((row) => canonical(row.label) === canonical(label));
        const cells = columns.map((column, index) => {
          const sku = SCREW_SKUS[`${group}|${item}|${column}`];
          return assignKey(found?.cells?.[index], `screw-${group}-${item}-${column}`, sku, `${group === "LOOSE" ? "Loose" : "Collated"} ${item}`, column);
        });
        return { ...(found || {}), label, cells };
      });
    }

    const nails = state.layout.sections?.nails;
    if (nails) {
      const found = (nails.rows || []).find((row) => /zinc r\/s 2\.5 kg/i.test(String(row.label || "")));
      nails.columns = ["30 mm", "40 mm"];
      nails.rows = [{
        ...(found || {}),
        label: "Zinc R/S 2.5 kg",
        cells: [
          assignKey(found?.cells?.[0], "nail-zinc-30", "PLAD3028Y", "Zinc R/S 2.5 kg", "30 mm"),
          null
        ]
      }];
    }
  }

  function applyRondo() {
    const section = state.layout.sections?.rondo;
    if (!section) return;
    const desired = [];
    Object.entries(RONDO_SKUS).forEach(([signature, sku]) => {
      const [label, length] = signature.split("|");
      const found = (section.rows || []).find((row) =>
        canonical(row.label) === label && String(row.detail || "").match(/\d+/)?.[0] === length
      );
      desired.push({
        ...(found || {}),
        label: displayRondoLabel(label),
        detail: `${length} mm`,
        key: assignKey(found?.key, `rondo-${signature}`, sku, displayRondoLabel(label), `${length} mm`)
      });
    });
    section.rows = desired;
  }

  function applyCornices() {
    const cove = state.layout.sections?.cove;
    if (cove) {
      const widths = (cove.columns || ["55 mm", "75 mm", "90 mm"]).map((value) => canonical(value));
      const found = (cove.rows || []).find((row) => String(row.label || "") === "4800");
      cove.rows = [{
        ...(found || {}),
        label: "4800",
        cells: widths.map((width, index) => {
          const sku = COVE_SKUS[`4800|${width}`];
          return assignKey(found?.cells?.[index], `cove-4800-${width}`, sku, "Sheetrock® Cove", `4800 · ${width}`);
        })
      }];
    }

    const decorative = state.layout.sections?.decorative;
    if (decorative) {
      decorative.rows = LISTS.decorative.map(([label, detail, sku]) => {
        const found = findListRow(decorative.rows, label, detail);
        return { ...(found || {}), label, detail, key: assignKey(found?.key, `cornice-${sku}`, sku, label, "4200 mm") };
      });
    }
  }

  function applyInsulation() {
    const section = state.layout.sections?.insulation;
    if (!section) return;
    const thermalDefs = [
      ["Wall R2.0", "Wall", "2.0 90mm"],
      ["Wall R2.5", "Wall", "2.5 HD 90mm"],
      ["Ceiling R3.0", "Ceiling", "3"],
      ["Ceiling R3.5", "Ceiling", "3.5"]
    ];
    const thermalWidths = ["430 MM", "580 MM"];
    section.thermalRows = thermalDefs.map(([label, type, rating]) => {
      const found = (section.thermalRows || []).find((row) => canonical(row.label).startsWith(canonical(label)));
      return {
        ...(found || {}),
        label,
        detail: rating,
        cells: thermalWidths.map((width, index) => {
          const sku = THERMAL_SKUS[`${canonical(type)}|${canonical(rating)}|${width}`];
          return assignKey(found?.cells?.[index], `thermal-${type}-${rating}-${width}`, sku, `${type} ${rating}`, width);
        })
      };
    });

    const acousticDefs = [["11", "75"], ["11", "90"], ["14", "75"], ["14", "90"]];
    section.acousticRows = acousticDefs.map(([kg, mm]) => {
      const found = (section.acousticRows || []).find((row) => {
        const match = String(row.label || "").match(/(\d+).*?(\d+)/);
        return match?.[1] === kg && match?.[2] === mm;
      });
      return {
        ...(found || {}),
        label: `${kg} kg - ${mm} mm`,
        cells: ["450 MM", "600 MM"].map((width, index) => {
          const sku = ACOUSTIC_SKUS[`${kg}|${mm}|${width}`];
          return assignKey(found?.cells?.[index], `acoustic-${kg}-${mm}-${width}`, sku, `${kg} kg ${mm} mm Acoustic`, width);
        })
      };
    });
  }

  function applyPartiwall() {
    const matrix = state.layout.sections?.partiwall;
    if (matrix) {
      matrix.columns = ["3000", "3600"];
      const rows = [
        ["Shaftliner® MouldStop 25 mm", "SHAFTLINER MOULDSTOP 25 MM"],
        ["H-Section 25 mm", "H-SECTION 25 MM"],
        ["140 Wall Track (J)", "140 WALL TRACK (J)"]
      ];
      matrix.rows = rows.map(([label, signatureLabel]) => {
        const found = (matrix.rows || []).find((row) => canonical(row.label) === signatureLabel);
        return {
          ...(found || {}),
          label,
          cells: ["3000", "3600"].map((length, index) => {
            const sku = PARTIWALL_SKUS[`${signatureLabel}|${length}`];
            return sku ? assignKey(found?.cells?.[index], `partiwall-${signatureLabel}-${length}`, sku, label, length) : null;
          })
        };
      });
    }

    const accessories = state.layout.sections?.partiwall_accessories;
    const screws = state.layout.sections?.partiwall_screws;
    const originalRows = [...(accessories?.rows || []), ...(screws?.rows || [])];
    const desiredRows = LISTS.partiwallExtra.map(([label, detail, sku]) => {
      const found = findListRow(originalRows, label, detail);
      if (sku === "__UNAVAILABLE__") {
        return { ...(found || {}), label: "Aluminium Clips Flat\u200B (each)", detail, key: assignKey(found?.key, "partiwall-flat-unavailable", sku, label, detail), sourceUnavailable: true };
      }
      return { ...(found || {}), label, detail, key: assignKey(found?.key, `partiwall-${sku}`, sku, label, detail) };
    });
    if (accessories) accessories.rows = desiredRows.slice(0, 4);
    if (screws) screws.rows = desiredRows.slice(4);
  }

  function patchRenderedCatalogue(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    if (!root) return;

    const fastenerTable = root.querySelector(".fasteners-table");
    if (fastenerTable) {
      const rows = [...fastenerTable.querySelectorAll("tbody > tr")];
      const screwsHeader = rows.find((row) => canonical(row.textContent).startsWith("SCREWS"));
      screwsHeader?.remove();
      rows.forEach((row) => {
        const text = canonical(row.textContent);
        if (text === "LOOSE") replaceHeaderRow(row, "Loose Screws", ["25 mm", "32 mm"]);
        if (text === "COLLATED") replaceHeaderRow(row, "Collated Screws", ["25 mm", "32 mm"]);
      });
    }

    const partiwallRows = [...root.querySelectorAll(".partiwall-table tbody tr")];
    partiwallRows.forEach((row) => {
      if (!row.textContent.includes("Aluminium Clips Flat")) return;
      const heading = row.querySelector("th");
      if (heading) heading.textContent = "Aluminium Clips Flat (each)";
      const cell = row.querySelector("td");
      if (cell) {
        cell.replaceChildren();
        cell.className = "quantity-cell is-unavailable";
        cell.style.background = "#aeb4b4";
      }
    });

    const insulationRows = root.querySelectorAll(".insulation-table tbody tr:not(.lower-matrix-header)");
    const ratings = ["2.0 90mm", "2.5 HD 90mm", "3", "3.5"];
    insulationRows.forEach((row, index) => {
      const detail = row.querySelector(".lower-item-detail");
      if (detail && ratings[index]) detail.textContent = ratings[index];
    });
  }

  function replaceHeaderRow(row, title, columns) {
    row.replaceChildren();
    row.className = "lower-subheader lower-matrix-header";
    [title, ...columns].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      row.append(th);
    });
  }

  function assignKey(existingKey, fallback, sku, label, detail = "") {
    if (!sku) return null;
    const key = existingKey || `source-${slug(fallback)}`;
    const existing = state.catalog[key] || {};
    state.catalog[key] = {
      ...existing,
      key,
      sku,
      stockCode: sku,
      label: label || existing.label || sku,
      description: label || existing.description || sku,
      detail: detail || existing.detail || "",
      mapped: true,
      available: sku !== "__UNAVAILABLE__"
    };
    return key;
  }

  function findListRow(rows, label, detail) {
    const target = canonicalLabel(label);
    const targetDetail = canonical(detail);
    return (rows || []).find((row) =>
      canonicalLabel(row.label) === target && (!targetDetail || canonical(row.detail) === targetDetail)
    );
  }

  function canonicalLabel(value) {
    return canonical(String(value || "").replace(/\s*\([^)]*(?:lid|pack)[^)]*\)\s*/gi, "").replace(/\u200B/g, ""));
  }

  function canonical(value) {
    return String(value || "")
      .replace(/[®™]/g, "")
      .replace(/\u200B/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function canonicalProduct(value) {
    return canonical(value);
  }

  function canonicalThickness(value) {
    const text = String(value || "").trim();
    const number = text.match(/\d+(?:\.\d+)?/)?.[0] || text;
    return `${number} mm`;
  }

  function parseDimensions(value) {
    const match = String(value || "").replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*mm.*?(\d{4})\s*mm\s*x\s*(\d{4})\s*mm/i);
    return match ? { thickness: `${match[1]} mm`, width: match[2], length: match[3] } : null;
  }

  function displayRondoLabel(label) {
    const labels = {
      "P01 EXTERNAL ANGLE 90°": "P01 External Angle 90°",
      "P01A EXTERNAL ANGLE 135°": "P01A External Angle 135°",
      "PS17 INTERNAL ANGLE 90°": "PS17 Internal Angle 90°",
      "PSIA INTERNAL ANGLE 135°": "PSIA Internal Angle 135°",
      "P18 INT": "P18 Int",
      "P40 INT": "P40 Int",
      "PVC CASING BEAD 10 MM": "PVC Casing Bead 10 mm",
      "BATTENS NAIL UP": "Battens Nail Up"
    };
    return labels[label] || label;
  }

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
})();