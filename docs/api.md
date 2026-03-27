# API reference

## Ahadu API (digital identity)

For the **Ahadu** HTTP surface (`/v1/*`), use the generated docs in this site:

- [Endpoint reference](endpoints-from-architecture.md) — routes, auth, bodies, and errors
- [Features](features.md) — product view by actor
- [Architecture & flows](architecture-and-flows.md) — C4 and sequences

The machine-readable contract lives in the Ahadu API repository as `api/openapi.yaml`.

---

## Other services

> **Stub** — add OpenAPI/Swagger links or endpoint tables for `liveness-api` and other Hackathon 3 services below.

## Conventions

- Use HTTPS in production.
- Send `Content-Type: application/json` for JSON bodies unless documented otherwise.

## Example request

```bash
curl -sS -X GET "https://api.example.com/v1/health" \
  -H "Accept: application/json"
```

## Example response

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

Link your generated spec here when available:

```markdown
- [OpenAPI JSON](https://example.com/openapi.json)
```
