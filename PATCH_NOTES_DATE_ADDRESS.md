# Date and address lifecycle correction

- Required date is owned only by `order-details-date-state.js`.
- Display remains `dd-mm-yy`; the submitted value remains ISO `yyyy-mm-dd`.
- Delivery refinement is loaded statically and guarded against the legacy dynamic loader.
- Visible State is removed while hidden `VIC` is preserved.
- Late lifecycle injection from `reference-placeholder.js` has been removed.
