# Searchable Other Materials patch

Replace/add only the files in this ZIP.

## What changes

- Stores the full Accrivia catalogue in the existing Cloudflare D1 database.
- Replaces the six free-text Other Materials rows with a searchable product picker.
- Search accepts stock code or imperfect descriptions, including missing spaces and minor typing errors.
- Allows up to 100 additional products per floor.
- Selected products autosave with the existing browser draft and restore during order editing.
- Backend validates every selected SKU against D1 and uses the D1 description in the XLSX.
- Duplicate stock codes are combined into one XLSX line.

## Initial setup

### Easiest method

1. Upload/replace the files in GitHub and wait for Cloudflare deployment.
2. Sign in to the portal.
3. Open `/catalog-admin/`.
4. Upload `zISOHWhse.csv` and click **Import catalogue**.
5. Return to the order portal and refresh once.

The import page creates the required tables automatically. The migration file is included as the canonical schema but does not need to be run separately when using the import page.

### Command-line alternative

```bash
npx wrangler d1 execute bps-order-portal --remote --file=./migrations/0002_products.sql
npx wrangler d1 execute bps-order-portal --remote --file=./data/products_import.sql
```

`data/products_import.sql` was generated from the supplied CSV and contains 2,736 unique stock codes.
