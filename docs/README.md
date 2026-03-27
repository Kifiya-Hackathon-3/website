# Developer documentation

Welcome to the **Kifiya digital identity wallet** docs. This site is generated with [Docsify](https://docsify.js.org/) from Markdown in the `docs/` folder—no build step required.

## Aim of the project

**Kifiya Hackathon 3.0** is building a **digital identity wallet ecosystem** so people can **prove who they are**, **store credentials safely**, and **share only what each service needs**—with privacy and user control first.

Concretely, the programme aims to:

- Give **individuals (holders)** a wallet-style way to register, see credential requests from **service providers**, and accept or reject sharing.
- Let **issuers** register, be verified by **platform admins**, and **review and issue** credentials in line with wallet flows.
- Let **service providers** register and request credentials from known individuals, with clear states from request through holder decision.
- Align with **European Digital Identity (EUDI)** and related ideas (e.g. selective disclosure, OIDC-style issuance patterns) while keeping **HTTP APIs and portals** as the integration surface documented here.

The **Ahadu API** material in this site (`/v1/*` routes) describes the backend behaviour that supports those actors. **Mobile, web, and other repos** under [Kifiya-Hackathon-3](https://github.com/Kifiya-Hackathon-3) implement clients and adjacent services.

The public **download** experience for the app lives beside this docs app: open [`index.html`](../index.html) under `eudi-download/` when serving the folder locally.

## Quick links

- [Getting started](getting-started.md) — environment, clone, run
- [Features](features.md) — actors, capabilities, and HTTP surface (Ahadu API)
- [Architecture & flows](architecture-and-flows.md) — C4 views and sequence diagrams
- [Endpoint reference](endpoints-from-architecture.md) — routes, auth, request/response shapes
- [API reference](api.md) — shorter integration notes for this site

## Organisation

Source code and modules for Hackathon 3 live under the [Kifiya-Hackathon-3](https://github.com/Kifiya-Hackathon-3) GitHub organisation (e.g. `mobile`, `web`, `liveness-api`).

## Editing these docs

Add or change `.md` files in `eudi-download/docs/` and update `docs/_sidebar.md` when you add new pages. Refresh the browser to see changes.
