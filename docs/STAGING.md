# Staging Environment Setup

This guide sets up a NeonDB staging branch wired to Vercel preview deployments. Run it once — every subsequent PR gets a preview deployment automatically pointed at staging.

## 1. Create NeonDB Staging Branch

1. Open [NeonDB Console](https://console.neon.tech) → select your project
2. Go to **Branches** → **New Branch**
3. Branch from: `main`
4. Name: `staging`
5. Click **Create Branch**
6. Copy the **pooled connection string** and **direct connection string** for the `staging` branch

## 2. Add Staging Env Vars to Vercel

1. Open [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add `DATABASE_URL`:
   - Value: the staging **pooled** connection string
   - Environment: **Preview** only (uncheck Production and Development)
3. Add `DIRECT_URL`:
   - Value: the staging **direct** connection string
   - Environment: **Preview** only

Every PR will now create a Vercel preview deployment that points at the staging NeonDB branch.

## 3. Keep Schema in Sync

After running `npx prisma migrate dev` on your local/production DB, push the same schema to staging:

```bash
DATABASE_URL=<staging_direct_url> npx prisma db push
```

Or use the direct connection string from your `.env.local` by temporarily overriding:

```bash
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npx prisma db push
```

## 4. Seed Staging Data (Optional)

```bash
DATABASE_URL=<staging_direct_url> npm run db:seed
```
