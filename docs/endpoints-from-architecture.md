# Ahadu API — endpoint reference

Derived from [Architecture & flows](architecture-and-flows.md) (C4 + sequences) and [Features](features.md) (actor capabilities). This is the human-readable companion to `api/openapi.yaml` in the Ahadu API repository.

**Conventions**

- All routes live under `/v1/`.
- Request and response bodies are **JSON** (`application/json`).
- Auth column values: **None** = public, **Optional** = works with or without Bearer, **Bearer** = valid JWT required, **Admin** = Bearer with `admin` realm role.
- `sub` refers to the Keycloak JWT `sub` claim extracted by the auth middleware.
- IDs are UUID-style prefixed strings (e.g. `ind_…`, `sp_…`, `iss_…`, `cr_…`).

---

## 1. Authentication / SSO

### `POST /v1/auth/sso/token`

Obtain an access token via Keycloak (resource-owner / configured flow). Used by portal login and dev tooling.

| Property | Value |
|----------|-------|
| Auth | **None** (credentials in body) |

**Request body**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response `200 OK`**

```json
{
  "access_token": "string (JWT)",
  "refresh_token": "string",
  "expires_in": 300,
  "token_type": "Bearer"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 401 | Invalid credentials |
| 502 | Keycloak unreachable |

---

## 2. Individuals (holders)

### `POST /v1/individuals/register`

Create an individual profile. When called without a Bearer token, creates a standalone record. When called with a Bearer token, links the individual to the Keycloak `sub` and optionally syncs attributes via the Keycloak Admin API.

| Property | Value |
|----------|-------|
| Auth | **Optional** |

**Request body**

```json
{
  "full_name": "string (required)",
  "password": "string (required, min length enforced)"
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "full_name": "string",
  "keycloak_sub": "string (empty when no Bearer)",
  "created_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Missing/invalid fields, password too short |
| 409 | `sub` already linked to another individual |

**Sequence refs:** §5.1, §5.2 in architecture-and-flows.md

---

### `GET /v1/individuals/me`

Resolve the current individual from the JWT `sub` (Keycloak-linked individuals only).

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Response `200 OK`**

```json
{
  "id": "string",
  "full_name": "string",
  "keycloak_sub": "string",
  "created_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 401 | Missing/invalid token |
| 404 | No individual linked to this `sub` |

---

### `GET /v1/individuals/{id}`

Look up an individual by internal ID.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Individual ID |

**Response `200 OK`** — same shape as `/me`.

**Errors**

| Code | Condition |
|------|-----------|
| 404 | Individual not found |

---

### `GET /v1/individuals/me/provider-credential-requests`

List service-provider credential requests targeting the authenticated individual (holder inbox).

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Response `200 OK`**

```json
{
  "requests": [
    {
      "id": "string",
      "service_provider_id": "string",
      "individual_id": "string",
      "credential_type": "string",
      "claims": {},
      "status": "PENDING | ACCEPTED | REJECTED",
      "created_at": "ISO 8601",
      "decided_at": "ISO 8601 | null"
    }
  ]
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 404 | Individual not found for this `sub` |

**Sequence ref:** §5.3

---

### `POST /v1/individuals/me/provider-credential-requests/{id}/accept`

Accept a pending SP credential request.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Provider credential request ID |

**Response `200 OK`**

```json
{
  "id": "string",
  "status": "ACCEPTED",
  "decided_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 403 | Request does not belong to this individual |
| 404 | Request not found |
| 409 | Request is not in PENDING status |

**Sequence ref:** §5.4

---

### `POST /v1/individuals/me/provider-credential-requests/{id}/reject`

Reject a pending SP credential request.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Provider credential request ID |

**Response `200 OK`**

```json
{
  "id": "string",
  "status": "REJECTED",
  "decided_at": "ISO 8601"
}
```

**Errors** — same as `…/accept`.

**Sequence ref:** §5.5

---

## 3. Service providers

### `POST /v1/service-providers/register`

Register a new service provider. Anonymous callers must supply `contact_email`; authenticated callers are linked to their Keycloak `sub`.

| Property | Value |
|----------|-------|
| Auth | **Optional** |

**Request body**

```json
{
  "name": "string (required)",
  "contact_email": "string (required when no Bearer)",
  "website": "string (optional)",
  "id": "string (optional, server generates if omitted)"
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "name": "string",
  "contact_email": "string",
  "website": "string | null",
  "keycloak_sub": "string | null",
  "created_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Missing required fields |
| 409 | `sub` already linked to a service provider |

**Sequence refs:** §6.1, §6.2

---

### `GET /v1/service-providers/me`

Get the service provider profile for the authenticated Keycloak user.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Response `200 OK`**

```json
{
  "id": "string",
  "name": "string",
  "contact_email": "string",
  "website": "string | null",
  "keycloak_sub": "string",
  "created_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 404 | No SP linked to this `sub` |

---

### `POST /v1/service-providers/credential-requests`

Create a credential request from the SP to an individual. The individual must exist (checked against SQL or memory store).

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Request body**

```json
{
  "individual_id": "string (required)",
  "credential_type": "string (required)",
  "claims": {}
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "service_provider_id": "string",
  "individual_id": "string",
  "credential_type": "string",
  "claims": {},
  "status": "PENDING",
  "created_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 404 | SP not found for `sub`, or individual not found |

**Sequence ref:** §6.3

---

### `GET /v1/service-providers/credential-requests`

List outgoing credential requests for the authenticated service provider.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Response `200 OK`**

```json
{
  "requests": [
    {
      "id": "string",
      "service_provider_id": "string",
      "individual_id": "string",
      "credential_type": "string",
      "claims": {},
      "status": "PENDING | ACCEPTED | REJECTED",
      "created_at": "ISO 8601",
      "decided_at": "ISO 8601 | null"
    }
  ]
}
```

**Sequence ref:** §6.4

---

## 4. Issuers

### `POST /v1/issuers/register`

Self-register an issuer organization. Newly registered issuers start in a pending/untrusted state until a platform admin verifies them.

| Property | Value |
|----------|-------|
| Auth | **Optional** |

**Request body**

```json
{
  "name": "string (required)",
  "organization": "string",
  "country": "string",
  "website": "string",
  "contact_email": "string"
}
```

**Response `200 OK` / `201 Created`**

```json
{
  "id": "string",
  "issuer_reference_id": "string",
  "name": "string",
  "organization": "string",
  "country": "string",
  "trusted": false,
  "created_at": "ISO 8601"
}
```

**Sequence ref:** §7.1

---

### `GET /v1/issuers`

List all issuers. Used by admin UIs and operator tooling.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Response `200 OK`**

```json
[
  {
    "id": "string",
    "issuer_reference_id": "string",
    "name": "string",
    "organization": "string",
    "trusted": true,
    "suspended": false,
    "created_at": "ISO 8601"
  }
]
```

---

### `GET /v1/issuers/{id}`

Get a single issuer by ID.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Issuer ID |

**Response `200 OK`** — single issuer object (same shape as list element).

**Errors**

| Code | Condition |
|------|-----------|
| 404 | Issuer not found |

---

### `POST /v1/issuers/{issuerId}/credentials/requests/{requestId}/review`

Trusted issuer reviews a submitted credential request, approving or rejecting it.

| Property | Value |
|----------|-------|
| Auth | **Bearer** (must be trusted issuer for `issuerId`) |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `issuerId` | string | Issuer ID (must be trusted) |
| `requestId` | string | Credential request ID |

**Request body**

```json
{
  "decision": "APPROVED | REJECTED",
  "message": "string (required)"
}
```

**Response `200 OK`**

```json
{
  "id": "string",
  "subject_id": "string",
  "type": "string",
  "target_issuer_id": "string",
  "status": "APPROVED | REJECTED",
  "review_message": "string",
  "reviewed_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 403 | Issuer is not trusted |
| 404 | Issuer or request not found |
| 400 | Request is not in SUBMITTED status |

**Sequence ref:** §7.4

---

### `POST /v1/issuers/{issuerId}/credentials/issue`

Issue a credential after the associated request has been approved. May trigger fraud scoring.

| Property | Value |
|----------|-------|
| Auth | **Bearer** (must be trusted issuer for `issuerId`) |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `issuerId` | string | Issuer ID |

**Request body**

```json
{
  "request_id": "string (required)",
  "signed_credential_jwt": "string",
  "issuer_claims": {},
  "credential_type": "string"
}
```

**Response `201 Created`**

```json
{
  "credential": {
    "id": "string",
    "request_id": "string",
    "issuer_id": "string",
    "subject_id": "string",
    "type": "string",
    "claims": {},
    "signed_credential_jwt": "string",
    "issued_at": "ISO 8601"
  },
  "fraud": {
    "score": 0.0,
    "flags": []
  }
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Request is not in APPROVED status |
| 403 | Issuer not trusted |
| 404 | Issuer or request not found |

**Sequence ref:** §7.5

---

## 5. Credential requests (wallet / subject-driven)

### `POST /v1/credentials/requests`

Create a draft credential request targeting an issuer.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Request body**

```json
{
  "subject_id": "string (required)",
  "type": "string (required)",
  "claims": {},
  "target_issuer_id": "string (required)"
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "subject_id": "string",
  "type": "string",
  "claims": {},
  "target_issuer_id": "string",
  "status": "DRAFT",
  "created_at": "ISO 8601"
}
```

**Sequence ref:** §7.2

---

### `POST /v1/credentials/requests/{id}/submit`

Submit a draft credential request for issuer review.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Credential request ID |

**Response `200 OK`**

```json
{
  "id": "string",
  "status": "SUBMITTED",
  "submitted_at": "ISO 8601"
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Request is not in DRAFT status |
| 404 | Request not found |

**Sequence ref:** §7.3

---

### `GET /v1/credentials/requests`

List credential requests. Supports filtering by `target_issuer_id` for issuer queue views.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `target_issuer_id` | string | Filter by target issuer (optional) |
| `status` | string | Filter by status (optional) |

**Response `200 OK`**

```json
[
  {
    "id": "string",
    "subject_id": "string",
    "type": "string",
    "claims": {},
    "target_issuer_id": "string",
    "status": "DRAFT | SUBMITTED | APPROVED | REJECTED",
    "created_at": "ISO 8601",
    "reviewed_at": "ISO 8601 | null"
  }
]
```

**Sequence ref:** §7.6

---

### `GET /v1/credentials/requests/{id}`

Get a single credential request by ID.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Credential request ID |

**Response `200 OK`** — single credential request object.

**Errors**

| Code | Condition |
|------|-----------|
| 404 | Request not found |

---

## 6. Wallets

### `GET /v1/wallets/{subjectId}/credentials`

List issued credentials for a subject (wallet-style holder view).

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `subjectId` | string | Subject / individual ID |

**Response `200 OK`**

```json
[
  {
    "id": "string",
    "issuer_id": "string",
    "subject_id": "string",
    "type": "string",
    "claims": {},
    "signed_credential_jwt": "string",
    "issued_at": "ISO 8601"
  }
]
```

---

## 7. Platform admin

### `POST /v1/issuers/{id}/verify`

Activate a pending issuer as trusted. Enables the issuer to review credential requests and issue credentials.

| Property | Value |
|----------|-------|
| Auth | **Admin** (Bearer with `admin` realm role) |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Issuer ID |

**Response `200 OK`** — updated issuer object with `trusted: true`.

**Errors**

| Code | Condition |
|------|-----------|
| 403 | Caller lacks `admin` role |
| 404 | Issuer not found |

**Sequence ref:** §8.1

---

### `POST /v1/issuers/{id}/suspend`

Suspend an active issuer. Suspended issuers cannot review or issue credentials.

| Property | Value |
|----------|-------|
| Auth | **Admin** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Issuer ID |

**Response `200 OK`** — updated issuer object with `suspended: true`.

**Errors**

| Code | Condition |
|------|-----------|
| 403 | Caller lacks `admin` role |
| 404 | Issuer not found |

**Sequence ref:** §8.2

---

### `POST /v1/issuers/{id}/deactivate`

Deactivate an issuer (operational control, reversible via verify).

| Property | Value |
|----------|-------|
| Auth | **Admin** |

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Issuer ID |

**Response `200 OK`** — updated issuer object.

**Errors**

| Code | Condition |
|------|-----------|
| 403 | Caller lacks `admin` role |
| 404 | Issuer not found |

---

### `GET /v1/admin/high-risk-cases`

Aggregated fraud / high-risk cases for the admin dashboard.

| Property | Value |
|----------|-------|
| Auth | **Admin** |

**Response `200 OK`**

```json
{
  "cases": [
    {
      "id": "string",
      "subject_id": "string",
      "credential_id": "string | null",
      "risk_score": 0.0,
      "flags": ["string"],
      "created_at": "ISO 8601"
    }
  ]
}
```

**Sequence ref:** §8.3

---

## 8. Consent, presentations, and privacy (holder-centric)

Supporting routes for wallet-aligned consent and selective-disclosure flows.

### `POST /v1/consents`

Record holder consent for a credential sharing event.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Request body**

```json
{
  "subject_id": "string",
  "credential_id": "string",
  "requesting_party_id": "string",
  "scope": ["string"]
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "status": "GRANTED",
  "created_at": "ISO 8601"
}
```

---

### `POST /v1/presentations/create`

Create a verifiable presentation for selected credentials.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Request body**

```json
{
  "subject_id": "string",
  "credential_ids": ["string"],
  "audience": "string"
}
```

**Response `201 Created`**

```json
{
  "id": "string",
  "presentation_jwt": "string",
  "created_at": "ISO 8601"
}
```

---

### `POST /v1/privacy/selective-disclosure`

Generate a selective disclosure view of a credential, exposing only requested fields.

| Property | Value |
|----------|-------|
| Auth | **Bearer** |

**Request body**

```json
{
  "credential_id": "string",
  "disclosed_fields": ["string"]
}
```

**Response `200 OK`**

```json
{
  "credential_id": "string",
  "disclosed": {},
  "proof": "string"
}
```

---

## Route summary table

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | POST | `/v1/auth/sso/token` | None | Obtain access token |
| 2 | POST | `/v1/individuals/register` | Optional | Individual registration |
| 3 | GET | `/v1/individuals/me` | Bearer | Current individual profile |
| 4 | GET | `/v1/individuals/{id}` | Bearer | Individual by ID |
| 5 | GET | `/v1/individuals/me/provider-credential-requests` | Bearer | Holder inbox |
| 6 | POST | `/v1/individuals/me/provider-credential-requests/{id}/accept` | Bearer | Accept SP request |
| 7 | POST | `/v1/individuals/me/provider-credential-requests/{id}/reject` | Bearer | Reject SP request |
| 8 | POST | `/v1/service-providers/register` | Optional | SP registration |
| 9 | GET | `/v1/service-providers/me` | Bearer | Current SP profile |
| 10 | POST | `/v1/service-providers/credential-requests` | Bearer | Create credential request to individual |
| 11 | GET | `/v1/service-providers/credential-requests` | Bearer | List SP outgoing requests |
| 12 | POST | `/v1/issuers/register` | Optional | Issuer self-registration |
| 13 | GET | `/v1/issuers` | Bearer | List issuers |
| 14 | GET | `/v1/issuers/{id}` | Bearer | Get issuer |
| 15 | POST | `/v1/issuers/{issuerId}/credentials/requests/{requestId}/review` | Bearer | Review credential request |
| 16 | POST | `/v1/issuers/{issuerId}/credentials/issue` | Bearer | Issue credential |
| 17 | POST | `/v1/credentials/requests` | Bearer | Create draft credential request |
| 18 | POST | `/v1/credentials/requests/{id}/submit` | Bearer | Submit for review |
| 19 | GET | `/v1/credentials/requests` | Bearer | List credential requests |
| 20 | GET | `/v1/credentials/requests/{id}` | Bearer | Get credential request |
| 21 | GET | `/v1/wallets/{subjectId}/credentials` | Bearer | List wallet credentials |
| 22 | POST | `/v1/issuers/{id}/verify` | Admin | Verify issuer |
| 23 | POST | `/v1/issuers/{id}/suspend` | Admin | Suspend issuer |
| 24 | POST | `/v1/issuers/{id}/deactivate` | Admin | Deactivate issuer |
| 25 | GET | `/v1/admin/high-risk-cases` | Admin | Fraud dashboard |
| 26 | POST | `/v1/consents` | Bearer | Record consent |
| 27 | POST | `/v1/presentations/create` | Bearer | Create presentation |
| 28 | POST | `/v1/privacy/selective-disclosure` | Bearer | Selective disclosure |

---

## Status lifecycle reference

### Provider credential request (SP → Individual)

```
PENDING  ──accept──▶  ACCEPTED
   │
   └──reject──▶  REJECTED
```

### Credential request (Subject → Issuer)

```
DRAFT  ──submit──▶  SUBMITTED  ──review(APPROVED)──▶  APPROVED  ──issue──▶  (Credential created)
                        │
                        └──review(REJECTED)──▶  REJECTED
```

### Issuer trust state

```
(registered/pending)  ──verify──▶  TRUSTED/ACTIVE  ──suspend──▶  SUSPENDED
                                        │                           │
                                        └──deactivate──▶  INACTIVE  │
                                        ◀──verify────────────────────┘
```

---

## Related documents

| Doc | Purpose |
|-----|---------|
| [Architecture & flows](architecture-and-flows.md) | C4 views and sequence diagrams |
| [Features](features.md) | Actor capabilities and gaps |
| `implementation-plan.md` (repo root) | Phased engineering roadmap |
| `api/openapi.yaml` (Ahadu API repo) | Authoritative machine-readable contract |

---

*Generated from architecture-and-flows.md and features.md. Update this document when routes are added, removed, or when request/response shapes change.*
