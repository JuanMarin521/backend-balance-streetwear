# Balance project context

Status: initial project context and proposed boundaries. This document is
based on the owner-supplied brief and must be updated when implementation
decisions become authoritative.

## Product scope

Balance Streetwear is intended to be a professional streetwear clothing store
and showroom at `balancestreetwear.com`, originating in Medellín, Colombia.
The planned product areas are:

- storefront catalog with high-quality product imagery;
- category and attribute filtering for pants, hoodies, t-shirts, and matching
  sets;
- product details with sizes, designs, and variations;
- interactive male/female virtual showroom with top/bottom mix-and-match;
- authenticated administration for inventory and orders;
- Supabase-backed stock tracking and payment-provider integration.

## Proposed application boundaries

The following is a proposed scaffold, not a claim that these directories
already exist:

```text
src/
  components/
    react/       # storefront UI and cart/inventory state adapters
    svelte/      # showroom animation and outfit visualization
  layouts/       # Astro page shells
  pages/         # Astro routes and API endpoints
  lib/
    supabase/    # browser/server clients and typed data access
    payments/    # provider-neutral checkout and webhook adapters
  content/      # static/catalog content only when appropriate
```

The final tree should follow the selected Astro integration conventions once
the package scaffold is approved. Do not create placeholder directories with
no consumer.

## Component composition contract

### Astro

Astro owns URL routing, page/layout composition, static generation, server-side
data loading, and API endpoint boundaries. It should pass serializable,
validated props into React or Svelte islands and should not contain duplicated
client state.

### React

React owns core storefront interaction: product listing controls, product
details, cart state, checkout initiation, and UI-level inventory feedback.
Use a single cart state boundary and pass stable, serializable data to other
islands. React must not embed payment secrets or use a Supabase service-role
client.

### Svelte

Svelte owns the virtual-showroom presentation and animation loop: model
selection, garment transitions, swipe/gesture feedback, loading states, and
reduced-motion behavior. Keep showroom state local to the Svelte island unless
the product contract explicitly requires persistence. Expose changes through
typed custom events or serializable callbacks at the Astro boundary rather
than importing React internals.

### Cross-framework rules

1. Share domain types and pure formatting/validation utilities, not framework
   component internals.
2. Use explicit props/events for Astro-to-island communication.
3. Keep server data access in server-safe modules; browser modules may use only
   public Supabase configuration.
4. Treat image/model assets as a performance concern: define loading,
   responsive sizing, fallback, and accessibility behavior with the UI owner.
5. Respect keyboard operation, touch targets, focus order, and reduced-motion
   preferences in both storefront and showroom experiences.

## Proposed API routing architecture

Astro API endpoints are the proposed server boundary. Exact names are pending
the selected payment provider and domain model; they should be added as
versioned contracts before implementation.

| Route | Method | Responsibility | Trust boundary |
| --- | --- | --- | --- |
| `/api/checkout/session` | `POST` | Validate cart, obtain current prices/stock, create provider checkout | Authenticated/guest request; server validates all values |
| `/api/payments/webhook` | `POST` | Verify provider signature and apply idempotent order transition | Provider-to-server only |
| `/api/inventory` | `GET` | Return customer-safe availability information | Public or authenticated, based on final product policy |
| `/api/admin/inventory` | `GET/POST/PATCH` | Manage stock and variants | Admin auth plus server-side authorization |
| `/api/admin/orders` | `GET/PATCH` | Review and transition orders | Admin auth plus server-side authorization |

API handlers should validate input, avoid trusting client prices or stock,
return stable error shapes, and keep webhook processing idempotent. Supabase
queries and payment-provider calls belong behind server-safe modules rather
than directly in UI components.

## Environment-variable contract

These names are an initial contract for an example template; no values belong
in this repository. Public variables must be safe for browser exposure. The
provider-specific names should be finalized after the provider decision.

```text
PUBLIC_SITE_URL=
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only
PAYMENT_PROVIDER=                 # stripe | wompi | mercadopago
PAYMENT_SECRET_KEY=               # server-only provider credential
PAYMENT_WEBHOOK_SECRET=           # server-only signature secret
```

If a provider requires a different credential set, add provider-specific
server-only names to the example template and document their purpose. Never
commit real values or use a service-role key in client code.

## Data and security boundaries

- Supabase schema, migrations, and row-level security policies are the
  authority for persisted inventory, users, variants, and orders.
- Client-visible stock is advisory; checkout rechecks availability on the
  server in a transaction-safe flow.
- Admin operations require authenticated identity and explicit authorization;
  UI visibility is not authorization.
- Webhooks must verify signatures before mutation and tolerate retries.
- Product media and showroom assets should not include private customer data.

## Implemented backend (status)

Decisions recorded while implementing (change them deliberately):

- Package manager: npm. Astro 5 with `@astrojs/node` (standalone) as a neutral
  hosting default; zod 3 for validation; Vitest for tests.
- Payments: provider-neutral `PaymentProvider` port; **Wompi** is implemented
  (COP). Stripe/MercadoPago return `501 provider_not_implemented`. For Wompi,
  `PAYMENT_SECRET_KEY` is the integrity secret, `PAYMENT_WEBHOOK_SECRET` the
  events secret, `PAYMENT_PUBLIC_KEY` the merchant public key (server-side use).
- Extra env names: `PAYMENT_PUBLIC_KEY`, `SHIPPING_FLAT_COP` (placeholder, 0),
  `CHECKOUT_RESULT_PATH`.
- Money: integer COP; prices assumed tax-inclusive (rule still open).
- Stock model: `available = stock_on_hand - stock_reserved`. Checkout reserves
  in one DB transaction (`create_order_with_reservation`, row locks in
  deterministic order); approved payment consumes stock; failed/voided/
  cancelled/expired releases it (30 min TTL, swept on each checkout).
- Webhook idempotency: `payment_events` unique `(provider, event_id)`; amount
  mismatch or payment after release moves the order to `payment_review`.
- Admin: Bearer Supabase JWT + `profiles.role = 'admin'`, checked server-side.
  Roles are `customer`/`admin` only. Promote an admin manually in SQL.
- Admin order transitions: pending/payment_review -> cancelled, paid -> shipped,
  shipped -> delivered. Refunds and paid -> cancelled are not supported yet.
- Public `/api/inventory` returns capped, customer-safe availability only;
  browser roles cannot read stock columns (column grants + RLS).

Layout: `src/server/{config,controllers,exceptions,middlewares,repositories,routes,services,validators}`
for the layered server boundary, with `src/pages/api/**` as thin Astro route
adapters. Existing domain and infrastructure modules remain under
`src/lib/{domain,supabase,payments,checkout,orders}` as compatibility and
implementation modules while the server facade is migrated incrementally.
Database migrations remain under `supabase/migrations` and automated checks
under `tests`.

Notes: Astro `checkOrigin` rejects form-typed cross-origin POSTs; provider
webhooks must send `application/json` (Wompi does).

## Known decisions and open questions

Confirmed by the owner: product domain, target domain, Supabase, TypeScript,
Astro, React, Svelte, and a payment API.

Still open: hosting/runtime (final), tax/shipping rules, finer admin roles,
image storage/CDN, rate limiting, refunds, other payment providers, and CI/CD. Record each decision before it is
used as a repository rule.
