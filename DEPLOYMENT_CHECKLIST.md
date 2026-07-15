# Cloudflare-native deployment checklist

## 1. Accrivia generator acceptance

- [ ] Download `Cloudflare_Native_Test_GF.xlsx`.
- [ ] Download `Cloudflare_Native_Test_L1.xlsx`.
- [ ] Upload both into Accrivia.
- [ ] Confirm debtor code `BPS BRUNSW17`.
- [ ] Confirm Rate Ex is blank.
- [ ] Confirm SKUs and quantities.
- [ ] Confirm Ground Floor and 1st Floor remain separate.

## 2. D1

- [ ] Create D1 database `bps-order-portal`.
- [ ] Open D1 console.
- [ ] Run `migrations/0001_initial.sql`.
- [ ] Bind database to Pages as `DB`.

## 3. R2

- [ ] Create R2 bucket `bps-order-files`.
- [ ] Bind bucket to Pages as `ORDER_FILES`.

## 4. Email Service

- [ ] Enable Cloudflare Email Sending for the account.
- [ ] Verify sender domain/address.
- [ ] Create API token with email sending permission.
- [ ] Add `CLOUDFLARE_ACCOUNT_ID`.
- [ ] Add encrypted `CLOUDFLARE_EMAIL_API_TOKEN`.
- [ ] Add `EMAIL_FROM`.
- [ ] Add `EMAIL_TO`.
- [ ] Add optional `EMAIL_CC`.

## 5. Remove Google settings

- [ ] Delete `APPS_SCRIPT_URL`.
- [ ] Delete `BRUNSWICK_WEBHOOK_KEY`.

## 6. Deploy

- [ ] Replace the GitHub repository files with this package.
- [ ] Wait for a successful Pages deployment.
- [ ] Confirm login works.
- [ ] Confirm 47 verified products load.
- [ ] Submit a test order.
- [ ] Confirm email attachments.
- [ ] Confirm files in R2.
- [ ] Confirm order status in D1.
- [ ] Check `/api/status`.
