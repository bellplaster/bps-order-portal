# Brunswick Order Portal

A password-protected Cloudflare Pages application that sends structured
Brunswick Plaster Services orders to the validated Google Apps Script
Accrivia XLSX generator.

## Architecture

Browser
→ Cloudflare Pages portal
→ authenticated Cloudflare Pages Function
→ Google Apps Script web app
→ separate GF and L1 XLSX files
→ Google Drive and Bell email

The Google Apps Script webhook key is never exposed to the browser.

## Included controls

- Password-protected eight-hour sessions.
- Separate Ground Floor and 1st Floor orders.
- Product catalogue loaded from the Apps Script verified catalogue endpoint.
- Unknown products are not guessed.
- Other Products are routed to manual review.
- Duplicate protection through a unique submission ID.
- Cloudflare request ID returned for every API request.
- When generation fails, the proxy retrieves the Apps Script last stage and
  exact stored error.
- Security headers and no-search-engine directives.
- No third-party JavaScript libraries.

## 1. Prepare the Apps Script web app

Open the working `Brunswick Order Generator` Apps Script project.

Change:

```javascript
WEBHOOK_KEY: "brunswick-order",
```

to a long random secret. Keep that value private.

Deploy the project:

1. Select **Deploy → New deployment**.
2. Choose **Web app**.
3. Execute as **Me**.
4. Allow access to **Anyone** so Cloudflare can call the endpoint.
5. Deploy and copy the URL ending in `/exec`.

Do not use a `/dev` URL.

Test the deployed status endpoint in a browser:

```text
YOUR_EXEC_URL?key=YOUR_SECRET
```

It should return JSON with:

```json
{
  "ok": true,
  "service": "Brunswick Order Generator"
}
```

Then test the catalogue endpoint:

```text
YOUR_EXEC_URL?key=YOUR_SECRET&action=catalog
```

It should report 47 verified products.

## 2. Upload this project to GitHub

Create a private GitHub repository and upload the contents of this folder.
The repository root must contain:

```text
public/
functions/
wrangler.toml
package.json
```

Do not create or commit `.dev.vars`.

## 3. Create the Cloudflare Pages project

In Cloudflare:

1. Open **Workers & Pages**.
2. Create a Pages project from the private GitHub repository.
3. Framework preset: none.
4. Build command: leave blank.
5. Build output directory: `public`.
6. Root directory: repository root.
7. Deploy.

The `functions` directory is deployed as Pages Functions.

## 4. Add encrypted secrets

Open the Pages project:

**Settings → Variables and Secrets → Add**

Add all four values to Production. Add them to Preview as well if preview
deployments will be used.

| Name | Value |
|---|---|
| `APPS_SCRIPT_URL` | Apps Script deployment URL ending `/exec` |
| `BRUNSWICK_WEBHOOK_KEY` | Same long secret used in Apps Script |
| `PORTAL_PASSWORD` | Password supplied to Brunswick |
| `SESSION_SECRET` | At least 64 random characters, unrelated to the portal password |

Mark the webhook key, portal password and session secret as encrypted secrets.

Redeploy after adding or changing secrets.

## 5. Acceptance test

1. Open the Pages project URL.
2. Sign in.
3. Confirm the page reports `47 verified Accrivia products available`.
4. Submit one Ground Floor test and one 1st Floor test.
5. Confirm:
   - the portal displays both generated filenames;
   - Bell receives the email;
   - both files are saved in the Drive output folder;
   - both files import into Accrivia;
   - no duplicate files are produced if the same browser request is retried.

## Diagnostics

Authenticated diagnostic endpoint:

```text
https://YOUR_PAGES_DOMAIN/api/status
```

It returns:

- last Apps Script request;
- last processing stage;
- last successful submission;
- last exact error and stack trace.

Each Cloudflare API response also includes an `X-Request-ID` header and the
same request ID in JSON.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, fill in the values, then run:

```bash
npm install
npm run dev
```

Never commit `.dev.vars` or `.env` files.

## Production hardening after staging

- Move from the shared portal password to Cloudflare Access with named users
  when Brunswick staff email addresses are confirmed.
- Attach a custom hostname such as `brunswick-orders.bellplaster.com.au`.
- Rotate the Apps Script webhook key after launch.
- Add an order-history database only after the submission workflow is stable.
