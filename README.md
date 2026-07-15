# BPS Order Portal — Compact Cloudflare Native

This version:

- removes Google Apps Script;
- generates Accrivia XLSX files in Cloudflare;
- stores generated files in R2;
- records orders and diagnostics in D1;
- does not require email configuration;
- assigns sequential order numbers such as BPS1, BPS2 and BPS3;
- uses fixed Accrivia details:
  - debtor code: BPS BRUNSW17
  - company: BPS Brunswick Plastering Services
  - address 1: 125 Sussex Street
  - address 2: Pascoe Vale VIC 3044
  - address 3: blank;
- keeps Other Products outside the XLSX and stores them in submission.json;
- includes read-only order history.

Edit and cancel are deliberately not included in this patch. They require versioned
orders so the original order and every revision remain auditable.
