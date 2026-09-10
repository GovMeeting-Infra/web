This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

Two suites, with very different requirements.

```bash
npm test            # unit — the offline core. No server, about a second.
npm run cypress:run # end to end — needs the stack below running.
```

The unit tests cover the decisions the offline write path rests on: which
routes may be deferred, what collapses onto what, which failures are worth
retrying, what the connectivity store reports. They run in CI on every PR and
are expected to stay green.

The end-to-end suite drives a real browser against a real API and database, so
three things have to be up first:

```bash
docker compose up -d postgres          # from the infra repo
cd server && DATABASE_URL=postgresql://postgres:devpass@localhost:5432/govmeeting_dev \
             DIRECT_URL=postgresql://postgres:devpass@localhost:5432/govmeeting_dev \
             npx nest start            # API on :4000
cd web && npm run build && npm start   # web on :3000
```

Both URLs, not just `DATABASE_URL`: `prisma.config.ts` prefers `DIRECT_URL`, and
`server/.env` points that at a hosted database. Overriding one and not the other
sends migrations somewhere real.

The suite creates the account it signs in with — there are no seeded logins, by
design — and sets its password through the application's own reset endpoints.
That provisioning **refuses any database that is not on this machine**, because
it creates users and resets passwords. It also clears what previous runs left
behind, scoped to its own fixture ministries, so a developer's own data in the
same database is untouched.

Specs create the meetings they need rather than assuming any exist. A spec that
depends on a row somebody once seeded is a spec that will be red within a
month, which is what happened to this suite before.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
