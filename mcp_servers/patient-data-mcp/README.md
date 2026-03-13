# patient-data-mcp

MCP stdio server exposing read-only tools to fetch patient and monitoring data from the MedConnect backend.

## Env

- `MEDCONNECT_API_URL` (default `http://localhost:3001`)
- `MEDCONNECT_API_TOKEN` (optional, sent as `Authorization: Bearer ...`)

## Run

```bash
npm install
npm run dev
```

Or build:

```bash
npm run build
npm start
```
