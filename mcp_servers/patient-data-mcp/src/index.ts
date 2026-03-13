import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiBaseUrl = (
  process.env.MEDCONNECT_API_URL || "http://localhost:3001"
).replace(/\/+$/, "");
const apiToken = process.env.MEDCONNECT_API_TOKEN || "";

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }
  return headers;
}

async function getJson(path: string): Promise<any> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, { method: "GET", headers: buildHeaders() });
  const text = await res.text();

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from ${url}: ${typeof json === "string" ? json : text}`,
    );
  }

  return json;
}

function toStructuredContent(value: any): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

const server = new McpServer({ name: "patient-data-mcp", version: "0.1.0" });

server.registerTool(
  "patients.list",
  {
    title: "List Patients",
    description:
      "Lists patients available to doctor/caregiver via the MedConnect backend.",
    inputSchema: z.object({}),
  },
  async () => {
    const data = await getJson("/api/patients");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "patients.get",
  {
    title: "Get Patient",
    description:
      "Fetches patient + latest health score via /api/patients/:patientId.",
    inputSchema: z.object({ patientId: z.string().min(1) }),
  },
  async ({ patientId }) => {
    const data = await getJson(
      `/api/patients/${encodeURIComponent(patientId)}`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "monitoring.getRecentVitals",
  {
    title: "Get Recent Vitals",
    description:
      "Fetches recent vitals readings for a patient via /api/vitals/recent/:patientId.",
    inputSchema: z.object({
      patientId: z.string().min(1),
      limit: z.number().int().min(1).max(500).optional(),
    }),
  },
  async ({ patientId, limit }) => {
    const data = await getJson(
      `/api/vitals/recent/${encodeURIComponent(patientId)}`,
    );

    if (
      limit &&
      data &&
      typeof data === "object" &&
      "data" in (data as any) &&
      Array.isArray((data as any).data)
    ) {
      (data as any).data = (data as any).data.slice(-limit);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "monitoring.getLatestRisk",
  {
    title: "Get Latest Risk",
    description: "Fetches latest risk assessment via /api/risk/:patientId.",
    inputSchema: z.object({ patientId: z.string().min(1) }),
  },
  async ({ patientId }) => {
    const data = await getJson(`/api/risk/${encodeURIComponent(patientId)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "monitoring.getBaseline",
  {
    title: "Get Baseline",
    description: "Fetches baseline vitals via /api/baselines/:patientId.",
    inputSchema: z.object({ patientId: z.string().min(1) }),
  },
  async ({ patientId }) => {
    const data = await getJson(
      `/api/baselines/${encodeURIComponent(patientId)}`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "alerts.listActive",
  {
    title: "List Active Alerts",
    description:
      "Lists alerts visible to the current backend user via /api/alerts.",
    inputSchema: z.object({}),
  },
  async () => {
    const data = await getJson("/api/alerts");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

server.registerTool(
  "alerts.listForPatient",
  {
    title: "List Alerts for Patient",
    description:
      "Lists alerts for a specific patient via /api/alerts/patient/:patientId.",
    inputSchema: z.object({ patientId: z.string().min(1) }),
  },
  async ({ patientId }) => {
    const data = await getJson(
      `/api/alerts/patient/${encodeURIComponent(patientId)}`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: toStructuredContent(data),
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
