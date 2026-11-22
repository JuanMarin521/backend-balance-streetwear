# Secure Task Management API

An isolated Express + TypeScript backend scaffold for user registration,
cookie-based JWT sessions, and ownership-scoped task CRUD.

## Run

```bash
npm install
copy .env.example .env
# Set JWT_SECRET to a random value of at least 32 characters.
npm run build
npm test
npm run dev
```

The default repository is in memory so the scaffold can run without an
external service. Replace `Store` with a database-backed implementation before
production use while preserving the `*ForUser` ownership predicates.

## Security contract

- Passwords use Argon2id; plaintext passwords are never stored.
- JWTs are signed with HS256 and sent only in `HttpOnly`, `SameSite=Strict`
  cookies. Enable `COOKIE_SECURE=true` over HTTPS.
- CORS requires explicit origins and credentials are enabled only for those
  origins.
- Helmet, JSON body limits, global rate limiting, and stricter auth rate
  limiting are enabled by default.
- Task reads and mutations receive the authenticated user ID at the repository
  boundary. Cross-user task IDs return `404` to avoid resource enumeration.
