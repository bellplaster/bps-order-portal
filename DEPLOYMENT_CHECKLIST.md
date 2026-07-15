# Deployment checklist

## Apps Script

- [ ] Replace `WEBHOOK_KEY: "brunswick-order"` with a long random secret.
- [ ] Save the Apps Script project.
- [ ] Deploy as a Web app.
- [ ] Execute as: Me.
- [ ] Access: Anyone.
- [ ] Copy the `/exec` URL.
- [ ] Test `/exec?key=SECRET`.
- [ ] Test `/exec?key=SECRET&action=catalog`.
- [ ] Confirm the catalogue returns 47 products.

## GitHub

- [ ] Create a private repository.
- [ ] Upload the full project folder contents.
- [ ] Confirm `.dev.vars` and `.env` are not committed.

## Cloudflare Pages

- [ ] Connect the GitHub repository.
- [ ] Framework preset: none.
- [ ] Build command: blank.
- [ ] Build output directory: `public`.
- [ ] Add encrypted secrets:
  - [ ] `APPS_SCRIPT_URL`
  - [ ] `BRUNSWICK_WEBHOOK_KEY`
  - [ ] `PORTAL_PASSWORD`
  - [ ] `SESSION_SECRET`
- [ ] Redeploy.

## Portal acceptance test

- [ ] Password login works.
- [ ] Catalogue displays 47 verified products.
- [ ] Ground Floor submission generates a GF XLSX.
- [ ] 1st Floor submission generates an L1 XLSX.
- [ ] Bell receives the email.
- [ ] Generated files appear in the Drive output folder.
- [ ] Both files import into Accrivia.
- [ ] Other Products appear as manual review.
- [ ] `/api/status` displays the latest request, stage, success and error.
