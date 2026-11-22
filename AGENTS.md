# Balance — agent entry point

## Scope

This file is the repository-wide entry point for AI agents working on Balance
Streetwear, a production-oriented streetwear e-commerce store and virtual
showroom for Medellín, Colombia. The repository is currently an empty
The backend implementation is now tracked in this repository; the project brief remains the source of product scope.
The repository contains the implemented Astro backend foundation described in
this file; React/Svelte islands remain future work.

Read [.agents/project-context.md](.agents/project-context.md) before making
implementation or architecture changes. It records the implemented boundaries,
route contracts, environment-variable names, and the React/Astro/Svelte
composition rules. Files under `.agents/` are not loaded automatically; this
entry point is the explicit navigation to them.

## Confirmed target stack

- TypeScript as the core language.
- Astro for static generation and application routing.
- React for core UI and cart/inventory state.
- Svelte for the interactive virtual-showroom animations.
- Supabase for authentication, database, and inventory persistence.
- Wompi as the implemented payment provider adapter; Stripe and MercadoPago
  remain explicit not-implemented alternatives.

The backend decisions above are implemented in the source tree and covered by
the verification commands below. Do not claim the live Supabase migration,
real payment sandbox, CI, or deployment are verified until those checks run.

## Repository rules

- Inspect existing files and local changes before editing. Preserve user work.
- Never read, print, commit, or expose secret values. Use an example template
  for environment names and keep real `.env` files out of version control.
- Treat Supabase service-role credentials and payment secrets as server-only.
  Browser code may receive only explicitly public values.
- Keep Astro responsible for pages, layouts, routing, and server boundaries;
  keep React responsible for shared storefront state; keep Svelte scoped to
  showroom animation and presentation. See the project context document for
  the integration contract.
- Use the commands in `package.json`; the verified backend checks are
  `npm install`, `npm run typecheck`, `npm test`, and `npm run build`.
- Keep changes small and verifiable. Update documentation when a decision,
  route, data contract, or ownership boundary becomes authoritative.

## Collaboration boundaries

Use one integrating agent for contract and validation changes. If the
implementation grows, the following
specialist responsibilities are reasonable proposals, not created agents:

- storefront specialist: Astro/React pages, product catalog, cart, and
  customer-facing accessibility;
- showroom specialist: Svelte animation state and model/outfit composition;
- Supabase specialist: schema, migrations, auth, RLS, and inventory flows;
- payments specialist: provider adapter, checkout, webhook verification, and
  order state transitions.

Any parallel work must have explicit file ownership and a single integrator
responsible for contract and validation changes. Use the installed
`requirements-engineering` skill for backlog and acceptance criteria, and
`application-security-review` for a deeper security assessment; do not copy
those Skills into this repository.

## Current verification status

The backend is implemented and verified (Node 22, npm). Verified commands:

- `npm install`
- `npm run dev` / `npm run build` / `npm run preview`
- `npm run typecheck` (`astro check`, 0 errors)
- `npm test` (Vitest, 21 tests: Wompi signatures, checkout service, schemas,
  HTTP helpers, availability, order transitions)

Not yet verified: the SQL migration against a live Supabase project, a real
Wompi sandbox payment, CI, deployment. React/Svelte islands and pages do not
exist yet. Apply `supabase/migrations/0001_init.sql` and test end to end
before claiming production readiness.
