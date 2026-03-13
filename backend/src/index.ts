import express from "express";
import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import { initializeDatabase } from "./config/database.js";
import { Server as SocketServer } from "socket.io";
import { setupSocket } from "./realtime/socket.js";
import { registerSocketServer } from "./realtime/events.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import pharmacyRoutes from "./routes/pharmacy.routes.js";
import consentRoutes from "./routes/consent.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import vitalsRoutes from "./routes/vitals.routes.js";
import riskRoutes from "./routes/risk.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import baselinesRoutes from "./routes/baselines.routes.js";
import monitoringPatientsRoutes from "./routes/patients.routes.js";
import monitoringSummaryRoutes from "./routes/monitoring-summary.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// Middleware
// CORS: allow frontend origin from env (Vercel URL in production)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://medconnect-livid.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || "*");
      } else {
        callback(null, origin); // Allow anyway for demo, but reflect origin
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

// Basic pre-flight
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
// Routes (/api prefix)
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/consent", consentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/baselines", baselinesRoutes);
app.use("/api/patients", monitoringPatientsRoutes);
app.use("/api/monitoring", monitoringSummaryRoutes);

// Routes (root prefix - fallback for frontend calling /auth/login directly)
app.use("/auth", authRoutes);
app.use("/patient", patientRoutes);
app.use("/doctor", doctorRoutes);
app.use("/pharmacy", pharmacyRoutes);
app.use("/consent", consentRoutes);
app.use("/ai", aiRoutes);
app.use("/vitals", vitalsRoutes);
app.use("/risk", riskRoutes);
app.use("/alerts", alertsRoutes);
app.use("/baselines", baselinesRoutes);
app.use("/patients", monitoringPatientsRoutes);
app.use("/monitoring", monitoringSummaryRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "MedConnect Backend",
  });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  },
);

// Start server
async function startServer() {
  try {
    // Initialize database tables
    await initializeDatabase();

    const io = new SocketServer(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"],
      },
    });
    registerSocketServer(io);
    setupSocket(io);

    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🏥 MedConnect Backend Server Started                     ║
║   ----------------------------------------                 ║
║   🌐 Server: http://localhost:${PORT}                        ║
║   📊 Health: http://localhost:${PORT}/api/health             ║
║                                                            ║
║   API Endpoints:                                           ║
║   • POST /api/auth/request-otp     - Request OTP           ║
║   • POST /api/auth/verify-otp      - Verify OTP & Login    ║
║   • GET  /api/patient/:id/profile  - Patient Profile       ║
║   • POST /api/patient/:id/consents - Grant Consent         ║
║   • POST /api/doctor/:id/prescribe - Issue Prescription    ║
║   • POST /api/pharmacy/verify-*    - Verify QR Codes       ║
║   • POST /api/pharmacy/:id/dispense- Dispense Medicine     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
            `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
