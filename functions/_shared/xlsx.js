/*
 * Minimal Accrivia XLSX generator for Cloudflare Pages Functions.
 *
 * The package skeleton is derived from:
 * reference/Accrivia_Skeleton.xlsx
 *
 * The generated workbook has:
 * A = SiteArea / Grid (optional)
 * B = Stock Code
 * C = Description
 * D = Quan
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STATIC_XLSX_ENTRIES = [
  { name: "[Content_Types].xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC93b3JrYm9vay54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldC5tYWluK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3dvcmtzaGVldHMvc2hlZXQxLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVub2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC53b3Jrc2hlZXQreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIveGwvdGhlbWUvdGhlbWUxLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVub2ZmaWNlZG9jdW1lbnQudGhlbWUreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIveGwvc3R5bGVzLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVub2ZmaWNlZG9jdW1lbnQuc3R5bGVzK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3NoYXJlZFN0cmluZ3MueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW5vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoYXJlZFN0cmluZ3MreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIvZG9jUHJvcHMvY29yZS54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtcGFja2FnZS5jb3JlLXByb3BlcnRpZXMreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIvZG9jUHJvcHMvYXBwLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVub2ZmaWNlZG9jdW1lbnQuZXh0ZW5kZWQtcHJvcGVydGllcyt4bWwiLz48L1R5cGVzPg==" },
  { name: "_rels/.rels", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBJZD0icklkMyIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9leHRlbmRlZC1wcm9wZXJ0aWVzIiBUYXJnZXQ9ImRvY1Byb3BzL2FwcC54bWwiLz48UmVsYXRpb25zaGlwIElkPSJySWQyIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVubWwgZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMvbWV0YWRhdGEvY29yZS1wcm9wZXJ0aWVzIiBUYXJnZXQ9ImRvY1Byb3BzL2NvcmUueG1sIi8+PFJlbGF0aW9uc2hpcCBJZD0icklkMSIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3Blbm1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL29mZmljZURvY3VtZW50IiBUYXJnZXQ9InhsL3dvcmtib29rLnhtbCIvPjwvUmVsYXRpb25zaGlwcz4=" },
];

const SHEET_PREFIX =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">';

const SHEET_LAYOUT =
  '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
  '<selection activeCell="A1" sqref="A1"/>' +
  '</sheetView></sheetViews>' +
  '<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="0.25"/>' +
  '<cols>' +
  '<col min="1" max="1" width="18.140625" bestFit="1" customWidth="1"/>' +
  '<col min="2" max="2" width="18.140625" bestFit="1" customWidth="1"/>' +
  '<col min="3" max="3" width="33.28515625" bestFit="1" customWidth="1"/>' +
  '<col min="4" max="4" width="7.140625" bestFit="1" customWidth="1"/>' +
  '</cols>';

const SHEET_SUFFIX =
  '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" ' +
  'header="0.3" footer="0.3"/>' +
  '</worksheet>';

export function createAccriviaXlsx(data) {
  const productRows = Array.isArray(data.productRows)
    ? data.productRows
    : [];

  if (productRows.length === 0) {
    throw new Error("No verified Accrivia product rows were supplied.");
  }

  const finalRow = 11 + productRows.length;
  const sheetRows = buildSheetRows(data, productRows);

  const sheetXml =
    SHEET_PREFIX +
    `<dimension ref="A1:D${finalRow}"/>` +
    SHEET_LAYOUT +
    `<sheetData>${sheetRows}</sheetData>` +
    SHEET_SUFFIX;

  const entries = STATIC_XLSX_ENTRIES.map((entry) => ({
    name: entry.name,
    bytes: decodeBase64(entry.base64),
  }));

  entries.push({
    name: "xl/worksheets/sheet1.xml",
    bytes: new TextEncoder().encode(sheetXml),
  });

  return {
    bytes: createStoreOnlyZip(entries),
    mimeType: XLSX_MIME,
    finalRow,
  };
}

function buildSheetRows(data, productRows) {
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
    const labelCell = textCell(`A${row}`, 1, labels[row - 1]);

    const valueCell =
      row === 2 || row === 3
        ? numberCell(`B${row}`, 3, values[row - 1])
        : textCell(`B${row}`, 2, values[row - 1]);

    rows.push(rowXml(row, [labelCell, valueCell]));
  }

  rows.push(
    rowXml(11, [
      textCell("A11", 0, "SiteArea / Grid"),
      textCell("B11", 0, "Stock Code"),
      textCell("C11", 0, "Description"),
      textCell("D11", 0, "Quan"),
    ]),
  );

  productRows.forEach((product, index) => {
    const row = 12 + index;

    rows.push(
      rowXml(row, [
        textCell(`A${row}`, 0, product[0]),
        textCell(`B${row}`, 0, product[1]),
        textCell(`C${row}`, 0, product[2]),
        numberCell(`D${row}`, 4, product[3]),
      ]),
    );
  });

  return rows.join("");
}

function rowXml(rowNumber, cells) {
  return (
    `<row r="${rowNumber}" spans="1:4" x14ac:dyDescent="0.25">` +
    cells.join("") +
    "</row>"
  );
}

function textCell(reference, styleId, value) {
  const text = value === null || value === undefined
    ? ""
    : String(value);

  if (text === "") {
    return blankCell(reference, styleId);
  }

  const style = styleId > 0 ? ` s="${styleId}"` : "";

  return (
    `<c r="${reference}"${style} t="inlineStr">` +
    "<is>" +
    `<t xml:space="preserve">${xmlEscape(text)}</t>` +
    "</is>" +
    "</c>"
  );
}

function numberCell(reference, styleId, value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return blankCell(reference, styleId);
  }

  const style = styleId > 0 ? ` s="${styleId}"` : "";

  return (
    `<c r="${reference}"${style}>` +
    `<v>${number}</v>` +
    "</c>"
  );
}

function blankCell(reference, styleId) {
  const style = styleId > 0 ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style}/>`;
}

function excelDateSerial(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    throw new Error(`Invalid Accrivia date: ${value || "blank"}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return Math.floor(
    (
      Date.UTC(year, month - 1, day) -
      Date.UTC(1899, 11, 30)
    ) /
    86400000,
  );
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeBase64(value) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
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
    appendBytes(central, dataBytes);

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
  for (const byte of source) {
    target.push(byte & 0xff);
  }
}

function pushUInt16LE(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUInt32LE(target, value) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function getZipDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let value = 0; value < 256; value += 1) {
    let current = value;

    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0
        ? 0xedb88320 ^ (current >>> 1)
        : current >>> 1;
    }

    table[value] = current >>> 0;
  }

  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
