# Orders workflow migration boundary

## Current release

The production order-entry form remains vanilla HTML, CSS and JavaScript. Order management is isolated at `/orders/` as a separate vertical workflow with its own page, API service and UI controller.

The repository currently deploys the `public` directory directly to Cloudflare Pages and does not yet have a Vite, React or TypeScript build pipeline. Introducing React inside the existing order form would create two UI runtimes with shared global state, so this slice remains framework-independent until the React application shell is established.

## Permission rules

`functions/_shared/order-permissions.js` is the source of truth.

- Administrator: view every customer account, download every order file, archive, restore and permanently delete orders.
- Primary customer user: view all orders belonging to their account.
- Secondary customer user: view only orders created by their own portal user.
- Customer users cannot archive, restore or permanently delete submitted orders.
- Submitted orders remain read-only and cannot be edited or resubmitted.

## Workflow boundaries

Frontend:

- `public/orders/index.html`
- `public/orders/orders.css`
- `public/orders/orders.js`
- `public/orders/order-service.js`

Backend:

- `functions/api/orders.js`
- `functions/api/orders/[submissionId].js`
- `functions/api/files/[id].js`
- `functions/_shared/order-permissions.js`

The old order-history drawer controller has been removed. `public/order-history-access.js` is only a temporary cache-compatibility loader that routes older cached pages to the new Orders page controller.

## React migration

When the React and TypeScript shell is introduced, migrate `/orders/` as one complete screen. Keep the existing API contracts and permission module. Replace the page, service and UI controller together, add Playwright coverage, then remove the compatibility loader and remaining legacy history functions from the order-form bundle.

## Regression requirements

- Administrator sees orders from all customer accounts.
- Customer users never see another account's orders.
- Secondary users only see orders they placed.
- Administrator can archive, restore and delete cross-account orders.
- Customer users cannot call management actions.
- Administrator can download cross-account XLSX files.
- Deletion removes the D1 order record, related file records, order events and stored R2 files.
- Search and customer, staff and status filters work on desktop and mobile.
