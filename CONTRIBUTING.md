# Contributing to waporta

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Ways to Contribute

- Report bugs via [GitHub Issues](https://github.com/iniadil/waporta/issues)
- Suggest features or improvements
- Submit pull requests for bug fixes or new features
- Improve documentation

## Development Setup

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
npm install
cp .env.example .env
# Edit .env: set DASHBOARD_USERNAME and DASHBOARD_PASSWORD
```

**Run in development mode (backend + dashboard with hot reload):**

```bash
npm run dev:all
```

- Backend API: `http://localhost:3000`
- Dashboard (dev): `http://localhost:5173`

**Build for production:**

```bash
npm run dashboard:build  # build dashboard static files
npm run start            # build backend + serve everything at :3000
```

## Project Structure

```
waporta/
├── src/
│   ├── index.ts          # App entry point, route registration
│   ├── apikeys.ts        # API key CRUD (persisted to data/api_keys.json)
│   ├── middleware/
│   │   └── auth.ts       # Session token + API key auth middleware
│   └── routes/
│       ├── auth.ts       # POST /auth/login, /logout, GET /auth/check
│       ├── apikeys.ts    # GET/POST/DELETE /api/keys
│       └── whatsapp.ts   # WhatsApp session + messaging routes
├── dashboard/
│   └── src/
│       ├── App.tsx        # Root: auth gate → LoginPage or Shell
│       ├── api/           # Typed fetch wrappers
│       ├── components/    # Layout (Shell, Sidebar, Header)
│       ├── hooks/         # useAuth (token lifecycle)
│       └── pages/         # Sessions, Messaging, Checker, ApiKeys, Login
├── scripts/
│   └── gen-swagger.ts    # OpenAPI spec generator
├── index.ts              # Hono server bootstrap
└── docker-compose.yml
```

## Making Changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/your-bug-description
   # or
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep them focused — one fix or feature per PR.

3. **Test manually** against a running instance before opening a PR.

4. **Open a pull request** against `main` with a clear description of what changed and why.

## Code Style

- TypeScript for all backend and dashboard code
- No linter is enforced yet — match the style of surrounding code
- Avoid unnecessary abstractions; prefer simple, direct code
- Keep components and functions small and focused

## Commit Messages

Use short, imperative sentences:

```
fix: session QR not refreshing after expiry
feat: add document send endpoint
docs: update API reference for pairing code
```

Prefix: `fix`, `feat`, `docs`, `refactor`, `chore`

## Reporting Bugs

Include in your issue:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version, OS, Docker version (if applicable)
- Relevant logs or error messages

## Questions

Open a [GitHub Discussion](https://github.com/iniadil/waporta/discussions) for questions that aren't bugs or feature requests.
