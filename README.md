# 🧨 Dynamite Lens

A minimal, **docker-driven, frontend-only** web UI for Amazon DynamoDB — built with **Angular 18** (standalone components + signals) and the **AWS SDK v3** running entirely in the browser. No backend of its own; a tiny `nginx:alpine` serves the static bundle and acts as a CORS proxy.

Works against **DynamoDB Local** and **real AWS**.

---

## Features

Implemented in the following order (see progress below):

**Phase 1 — Core**
- ✅ Connection manager: multiple profiles (endpoint, region, keys, session token), stored in `localStorage`; Test + Connect
- ✅ List tables, filter, table detail (status, item count, size, key schema, indexes, billing mode)
- ✅ Scan with pagination, projection & filter expressions
- ✅ Item viewer (dynamic column grid)

**Phase 2 — Editing**
- ✅ Create / Edit / Delete items (raw JSON editor)
- ✅ Query builder (Key Condition + Filter expressions, GSI/LSI selection, sort order)

**Phase 3 — Power features**
- ✅ PartiQL editor (SELECT/INSERT/UPDATE/DELETE) with parameters + saved queries
- ✅ Create / Delete tables (PK/SK, on-demand or provisioned)
- ✅ Export items (JSON / CSV) and bulk Import (BatchWrite, chunked)

**Phase 4 — Polish**
- ✅ Dark theme, saved PartiQL queries, multiple profiles
- ✅ docker-compose bundling DynamoDB Local

> Roadmap ideas: TTL management, GSI creation UI, capacity metrics, tree/JSON item view toggle, back-paging history, item copy/clone.

---

## Quick start (Docker)

```bash
docker compose up --build
```

- Web UI:      http://localhost:8080
- DynamoDB Local: http://localhost:8000 (also proxied at `/local`)

> ℹ️ The bundled DynamoDB Local runs **in-memory** (`-inMemory`), so data resets when the container restarts. This keeps the stack self-contained and avoids host volume permission issues. To persist data, mount a volume and switch the command to `-dbPath`.

### Connect to DynamoDB Local
1. Open http://localhost:8080 → **Connections** → **+ New**
2. Mode: **Local**, Endpoint: `/local`, keys: any value (e.g. `local` / `local`)
3. **Test** → **Connect**

### Connect to real AWS
1. **Connections** → **+ New** → Mode: **AWS**
2. Region: e.g. `us-east-1`; Endpoint auto-fills to `/aws/us-east-1` (routes through the built-in proxy so the browser isn't blocked by CORS)
3. Enter your **Access Key ID / Secret** (and Session Token if using temporary creds)
4. **Test** → **Connect**

> ⚠️ **Security note:** credentials live only in your browser's `localStorage` and are sent (SigV4-signed) to AWS via the local proxy. Use scoped/temporary IAM credentials. Do **not** expose this container publicly.

> ⚠️ **SigV4 & the proxy:** The AWS SDK signs requests for the real host `dynamodb.<region>.amazonaws.com`. The bundled nginx proxy forwards the signed request to that host and only adds CORS response headers (it does not re-sign). If your environment strips/modifies headers, prefer running against **DynamoDB Local**, or place the app behind an API Gateway / Lambda proxy that preserves the `Authorization` header.

---

## Local development

```bash
npm install
npm start        # ng serve on http://localhost:4200
```

For dev against DynamoDB Local without the proxy, start it with CORS enabled and set the profile endpoint to `http://localhost:8000`.

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

## Build a production bundle

```bash
npm run build    # outputs to dist/dynamite-lens/browser
```

---

## Architecture

```
Browser (Angular + AWS SDK v3)
        │  fetch  → /local/*        → nginx → dynamodb-local:8000
        │         → /aws/<region>/* → nginx → https://dynamodb.<region>.amazonaws.com
        ▼
   nginx:alpine (serves SPA + CORS reverse proxy)
```

- `src/app/services/connection.service.ts` — profile storage + SDK client factory
- `src/app/services/dynamo.service.ts` — all DynamoDB operations
- `src/app/features/*` — Connections, Tables, Table detail, PartiQL
- `docker/nginx.conf` — SPA hosting + `/local` and `/aws/<region>` proxies

## License

MIT
