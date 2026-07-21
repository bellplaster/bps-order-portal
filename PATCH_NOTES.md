# BPS Order Portal — delivery details refinement

Replace/add only:

- public/index.html
- public/app.js
- public/styles.css
- functions/_shared/orders.js
- functions/api/address-config.js

Changes:

- Dates display and type as DD-MM-YYYY.
- Required-date input automatically inserts hyphens while typing digits.
- Required date cannot be earlier than the order date.
- Dates six months or more in the future require confirmation.
- Dates more than 12 months in the future are blocked.
- Required times outside 5:00 am–6:00 pm require confirmation.
- Contact name rejects numbers and requires at least two letters.
- Contact number accepts and formats only:
  - 03 0000 0000
  - 0400 000 000
  - +61 equivalents are converted to local format.
- Delivery addresses can use Google Places autocomplete restricted to Victoria.
- Manual address entry remains available as a fallback.
- Non-pickup addresses must contain VIC/Victoria and a Victorian postcode.
- Backend validation mirrors the browser rules.
- First-page scrolling was rebuilt so the lower delivery controls are not clipped.

Google address setup:

1. In Google Cloud, enable:
   - Maps JavaScript API
   - Places API (New)
2. Create a website API key.
3. Restrict the website key to:
   - https://bps-order-portal.pages.dev/*
   - add the final custom domain later, if used.
4. Restrict the key to:
   - Maps JavaScript API
   - Places API (New)
5. In Cloudflare Pages > Settings > Variables and Secrets, add:
   GOOGLE_MAPS_BROWSER_KEY
6. Redeploy the project.

The portal still works with manual address entry when the key is absent.
