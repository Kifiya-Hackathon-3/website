# Ahadu platform — C4 & sequence flows

> **Diagrams in the browser:** Sequence and flowchart blocks render via Mermaid in Docsify. **C4** blocks (`C4Context`, `C4Container`, `C4Component`) need a Mermaid build with C4 support; if they fail here, preview this file in GitHub or an editor with Mermaid.

This document complements [features](features.md) with **C4 model views** (context, container, component) and **sequence diagrams** for the main HTTP-driven flows. Diagrams use [Mermaid](https://mermaid.js.org/); render in GitHub, GitLab, VS Code (Mermaid preview), or Confluence (Mermaid macro).

**Legend**

- **Ahadu API** — Go monolith, routes under `/v1/*`.
- **Memory** — in-memory store (subjects, credential requests, issuers, etc.) when not using SQL-only paths.
- **PostgreSQL** — required for **service providers** and **Postgres-backed individuals** (`DATABASE_URL`).

---

## 1. C4 Level 1 — System context

Who interacts with the platform and external systems.

```mermaid
C4Context
title System context — Ahadu digital identity platform

Person(individual, "Individual (holder)", "Registers, receives SP requests, wallet-style flows.")
Person(sp_operator, "Service provider operator", "Registers org, creates credential requests to individuals.")
Person(issuer_operator, "Issuer operator", "Reviews credential requests, issues credentials.")
Person(platform_admin, "Platform admin", "Verifies/suspends issuers, fraud views.")

System_Ext(keycloak, "Keycloak", "OIDC/OAuth2, realm JWTs (e.g. eudi-wallet).")
System_Ext(wallet_app, "Wallet / holder client", "Optional future EUDI wallet; uses API as backend.")

System_Boundary(ahadu, "Ahadu product boundary") {
  System(ahadu_api, "Ahadu API", "REST JSON, JWT validation, business rules.")
  System(web_portal, "Web portal", "Next.js — issuer, admin, provider, onboarding UIs.")
}

SystemDb_Ext(postgres, "PostgreSQL", "Service providers, individuals (when migrated from memory).")

Rel(individual, keycloak, "Sign-in", "OIDC")
Rel(sp_operator, keycloak, "Sign-in", "OIDC")
Rel(issuer_operator, keycloak, "Sign-in", "OIDC")
Rel(platform_admin, keycloak, "Sign-in", "OIDC")

Rel(individual, web_portal, "HTTPS", "Browser")
Rel(sp_operator, web_portal, "HTTPS", "Browser")
Rel(issuer_operator, web_portal, "HTTPS", "Browser")
Rel(platform_admin, web_portal, "HTTPS", "Browser")

Rel(web_portal, ahadu_api, "HTTPS", "Reverse proxy / API upstream")
Rel(wallet_app, ahadu_api, "HTTPS", "Bearer API calls")

Rel(ahadu_api, keycloak, "JWKS verify", "HTTPS")
Rel(ahadu_api, keycloak, "Admin API (optional)", "User sync on register")
Rel(ahadu_api, postgres, "SQL", "TCP")
```

---

## 2. C4 Level 2 — Containers

Software inside the product boundary.

```mermaid
C4Container
title Container diagram — Ahadu platform

Person(user, "Actor", "Individual, SP, issuer, or admin (via browser).")

System_Boundary(platform, "Ahadu platform") {
  Container(portal, "Web portal", "Next.js, React", "Issuer / admin / provider / onboard pages; sessionStorage JWT.")
  Container(api, "Ahadu API", "Go HTTP server", "Routing, auth middleware, domain modules, OpenAPI.")
  ContainerDb(pg, "PostgreSQL", "RDBMS", "service_providers, individuals, provider_credential_requests.")
}

System_Ext(kc, "Keycloak", "Identity provider")

Rel(user, portal, "Uses", "HTTPS")
Rel(portal, api, "API calls", "HTTP JSON (often proxied as /api/upstream → API)")
Rel(portal, kc, "Login redirect (optional)", "OIDC in browser")
Rel(api, kc, "Validate JWT / JWKS", "HTTPS")
Rel(api, pg, "sqlc / database/sql", "When DATABASE_URL set")

UpdateRelStyle(api, pg, $offsetY="-10", $offsetX="-40")
```

**Note:** When `DATABASE_URL` is unset, service-provider routes return **503**; much issuer/credential logic still uses **in-memory** storage inside the API process (no separate container).

**api2 codebase (persistence detail):** `individuals.Service` still **registers** holders in memory. When Postgres is enabled, `serviceprovider` can **resolve** a holder by Keycloak `sub` and validate `individual_id` against SQL **or** memory (`individualExists`), so compose-seeded or migrated individuals participate in SP flows alongside memory-only registrations. See **implementation-plan.md** §10 in the repository root (next to the `docs/` folder).

---

## 3. C4 Level 3 — Component diagram (Ahadu API)

Logical components inside the API (simplified).

```mermaid
C4Component
title Component diagram — Ahadu API (internal)

Container_Boundary(api_proc, "Ahadu API process") {
  Component(router, "HTTP router", "internal/platform/http", "Method/path dispatch.")
  Component(auth_mw, "Auth middleware", "JWT + JWKS", "Require / Optional / RequireRole(admin).")
  Component(issuer_mod, "Issuer module", "issuer.Service", "Register, list, verify, suspend, trusted list.")
  Component(sp_mod, "Service provider module", "serviceprovider", "Register, me, credential-requests.")
  Component(cred_mod, "Credentials module", "credentials.Service", "Requests, review, issue.")
  Component(ind_mod, "Individuals module", "individuals.Service", "Register, Keycloak link, SP inbox.")
  Component(admin_mod, "Admin / fraud", "admin, fraud", "High-risk cases, scoring hooks.")
  Component(store_mem, "Memory store", "store.Memory", "Subjects, issuers, credential requests (demo).")
  Component(store_sql, "SQL store", "sqlc Queries", "Postgres-backed rows.")
}

ContainerDb(pg, "PostgreSQL", "", "")
Rel(router, auth_mw, "wraps handlers")
Rel(router, issuer_mod, "HTTP →")
Rel(router, sp_mod, "HTTP →")
Rel(router, cred_mod, "HTTP →")
Rel(router, ind_mod, "HTTP →")
Rel(router, admin_mod, "HTTP →")
Rel(issuer_mod, store_mem, "read/write")
Rel(cred_mod, store_mem, "read/write")
Rel(sp_mod, store_sql, "read/write")
Rel(ind_mod, store_mem, "read/write")
Rel(ind_mod, store_sql, "read/write")
Rel(sp_mod, pg, "via sqlc")
Rel(ind_mod, pg, "via sqlc")
```

---

## 4. Sequence diagrams — Identity

### 4.1 Obtain access token (resource-owner style, dev / portal)

```mermaid
sequenceDiagram
  autonumber
  actor Client as Client (portal / curl)
  participant Portal as Web portal (optional)
  participant API as Ahadu API
  participant KC as Keycloak

  Client->>API: POST /v1/auth/sso/token<br/>{ username, password }
  API->>KC: Token endpoint (password grant / configured flow)
  KC-->>API: access_token, refresh_token, ...
  API-->>Client: 200 { access_token, ... }
  Note over Client: Store Bearer for subsequent /v1/* calls
```

### 4.2 Call protected endpoint (JWT validation)

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant API as Ahadu API
  participant JWKS as Keycloak JWKS

  Client->>API: GET /v1/... + Authorization: Bearer JWT
  alt First request / cache miss
    API->>JWKS: Fetch signing keys
    JWKS-->>API: JWK set
  end
  API->>API: Parse JWT, verify iss, aud, signature, exp
  alt Invalid / missing token (Require)
    API-->>Client: 401 Unauthorized
  else Valid
    API->>API: Set context: sub, realm roles
    API->>API: Handler logic
    API-->>Client: 2xx + JSON
  end
```

---

## 5. Sequence diagrams — Individuals (holders)

### 5.1 Individual self-registration (no Bearer)

```mermaid
sequenceDiagram
  autonumber
  actor User as Individual
  participant API as Ahadu API
  participant Mem as Memory / Individual store

  User->>API: POST /v1/individuals/register<br/>{ full_name, password }
  API->>API: Validate password length, hash password
  API->>Mem: Create Individual record
  Mem-->>API: id, full_name, created_at
  API-->>User: 201 { id, full_name, keycloak_sub: "" , created_at }
```

### 5.2 Individual registration with Bearer (link to Keycloak)

```mermaid
sequenceDiagram
  autonumber
  actor User as Individual
  participant API as Ahadu API
  participant KC as Keycloak Admin API
  participant Mem as Individual store

  User->>API: POST /v1/individuals/register<br/>Bearer JWT + { full_name, password }
  API->>API: Validate JWT → sub
  API->>Mem: Create / link individual to keycloak_sub
  alt KEYCLOAK_ADMIN_* configured
    API->>KC: Update user password, attributes (individual_id, …)
    KC-->>API: OK / error
  end
  API-->>User: 201 { id, full_name, keycloak_sub, … }
```

### 5.3 Individual — list SP credential requests (inbox)

```mermaid
sequenceDiagram
  autonumber
  actor Holder as Individual
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Holder->>API: GET /v1/individuals/me/provider-credential-requests<br/>Bearer JWT
  API->>API: sub from JWT
  API->>SPsvc: ResolveIndividualByKeycloak(sub)
  SPsvc->>DB: Get individual by keycloak_sub / memory fallback
  DB-->>SPsvc: individual_id
  SPsvc->>DB: ListProviderCredentialRequestsForIndividual
  DB-->>API: rows
  API-->>Holder: 200 { requests: [...] }
```

### 5.4 Individual — accept SP credential request

```mermaid
sequenceDiagram
  autonumber
  actor Holder as Individual
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Holder->>API: POST /v1/individuals/me/provider-credential-requests/{id}/accept<br/>Bearer JWT
  API->>SPsvc: ResolveIndividualByKeycloak(sub) → individual_id
  SPsvc->>DB: DecideProviderCredentialRequest(id, ACCEPTED, individual_id)
  alt Not PENDING / wrong individual
    API-->>Holder: 403 / 404 / 409
  else OK
    DB-->>API: updated row
    API-->>Holder: 200 { id, status: ACCEPTED, … }
  end
```

### 5.5 Individual — reject SP credential request

```mermaid
sequenceDiagram
  autonumber
  actor Holder as Individual
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Holder->>API: POST /v1/individuals/me/provider-credential-requests/{id}/reject<br/>Bearer JWT
  API->>SPsvc: Decide(..., REJECTED, ...)
  SPsvc->>DB: Update status REJECTED
  API-->>Holder: 200 { id, status: REJECTED, … }
```

---

## 6. Sequence diagrams — Service providers

### 6.1 Service provider — public registration (no Bearer)

```mermaid
sequenceDiagram
  autonumber
  actor Op as SP operator / form
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Op->>API: POST /v1/service-providers/register<br/>{ name, contact_email, website?, id? }
  Note over API: Optional auth: no Bearer → anonymous path
  API->>SPsvc: Register(ctx, id, name, website, email, keycloakSub="")
  SPsvc->>SPsvc: Require contact_email when sub empty
  SPsvc->>DB: INSERT service_providers (keycloak_sub NULL)
  DB-->>API: row
  API-->>Op: 201 { id, name, contact_email, … }
```

### 6.2 Service provider — authenticated registration (linked to Keycloak)

```mermaid
sequenceDiagram
  autonumber
  actor Op as SP operator
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Op->>API: POST /v1/service-providers/register<br/>Bearer JWT + { name, … }
  API->>API: sub from JWT
  SPsvc->>DB: GetServiceProviderByKeycloakSub(sub)
  alt Already exists
    API-->>Op: 409 Conflict
  else New
    SPsvc->>DB: INSERT with keycloak_sub = sub
    API-->>Op: 201 { id, keycloak_sub, … }
  end
```

### 6.3 Service provider — create credential request to individual

```mermaid
sequenceDiagram
  autonumber
  actor Op as SP operator
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Op->>API: POST /v1/service-providers/credential-requests<br/>Bearer JWT<br/>{ individual_id, credential_type, claims }
  API->>SPsvc: Me(sub) → service_provider row
  alt Not registered as SP
    API-->>Op: 404
  else OK
    SPsvc->>SPsvc: individualExists(individual_id)
    alt Individual unknown
      API-->>Op: 404 individual not found
    else OK
      SPsvc->>DB: INSERT provider_credential_requests (PENDING)
      API-->>Op: 201 { id, status: PENDING, … }
    end
  end
```

### 6.4 Service provider — list outgoing requests

```mermaid
sequenceDiagram
  autonumber
  actor Op as SP operator
  participant API as Ahadu API
  participant SPsvc as serviceprovider.Service
  participant DB as PostgreSQL

  Op->>API: GET /v1/service-providers/credential-requests<br/>Bearer JWT
  API->>SPsvc: Me + ListOutgoing(sp_id)
  SPsvc->>DB: SELECT … WHERE service_provider_id
  API-->>Op: 200 { requests: [...] }
```

---

## 7. Sequence diagrams — Issuers & credential lifecycle (memory-backed)

*Typical demo path: subject creates wallet credential **request** targeting an issuer; issuer **reviews** and **issues**.*

### 7.1 Issuer self-registration

```mermaid
sequenceDiagram
  autonumber
  actor Org as Issuer org
  participant API as Ahadu API
  participant Iss as issuer.Service
  participant Mem as Memory store

  Org->>API: POST /v1/issuers/register<br/>(optional Bearer)<br/>JSON profile fields
  API->>Iss: Register / upsert issuer (pending state)
  Iss->>Mem: Persist Issuer + TrustedIssuer entry
  API-->>Org: 200/201 + issuer_reference_id, id, …
```

### 7.2 Credential request — create draft

```mermaid
sequenceDiagram
  autonumber
  actor Client as Wallet / subject client
  participant API as Ahadu API
  participant Cred as credentials.Service
  participant Mem as Memory store

  Client->>API: POST /v1/credentials/requests<br/>Bearer JWT<br/>{ subject_id, type, claims, target_issuer_id }
  API->>Cred: CreateRequest(...)
  Cred->>Mem: Store CredentialRequest status=DRAFT
  API-->>Client: 201 CredentialRequest
```

### 7.3 Credential request — submit for issuer review

```mermaid
sequenceDiagram
  autonumber
  actor Client as Wallet / subject client
  participant API as Ahadu API
  participant Cred as credentials.Service
  participant Mem as Memory store

  Client->>API: POST /v1/credentials/requests/{id}/submit<br/>Bearer JWT
  API->>Cred: SubmitRequest(id)
  Cred->>Mem: status := SUBMITTED
  API-->>Client: 200 CredentialRequest
```

### 7.4 Issuer — review request (approve)

```mermaid
sequenceDiagram
  autonumber
  actor IssOp as Issuer operator
  participant API as Ahadu API
  participant Iss as issuer.Service
  participant Cred as credentials.Service
  participant Mem as Memory store

  IssOp->>API: POST /v1/issuers/{issuerId}/credentials/requests/{requestId}/review<br/>Bearer JWT<br/>{ decision: APPROVED, message }
  API->>API: Require trusted issuer, admin not required for this route
  API->>Iss: IsTrusted(issuerId) + Get
  alt Issuer not trusted / not found
    API-->>IssOp: 403 / 404
  else OK
    API->>Cred: ReviewRequest(id, issuerId, APPROVED, message)
    Cred->>Mem: status APPROVED, review metadata
    API-->>IssOp: 200 CredentialRequest
  end
```

### 7.5 Issuer — issue credential after approval

```mermaid
sequenceDiagram
  autonumber
  actor IssOp as Issuer operator
  participant API as Ahadu API
  participant Iss as issuer.Service
  participant Cred as credentials.Service
  participant Fraud as fraud.Service
  participant Mem as Memory store

  IssOp->>API: POST /v1/issuers/{issuerId}/credentials/issue<br/>Bearer JWT<br/>{ request_id, signed_credential_jwt, issuer_claims, … }
  API->>Iss: IsTrusted(issuerId)
  API->>Cred: GetRequest(request_id)
  alt Request not APPROVED
    API-->>IssOp: 400
  else OK
    API->>Fraud: Score(input from request + claims)
    API->>Cred: Issue(Credential{…})
    Cred->>Mem: Persist Credential
    API-->>IssOp: 201 { credential, fraud }
  end
```

### 7.6 List credential requests (e.g. issuer queue / integration)

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant API as Ahadu API
  participant Cred as credentials.Service
  participant Mem as Memory store

  Client->>API: GET /v1/credentials/requests?target_issuer_id=…<br/>Bearer JWT
  API->>Cred: ListRequests(targetIssuerId)
  Cred->>Mem: Scan + filter + sort
  API-->>Client: 200 [ CredentialRequest, … ]
```

---

## 8. Sequence diagrams — Platform admin

### 8.1 Verify issuer (activate trusted issuer)

```mermaid
sequenceDiagram
  autonumber
  actor Adm as Platform admin
  participant API as Ahadu API
  participant Iss as issuer.Service
  participant Mem as Memory store

  Adm->>API: POST /v1/issuers/{id}/verify<br/>Bearer JWT (role admin)
  alt Not admin role
    API-->>Adm: 403
  else OK
    API->>Iss: Verify(id)
    Iss->>Mem: Issuer status/trusted flags
    API-->>Adm: 200 Issuer
  end
```

### 8.2 Suspend issuer

```mermaid
sequenceDiagram
  autonumber
  actor Adm as Platform admin
  participant API as Ahadu API
  participant Iss as issuer.Service

  Adm->>API: POST /v1/issuers/{id}/suspend<br/>Bearer JWT (admin)
  API->>Iss: Suspend(id)
  API-->>Adm: 200 Issuer
```

### 8.3 Admin — high-risk / fraud dashboard feed

```mermaid
sequenceDiagram
  autonumber
  actor Adm as Platform admin
  participant API as Ahadu API
  participant Fraud as fraud / admin module
  participant Mem as Memory store

  Adm->>API: GET /v1/admin/high-risk-cases<br/>Bearer JWT (admin)
  API->>Fraud: Aggregate cases / scores
  Fraud->>Mem: Read fraud events, subjects, …
  API-->>Adm: 200 { cases: … }
```

---

## 9. End-to-end — SP request + holder decision (happy path)

Combines sections 6 and 5 for a single vertical slice.

```mermaid
sequenceDiagram
  autonumber
  actor SP as SP operator
  actor H as Individual (holder)
  participant API as Ahadu API
  participant DB as PostgreSQL

  SP->>API: POST …/service-providers/register (linked)
  API->>DB: service_providers row
  H->>API: POST …/individuals/register (+ optional Keycloak link)
  API->>DB: individuals row
  SP->>API: POST …/credential-requests { individual_id, credential_type, claims }
  API->>DB: provider_credential_requests PENDING
  H->>API: GET …/me/provider-credential-requests
  API-->>H: lists pending request
  H->>API: POST …/provider-credential-requests/{id}/accept
  API->>DB: status ACCEPTED
  Note over SP,H: SP does not receive credential payload in this module alone;<br/>downstream wallet/OIDC flows would consume ACCEPTED state.
```

---

## 10. End-to-end — Issuer credential pipeline (happy path)

```mermaid
sequenceDiagram
  autonumber
  actor Adm as Admin
  actor Iss as Issuer operator
  actor W as Wallet client (subject)
  participant API as Ahadu API
  participant Mem as Memory store

  W->>API: POST /v1/credentials/requests (DRAFT)
  W->>API: POST /v1/credentials/requests/{id}/submit
  Adm->>API: POST /v1/issuers/{issuerId}/verify
  Iss->>API: POST …/credentials/requests/{id}/review APPROVED
  Iss->>API: POST …/credentials/issue
  API->>Mem: Credential stored
  API-->>Iss: credential + fraud hints
```

---

## 11. Related documents

| Doc | Purpose |
|-----|---------|
| [Features](features.md) | Actor capabilities vs HTTP surface |
| [Endpoint reference](endpoints-from-architecture.md) | All HTTP routes with auth, request, and response summary (aligned with OpenAPI) |
| Ahadu API repo | `api/openapi.yaml` — authoritative paths and schemas |
| Repo root | `implementation-plan.md` — phased engineering roadmap |

---

*Generated for engineering onboarding and stakeholder reviews. Adjust participants if you split the API into multiple deployables or add a dedicated API gateway.*

---

## 12. Optional — operator assistance (AI features)

This section documents **optional** integrations described in [features](features.md) under *Platform admin → Operator assistance*. It does **not** change the Ahadu API trust model: **verify/suspend** remain authoritative on the API with **admin** JWT and audit; external agents are **not** first-class components inside the API process.

### 12.1 C4 context — external agent (add-on view)

Supplements §1: an operator may use a **personal agent** (e.g. PicoClaw) for read-heavy assistance; it sits **outside** the Ahadu product boundary.

```mermaid
C4Context
title Context add-on — optional operator agent (read-mostly assist)

Person(platform_admin, "Platform admin", "Reviews and verifies issuers.")
System_Ext(ai_agent, "External AI agent", "e.g. PicoClaw: skills, HTTP tools, optional chat gateway.")
System(ahadu_api, "Ahadu API", "REST + JWT validation.")
System_Ext(keycloak, "Keycloak", "Issues admin JWT for verify.")

Rel(platform_admin, ai_agent, "Prompts / chat", "HTTPS or local CLI")
Rel(ai_agent, ahadu_api, "GET issuers (optional)", "HTTPS + Bearer when configured")
Rel(platform_admin, keycloak, "Sign-in", "OIDC")
Rel(platform_admin, ahadu_api, "POST verify", "HTTPS + admin Bearer")
Rel(ahadu_api, keycloak, "JWKS", "HTTPS")
```

### 12.2 Sequence — operator copilot (recommended)

Human remains the authority for `POST /v1/issuers/{id}/verify`; the agent may only **fetch and summarize** (or suggest checklists).

```mermaid
sequenceDiagram
  autonumber
  actor Human as Platform admin
  participant Agent as External agent (e.g. PicoClaw)
  participant API as Ahadu API

  Human->>Agent: Ask for summary of pending issuers
  Agent->>API: GET /v1/issuers (Bearer as configured)
  API-->>Agent: JSON list / details
  Agent-->>Human: Narrative summary, checklist, suggested questions
  Human->>API: POST /v1/issuers/{id}/verify (admin JWT)
  Note over Human,API: Verify is always issued by the operator (or separate workflow), not by model output alone.
```

### 12.3 Sequence — safe automation (deterministic gate)

If automation calls **verify**, only **programmatic** rules (policy engine, validated code paths) should allow it; **LLM judgment** must not be the sole approval criterion.

```mermaid
sequenceDiagram
  autonumber
  participant Job as Workflow / batch job
  participant Policy as Policy engine or rules (e.g. OPA)
  participant API as Ahadu API

  Job->>API: GET /v1/issuers (or internal listing of pending)
  API-->>Job: Issuer payloads
  loop Each candidate
    Job->>Policy: Evaluate structured facts (allowlist, format, registry, duplicates)
    Policy-->>Job: permit | deny
    opt permit
      Job->>API: POST /v1/issuers/{id}/verify (service/admin token, audited)
      API-->>Job: 200 Issuer
    end
  end
  Note over Job,API: Audit every automated verify; least-privilege tokens for the job identity.
```

### 12.4 Cross-reference

| Topic | Detail in [features](features.md) |
|-------|----------------------------------------|
| Operator copilot | *Platform admin → Operator copilot (recommended use)* |
| Safe automation | *Platform admin → Safe automation (if you insist)* |
