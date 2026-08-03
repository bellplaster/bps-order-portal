/*
 * Minimal Accrivia XLSX generator for Cloudflare Pages Functions.
 *
 * Two formats are supported during the Accrivia transition:
 * - legacy: A Stock Code, B Description, C Quan
 * - site-area: A SiteArea / Grid, B Stock Code, C Description, D Quan
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function createAccriviaXlsx(data) {
  return createWorkbook(data, "legacy");
}

export function createAccriviaSiteAreaXlsx(data) {
  return createWorkbook(data, "site-area");
}

function createWorkbook(data, format) {
  const productRows = Array.isArray(data?.productRows) ? data.productRows : [];
  if (!productRows.length) {
    throw new Error("No verified Accrivia product rows were supplied.");
  }

  const columnCount = format === "site-area" ? 4 : 3;
  const finalRow = 11 + productRows.length;
  const sheetRows = buildSheetRows(data, productRows, format);
  const sheetXml =
    worksheetPrefix() +
    `<dimension ref="A1:${columnName(columnCount)}${finalRow}"/>` +
    sheetLayout(format) +
    `<sheetData>${sheetRows}</sheetData>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    "</worksheet>";

  const entries = [
    textEntry("[Content_Types].xml", contentTypesXml()),
    textEntry("_rels/.rels", rootRelationshipsXml()),
    textEntry("docProps/app.xml", appPropertiesXml()),
    textEntry("docProps/core.xml", corePropertiesXml()),
    textEntry("xl/workbook.xml", workbookXml()),
    textEntry("xl/_rels/workbook.xml.rels", workbookRelationshipsXml()),
    textEntry("xl/styles.xml", stylesXml()),
    textEntry("xl/worksheets/sheet1.xml", sheetXml),
  ];

  return {
    bytes: createStoreOnlyZip(entries),
    mimeType: XLSX_MIME,
    finalRow,
  };
}

function buildSheetRows(data, productRows, format) {
  const labels = [
    "Debtor Code",
    "Date",
    "Date Required",
    "Customer Order No",
    "Job Name",
    "Job Address Line 1",
    "Job Address Line 2",
    "Job Address Line 3",
    "Sales Rep Code",
  ];
  const values = [
    data.debtorCode,
    excelDateSerial(data.orderDate),
    excelDateSerial(data.requiredDate),
    data.orderNumber,
    data.jobName,
    data.addressLine1,
    data.addressLine2,
    data.addressLine3,
    data.salesRepCode,
  ];
  const rows = [];

  for (let row = 1; row <= 9; row += 1) {
    const valueCell = row === 2 || row === 3
      ? numberCell(`B${row}`, 3, values[row - 1])
      : textCell(`B${row}`, 2, values[row - 1]);
    rows.push(rowXml(row, 2, [textCell(`A${row}`, 1, labels[row - 1]), valueCell]));
  }

  if (format === "site-area") {
    rows.push(rowXml(11, 4, [
      textCell("A11", 5, "SiteArea / Grid"),
      textCell("B11", 5, "Stock Code"),
      textCell("C11", 5, "Description"),
      textCell("D11", 6, "Quan"),
    ]));
    productRows.forEach((product, index) => {
      const row = 12 + index;
      const hasTabLabel = String(product[0] || "").trim() !== "";
      const isNotesRow = String(product[1] || "").trim().toUpperCase() === "NOTES";
      rows.push(rowXml(row, 4, [
        textCell(`A${row}`, hasTabLabel ? 9 : 0, product[0]),
        textCell(`B${row}`, isNotesRow ? 7 : 0, product[1]),
        textCell(`C${row}`, isNotesRow ? 7 : 0, product[2]),
        numberCell(`D${row}`, isNotesRow ? 8 : 4, product[3]),
      ]));
    });
  } else {
    rows.push(rowXml(11, 3, [
      textCell("A11", 5, "Stock Code"),
      textCell("B11", 5, "Description"),
      textCell("C11", 6, "Quan"),
    ]));
    productRows.forEach((product, index) => {
      const row = 12 + index;
      const stockCode = String(product[0] || "").trim();
      const isNotesRow = stockCode.toUpperCase() === "NOTES";
      const isTabRow = /^TAB\s+\d+$/i.test(stockCode);
      const textStyle = isTabRow || isNotesRow ? 7 : 0;
      const quantityStyle = isTabRow || isNotesRow ? 8 : 4;
      rows.push(rowXml(row, 3, [
        textCell(`A${row}`, textStyle, product[0]),
        textCell(`B${row}`, textStyle, product[1]),
        numberCell(`C${row}`, quantityStyle, product[2]),
      ]));
    });
  }

  return rows.join("");
}

function worksheetPrefix() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">';
}

function sheetLayout(format) {
  const columns = format === "site-area"
    ? '<col min="1" max="2" width="20" customWidth="1"/>' +
      '<col min="3" max="4" width="10" customWidth="1"/>'
    : '<col min="1" max="2" width="20" customWidth="1"/>' +
      '<col min="3" max="3" width="10" customWidth="1"/>';
  return '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
    '<selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="0.25"/>' +
    `<cols>${columns}</cols>`;
}

function contentTypesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';
}

function rootRelationshipsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';
}

function workbookXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<bookViews><workbookView/></bookViews>' +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>' +
    '<calcPr calcId="191029"/></workbook>';
}

function workbookRelationshipsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
}

function stylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd-mm-yy"/></numFmts>' +
    '<fonts count="3">' +
    '<font><sz val="10"/><name val="Inter"/></font>' +
    '<font><b/><sz val="10"/><name val="Inter"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Inter"/></font>' +
    '</fonts>' +
    '<fills count="4">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFA62B45"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF006557"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

function appPropertiesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Bell Plaster Order Portal</Application></Properties>';
}

function corePropertiesXml() {
  const now = new Date().toISOString();
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:creator>Bell Plaster Order Portal</dc:creator>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>';
}

function textEntry(name, text) {
  return { name, bytes: new TextEncoder().encode(text) };
}

function rowXml(rowNumber, span, cells) {
  return `<row r="${rowNumber}" spans="1:${span}" x14ac:dyDescent="0.25">${cells.join("")}</row>`;
}

function textCell(reference, styleId, value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!text) return blankCell(reference, styleId);
  const style = styleId > 0 ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function numberCell(reference, styleId, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return blankCell(reference, styleId);
  const style = styleId > 0 ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style}><v>${number}</v></c>`;
}

function blankCell(reference, styleId) {
  const style = styleId > 0 ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style}/>`;
}

function excelDateSerial(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid Accrivia date: ${value || "blank"}`);
  return Math.floor((Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - Date.UTC(1899, 11, 30)) / 86400000);
}

function columnName(number) {
  return String.fromCharCode(64 + number);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createStoreOnlyZip(entries) {
  const output = [];
  const centralRecords = [];
  const timestamp = getZipDosDateTime(new Date());

  entries.forEach((entry) => {
    const nameBytes = new TextEncoder().encode(entry.name);
    const dataBytes = entry.bytes;
    const checksum = crc32(dataBytes);
    const localOffset = output.length;

    pushUInt32LE(output, 0x04034b50);
    pushUInt16LE(output, 20);
    pushUInt16LE(output, 0);
    pushUInt16LE(output, 0);
    pushUInt16LE(output, timestamp.time);
    pushUInt16LE(output, timestamp.date);
    pushUInt32LE(output, checksum);
    pushUInt32LE(output, dataBytes.length);
    pushUInt32LE(output, dataBytes.length);
    pushUInt16LE(output, nameBytes.length);
    pushUInt16LE(output, 0);
    appendBytes(output, nameBytes);
    appendBytes(output, dataBytes);

    const central = [];
    pushUInt32LE(central, 0x02014b50);
    pushUInt16LE(central, 20);
    pushUInt16LE(central, 20);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, timestamp.time);
    pushUInt16LE(central, timestamp.date);
    pushUInt32LE(central, checksum);
    pushUInt32LE(central, dataBytes.length);
    pushUInt32LE(central, dataBytes.length);
    pushUInt16LE(central, nameBytes.length);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt32LE(central, 0x01800000);
    pushUInt32LE(central, localOffset);
    appendBytes(central, nameBytes);
    centralRecords.push(central);
  });

  const centralOffset = output.length;
  centralRecords.forEach((record) => appendBytes(output, record));
  const centralSize = output.length - centralOffset;
  pushUInt32LE(output, 0x06054b50);
  pushUInt16LE(output, 0);
  pushUInt16LE(output, 0);
  pushUInt16LE(output, entries.length);
  pushUInt16LE(output, entries.length);
  pushUInt32LE(output, centralSize);
  pushUInt32LE(output, centralOffset);
  pushUInt16LE(output, 0);
  return Uint8Array.from(output);
}

function appendBytes(target, source) {
  for (const byte of source) target.push(byte & 0xff);
}

function pushUInt16LE(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUInt32LE(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function getZipDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
