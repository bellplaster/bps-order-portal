# BPS Order Portal kiosk UI patch

Replace only:

- public/index.html
- public/app.js
- public/styles.css

What changed:

- Converts the long form into a three-stage kiosk flow: Delivery, Products, Review.
- Uses Bell Plaster maroon #A62B45 as the primary action colour.
- Uses green #006557 for saved status, floor context and complementary accents.
- Moves product categories into a left navigation rail.
- Keeps the board matrix for familiar board ordering.
- Adds a large global Accrivia product search at the top of the product screen.
- Search results show SKU and description only; no warehouse availability wording.
- Adds a persistent Current Order basket with quantity controls.
- Groups the basket by Ground Floor and 1st Floor.
- Adds a clean review screen before submission.
- Moves Order History into a slide-out drawer.
- Retains local browser autosave, order editing, XLSX downloads, archive and delete.
- Removes the double-border appearance from board quantity cells.

No D1 migration or backend changes are required.
