# Bookmark Manager API

A REST API built with NestJS, TypeScript, Prisma, and SQLite.

The repository currently contains the application infrastructure only: a
database-backed health endpoint, local and Docker environments, linting, and
unit and end-to-end test setups. Bookmark management, metadata extraction,
background tag classification, search, favourites, and authentication are
planned but not implemented yet.

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

## Docker

Build and start the production-style container:

```bash
npm run docker:up
```

Stop it with:

```bash
npm run docker:down
```

The container stores its SQLite database in a named Docker volume.

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
`prisma/schema.prisma`; it intentionally has no domain models or migrations
yet.

After adding or changing a model, create a development migration with:

```bash
npm run prisma:migrate
```

Apply committed migrations with:

```bash
npm run prisma:deploy
```

Local database files and environment files are ignored by Git.
