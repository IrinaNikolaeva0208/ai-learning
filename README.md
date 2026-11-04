# Bookmark Manager API

A REST API built with NestJS, TypeScript, Prisma, and SQLite.

The API provides bookmark CRUD operations and a database-backed health check.

## Requirements

- Node.js 22
- npm
- Docker with Docker Compose, if running the containerised environment

## Local setup

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
mkdir -p data
```

Create the database tables:

```bash
npm run prisma:deploy
```

Start the development server:

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` by default. Verify it with:

```bash
curl http://localhost:3000/health
```

A healthy application returns:

```json
{
  "status": "ok",
  "database": "up"
}
```

## Configuration

The application validates its environment at startup and exits with a message
naming each invalid variable. Values are never included in that message.

| Variable                  | Required | Accepted values                                                    |
| ------------------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL`            | Yes      | Non-empty SQLite URL, relative to `prisma/schema.prisma`           |
| `PORT`                    | No       | Integer from 1 to 65535. Defaults to `3000`                        |
| `METADATA_WORKER_ENABLED` | No       | `true` or `false`. When unset, enabled unless `NODE_ENV` is `test` |

## Bookmark API

All request bodies are JSON. Unknown and server-managed fields are rejected.
`title`, `url`, and `description` are trimmed; an empty description is stored as
`null`. URLs must be absolute HTTP or HTTPS URLs.

| Method   | Route            | Body / query                                          | Success |
| -------- | ---------------- | ----------------------------------------------------- | ------- |
| `POST`   | `/bookmarks`     | `{ title, url, description? }`                        | `201`   |
| `GET`    | `/bookmarks`     | `page`, `limit`, optional `search`                    | `200`   |
| `GET`    | `/bookmarks/:id` | —                                                     | `200`   |
| `PATCH`  | `/bookmarks/:id` | Any non-empty subset of `title`, `url`, `description` | `200`   |
| `DELETE` | `/bookmarks/:id` | —                                                     | `204`   |

`title` is required on create and may contain 1–200 characters. `url` is
required on create, unique after trimming, and may contain up to 2048
characters. `description` is optional, nullable, and may contain up to 1000
characters. IDs must be UUID v4 values.

List responses have this shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

The maximum `limit` is 100. Results are ordered by creation time newest first,
with the ID as a stable descending tie-breaker. Pages beyond the final page
return an empty `data` array. Validation errors and invalid UUIDs return `400`,
missing bookmarks return `404`, and duplicate URLs return `409`. A create or
update returns `503` if the database is too busy to accept the write; it is safe
to retry.

The optional `search` query is trimmed and must contain 1–200 characters. It
matches one literal substring in the bookmark title, URL, or user-provided
description using ASCII case-insensitive comparison. Characters such as `%`
and `_` have no wildcard meaning. Search does not include fetched metadata, and
pagination totals count only matching bookmarks.

Every bookmark response also contains asynchronously fetched page metadata:

```json
{
  "metadata": {
    "status": "pending",
    "pageTitle": null,
    "description": null,
    "openGraph": {
      "title": null,
      "description": null,
      "imageUrl": null
    },
    "resolvedUrl": null,
    "fetchedAt": null
  }
}
```

The status moves through `pending`, `processing`, and either `ready` or
`failed`. Bookmark creation does not wait for the remote page. Changing a
bookmark URL clears stale metadata and queues another fetch; the user-supplied
bookmark title and description are never overwritten.

Metadata jobs are persisted in SQLite and processed by the API process. Set
`METADATA_WORKER_ENABLED=false` to disable processing while leaving queued jobs
intact. The fetcher accepts only public HTTP/HTTPS destinations on ports 80 and
443, validates every redirect, and limits response time and size.

## Docker

Build and start the development container:

```bash
npm run docker:up
```

Stop it with:

```bash
npm run docker:down
```

The container and local processes share the SQLite file at `data/dev.db`.

## Development commands

```bash
npm run build          # Compile the application
npm run lint           # Lint and fix TypeScript files
npm run format         # Format TypeScript files
npm test               # Run unit tests
npm run test:e2e       # Run end-to-end tests locally
npm run test:cov       # Run unit tests with coverage
npm run docker:test    # Run end-to-end tests in Docker
```

## Database

Prisma uses SQLite in every environment. The schema is defined in
`prisma/schema.prisma`; versioned migrations live in `prisma/migrations/`.

After adding or changing a model, create a development migration with:

```bash
npm run prisma:migrate
```

Apply committed migrations with:

```bash
npm run prisma:deploy
```

Local database files and environment files are ignored by Git.
