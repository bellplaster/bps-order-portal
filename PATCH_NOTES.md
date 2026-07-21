# BPS Order Portal — mobile and date UI correction

Replace only:

- public/index.html
- public/app.js
- public/styles.css
- functions/_shared/orders.js

Changes:

- Contact number is now mobile-only.
- Only Australian numbers beginning with 04 are accepted.
- +61 4 numbers are converted to 04xx xxx xxx.
- Removed 03 landline support in both browser and backend validation.
- Removed the required-date typing description.
- Removed the delivery-address explanatory description.
- Removed the mobile-format helper description.
- Fixed the delivery form grid so the Order Date field no longer stretches
  when the six-month date warning appears.
- Simplified the six-month warning wording and spacing.
