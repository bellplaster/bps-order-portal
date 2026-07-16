# BPS Order Portal — Revision and Download Update

This version adds:

- authenticated XLSX downloads from the private R2 bucket;
- an Edit Order action in Order History;
- product quantities and Other Products prefilled from the latest order payload;
- versioned amendments without deleting the original files;
- filenames such as `BPS1-R2-GF.xlsx` for the second revision;
- historical XLSX files retained and downloadable;
- no email requirement.

## Amendment behaviour

Editing `BPS1` does not overwrite the first generated XLSX. It creates a new
revision in R2 and adds new `order_files` records in D1. The `orders` row keeps
the latest editable payload, while `order_events` records revision completion.

No D1 migration is required for this update.

## Routes

- `GET /api/orders` — order history
- `GET /api/orders/:submissionId` — load latest order for editing
- `PUT /api/orders/:submissionId` — generate a new revision
- `GET /api/files/:id` — authenticated XLSX download from R2
