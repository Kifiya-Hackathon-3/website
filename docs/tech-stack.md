# Technical stack

Overview of the main languages, frameworks, and tools used across the Kifiya Hackathon 3.0 / digital identity wallet programme. Individual repositories may add or swap pieces; this is the shared baseline.

---

## Backend (Ahadu API and related services)

| Technology | Role |
|------------|------|
| **[Go](https://go.dev/)** | Primary language for HTTP APIs, services, and tooling (e.g. Ahadu API monolith). |
| **[sqlc](https://sqlc.dev/)** | Generates type-safe Go from SQL queries against **PostgreSQL** (no hand-written row scanning boilerplate). |
| **[golang-migrate](https://github.com/golang-migrate/migrate)** (**go-migrate**) | Database **schema migrations** (versioned SQL, applied in CI and local dev). |
| **[Air](https://github.com/air-verse/air)** | Live **reload** for Go during development (rebuild on file change). |

Typical flow: define SQL → `sqlc generate` → run migrations with migrate → serve with Go; use Air locally for a fast edit–run loop.

---

## Web

| Technology | Role |
|------------|------|
| **[React](https://react.dev/)** | **Web portal** UIs (issuer, admin, provider, onboarding) — component model, ecosystem, and deployment patterns aligned with the `web` (or equivalent) repo. |

The architecture docs describe the portal talking to the API over HTTP/JSON (often via a proxy path such as `/api/upstream`).

---

## Mobile

| Technology | Role |
|------------|------|
| **[Flutter](https://flutter.dev/)** | **Mobile wallet** app — cross-platform UI and tooling for Android/iOS in the `mobile` (or equivalent) repo. |

Wallet flows (credentials, consents, presentations) integrate with the same backend concepts documented under [Features](features.md) and [Endpoint reference](endpoints-from-architecture.md).

---

## Related reading

- [Getting started](getting-started.md) — clone, run, and repo layout
- [Architecture & flows](architecture-and-flows.md) — how portal, API, and data stores fit together
- [Kifiya-Hackathon-3 on GitHub](https://github.com/Kifiya-Hackathon-3) — source for `mobile`, `web`, API, and supporting services

---

*Update this page when you adopt new core tools (e.g. a different migrator or web framework) so onboarding stays accurate.*
