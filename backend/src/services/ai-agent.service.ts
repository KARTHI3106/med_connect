import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import type { RiskAssessment } from "./risk.service.js";
import type { VitalReading } from "./ingestion.service.js";
import type { Baseline } from "./baseline.service.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Hardcoded drug interactions as fallback when API is unavailable
const DRUG_INTERACTIONS: Record<string, string[]> = {
  warfarin: ["aspirin", "ibuprofen", "naproxen", "vitamin k"],
  metformin: ["alcohol", "contrast dye", "iodinated contrast"],
  lisinopril: ["potassium", "spironolactone", "amiloride"],
  simvastatin: ["erythromycin", "clarithromycin", "grapefruit", "itraconazole"],
  aspirin: ["warfarin", "ibuprofen", "clopidogrel", "heparin"],
  ciprofloxacin: ["antacids", "calcium", "iron", "theophylline"],
  amoxicillin: ["methotrexate", "probenecid"],
  omeprazole: ["clopidogrel", "methotrexate", "tacrolimus"],
  amlodipine: ["simvastatin", "cyclosporine"],
  metoprolol: ["verapamil", "diltiazem", "clonidine"],
};

interface DrugSafetyInput {
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    genericName?: string;
  }>;
  patientAllergies?: string[];
  chronicConditions?: string[];
  patientAge?: number;
  existingMedications?: string[];
}

interface DrugSafetyResult {
  safe: boolean;
  warnings: string[];
  suggestions: string[];
  interactions: string[];
  attestationHash: string;
  aiPowered: boolean;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface RiskExplanation {
  summary: string;
  detailed_explanation: string;
  patient_advice: string;
  doctor_notes: string;
  attestation_hash: string;
  ai_powered: boolean;
}

interface AlertPrescriptionInput {
  alertLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  alertMessage: string;
  riskAssessment: RiskAssessment | null;
  currentVitals: VitalReading | null;
  baseline: Baseline | null;
  patientAllergies?: string[];
  chronicConditions?: string[];
}

interface AlertPrescriptionRecommendation {
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
  }>;
  notes: string;
  aiPowered: boolean;
}

class AIAgentService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      console.log("✅ Gemini AI initialized for drug safety analysis");
    } else {
      console.log(
        "⚠️ No Gemini API key set — using fallback drug interaction check",
      );
    }
  }

  /**
   * Analyze drug safety using Gemini AI or fallback
   */
  async analyzeDrugSafety(input: DrugSafetyInput): Promise<DrugSafetyResult> {
    const startTime = Date.now();

    // Try AI-powered analysis first
    if (this.genAI) {
      try {
        return await this.analyzeWithGemini(input);
      } catch (error) {
        console.error("Gemini AI analysis failed, falling back:", error);
      }
    }

    // Fallback to hardcoded analysis
    return this.analyzeWithFallback(input);
  }

  async explainRisk(
    assessment: RiskAssessment,
    current: VitalReading,
    baseline: Baseline | null,
  ): Promise<RiskExplanation> {
    if (this.genAI) {
      try {
        return await this.explainWithGemini(assessment, current, baseline);
      } catch (error) {
        console.error("Gemini risk explanation failed, using fallback:", error);
      }
    }
    return this.explainWithFallback(assessment);
  }

  private async explainWithGemini(
    assessment: RiskAssessment,
    current: VitalReading,
    baseline: Baseline | null,
  ): Promise<RiskExplanation> {
    const model = this.genAI!.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are HealthGuard AI, analyzing patient vitals for a smart healthcare monitoring system.

## Current Vitals:
- Heart Rate: ${current.heart_rate} bpm
- SpO2: ${current.spo2}%
- Blood Pressure: ${current.systolic_bp}/${current.diastolic_bp} mmHg
- Temperature: ${current.temperature}C
- Activity: ${current.activity_level}

${
  baseline
    ? `## Patient Baseline (personalized):
- Heart Rate: ${baseline.heart_rate} bpm
- SpO2: ${baseline.spo2}%
- Blood Pressure: ${baseline.systolic_bp}/${baseline.diastolic_bp} mmHg
- Temperature: ${baseline.temperature}C
- Based on ${baseline.samples_count} samples`
    : "## No personalized baseline available yet."
}

## Risk Assessment:
- Risk Level: ${assessment.risk_level}
- Risk Score: ${assessment.risk_score}/100
- Contributing Factors: ${assessment.contributing_factors.join("; ")}

## Instructions:
Respond in JSON format ONLY (no markdown, no code blocks):
{
  "summary": "One-line summary for patient dashboard",
  "detailed_explanation": "2-3 sentences explaining what the numbers mean clinically",
  "patient_advice": "Clear, actionable advice for the patient",
  "doctor_notes": "Clinical notes for the doctor with relevant observations"
}

Be medically accurate but use plain language for patient-facing text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        summary: assessment.reason,
        detailed_explanation: text,
        patient_advice: assessment.recommended_action,
        doctor_notes: assessment.contributing_factors.join(". "),
      };
    }

    const attestationData = JSON.stringify({
      assessment_id: assessment.id,
      output: parsed,
      timestamp: Date.now(),
      model: "gemini-2.0-flash",
    });
    const attestation_hash =
      "0x" + crypto.createHash("sha256").update(attestationData).digest("hex");

    return {
      summary: parsed.summary || assessment.reason,
      detailed_explanation: parsed.detailed_explanation || "",
      patient_advice: parsed.patient_advice || assessment.recommended_action,
      doctor_notes: parsed.doctor_notes || "",
      attestation_hash,
      ai_powered: true,
    };
  }

  private explainWithFallback(assessment: RiskAssessment): RiskExplanation {
    const attestationData = JSON.stringify({
      assessment_id: assessment.id,
      timestamp: Date.now(),
      model: "fallback",
    });
    const attestation_hash =
      "0x" + crypto.createHash("sha256").update(attestationData).digest("hex");

    return {
      summary: assessment.reason,
      detailed_explanation: `Your current risk level is ${assessment.risk_level} with a score of ${assessment.risk_score}/100. ${assessment.trend_summary}`,
      patient_advice: assessment.recommended_action,
      doctor_notes: assessment.contributing_factors.join(". "),
      attestation_hash,
      ai_powered: false,
    };
  }

  /**
   * AI-powered drug safety analysis using Gemini
   */
  private async analyzeWithGemini(
    input: DrugSafetyInput,
  ): Promise<DrugSafetyResult> {
    const model = this.genAI!.getGenerativeModel({ model: "gemini-2.0-flash" });

    const medicineList = input.medicines
      .map(
        (m) =>
          `${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.frequency ? ` - ${m.frequency}` : ""}`,
      )
      .join("\n");

    const prompt = `You are a drug safety analysis AI for a healthcare platform called MedConnect.

Analyze the following prescription for potential drug interactions, contraindications, and safety concerns.

## Prescribed Medicines:
${medicineList}

## Patient Information:
- Allergies: ${(input.patientAllergies || []).join(", ") || "None reported"}
- Chronic Conditions: ${(input.chronicConditions || []).join(", ") || "None reported"}
- Age: ${input.patientAge || "Unknown"}
- Existing Medications: ${(input.existingMedications || []).join(", ") || "None reported"}

## Instructions:
Respond in the following JSON format ONLY (no markdown, no code blocks):
{
    "safe": true/false,
    "warnings": ["list of warning messages"],
    "interactions": ["list of drug interaction descriptions"],
    "suggestions": ["list of suggestions for the prescribing doctor"]
}

Be conservative — flag any potential issues. Include severity indicators like ⚠️ for moderate and 🚨 for severe.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response from AI
    let parsed;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      // If parsing fails, treat the response as warnings
      parsed = {
        safe: false,
        warnings: [responseText],
        interactions: [],
        suggestions: [],
      };
    }

    // Generate attestation hash
    const attestationData = JSON.stringify({
      input,
      output: parsed,
      timestamp: Date.now(),
      model: "gemini-2.0-flash",
    });
    const attestationHash =
      "0x" + crypto.createHash("sha256").update(attestationData).digest("hex");

    return {
      safe: parsed.safe ?? true,
      warnings: parsed.warnings || [],
      interactions: parsed.interactions || [],
      suggestions: parsed.suggestions || [],
      attestationHash,
      aiPowered: true,
    };
  }

  /**
   * Fallback drug interaction check using hardcoded data
   */
  private analyzeWithFallback(input: DrugSafetyInput): DrugSafetyResult {
    const warnings: string[] = [];
    const interactions: string[] = [];
    const suggestions: string[] = [];

    const medicineNames = input.medicines.map((m) =>
      (m.name || m.genericName || "").toLowerCase(),
    );

    // Check drug-drug interactions
    for (const med of medicineNames) {
      const knownInteractions = DRUG_INTERACTIONS[med];
      if (knownInteractions) {
        for (const otherMed of medicineNames) {
          if (med !== otherMed && knownInteractions.includes(otherMed)) {
            interactions.push(
              `⚠️ ${med} + ${otherMed}: Known drug interaction`,
            );
            warnings.push(
              `Drug interaction detected between ${med} and ${otherMed}`,
            );
          }
        }
      }
    }

    // Check allergies
    const allergies = (input.patientAllergies || []).map((a) =>
      a.toLowerCase(),
    );
    for (const med of input.medicines) {
      const medName = (med.name || "").toLowerCase();
      const genericName = (med.genericName || "").toLowerCase();
      for (const allergy of allergies) {
        if (
          medName.includes(allergy) ||
          genericName.includes(allergy) ||
          allergy.includes(medName)
        ) {
          warnings.push(
            `🚨 ALLERGY ALERT: Patient allergic to "${allergy}", prescribed "${med.name}"`,
          );
        }
      }
    }

    // Generate attestation hash
    const attestationData = JSON.stringify({
      input,
      warnings,
      interactions,
      timestamp: Date.now(),
      model: "fallback",
    });
    const attestationHash =
      "0x" + crypto.createHash("sha256").update(attestationData).digest("hex");

    return {
      safe: warnings.length === 0,
      warnings,
      interactions,
      suggestions:
        warnings.length > 0
          ? ["Review interactions before confirming prescription"]
          : [],
      attestationHash,
      aiPowered: false,
    };
  }

  async generateAlertPrescription(
    input: AlertPrescriptionInput,
  ): Promise<AlertPrescriptionRecommendation> {
    if (this.genAI) {
      try {
        return await this.generateAlertPrescriptionWithGemini(input);
      } catch (error) {
        console.error(
          "Gemini alert prescription generation failed, using fallback:",
          error,
        );
      }
    }

    return this.generateAlertPrescriptionFallback(input);
  }

  private async generateAlertPrescriptionWithGemini(
    input: AlertPrescriptionInput,
  ): Promise<AlertPrescriptionRecommendation> {
    const model = this.genAI!.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a clinical decision support assistant for doctors.
Create a draft prescription from this resolved monitoring alert.

Alert level: ${input.alertLevel}
Alert message: ${input.alertMessage}

Latest risk score: ${input.riskAssessment?.risk_score ?? "unknown"}
Risk reason: ${input.riskAssessment?.reason ?? "unknown"}
Recommended action from risk model: ${input.riskAssessment?.recommended_action ?? "unknown"}

Latest vitals (if available):
- Heart rate: ${input.currentVitals?.heart_rate ?? "n/a"}
- SpO2: ${input.currentVitals?.spo2 ?? "n/a"}
- Blood pressure: ${input.currentVitals ? `${input.currentVitals.systolic_bp}/${input.currentVitals.diastolic_bp}` : "n/a"}
- Temperature: ${input.currentVitals?.temperature ?? "n/a"}

Baseline (if available):
- Heart rate: ${input.baseline?.heart_rate ?? "n/a"}
- SpO2: ${input.baseline?.spo2 ?? "n/a"}
- Blood pressure: ${input.baseline ? `${input.baseline.systolic_bp}/${input.baseline.diastolic_bp}` : "n/a"}
- Temperature: ${input.baseline?.temperature ?? "n/a"}

Patient allergies: ${(input.patientAllergies || []).join(", ") || "none reported"}
Chronic conditions: ${(input.chronicConditions || []).join(", ") || "none reported"}

Return valid JSON ONLY in this exact shape:
{
  "diagnosis": "short diagnosis",
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "dosage",
      "frequency": "frequency",
      "duration": "duration",
      "quantity": 10,
      "instructions": "optional caution"
    }
  ],
  "notes": "brief doctor note"
}

Rules:
- Return 1 to 3 medicines only.
- Keep advice conservative and clinically safe.
- Mention this is a draft that requires doctor confirmation in notes.
- Avoid medicines that directly match listed allergies.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return this.generateAlertPrescriptionFallback(input);
    }

    const medicines = Array.isArray(parsed.medicines)
      ? parsed.medicines.slice(0, 3).map((m: any) => ({
          name: String(m.name || "Clinical observation follow-up"),
          dosage: String(m.dosage || "as directed"),
          frequency: String(m.frequency || "as directed"),
          duration: String(m.duration || "3 days"),
          quantity: Number.isFinite(Number(m.quantity))
            ? Number(m.quantity)
            : 1,
          instructions:
            typeof m.instructions === "string" ? m.instructions : undefined,
        }))
      : [];

    if (medicines.length === 0) {
      return this.generateAlertPrescriptionFallback(input);
    }

    return {
      diagnosis: String(parsed.diagnosis || input.alertMessage),
      medicines,
      notes: String(
        parsed.notes ||
          "AI-generated draft from monitoring alert. Requires doctor validation before dispensing.",
      ),
      aiPowered: true,
    };
  }

  private generateAlertPrescriptionFallback(
    input: AlertPrescriptionInput,
  ): AlertPrescriptionRecommendation {
    const normalized = input.alertMessage.toLowerCase();
    const diagnosis =
      input.riskAssessment?.reason ||
      (input.alertLevel === "CRITICAL"
        ? "Acute physiological instability"
        : input.alertLevel === "HIGH"
          ? "Elevated cardiopulmonary risk"
          : "Vitals deviation requiring follow-up");

    const medicines =
      input.alertLevel === "CRITICAL"
        ? [
            {
              name: normalized.includes("temperature")
                ? "Paracetamol"
                : "Aspirin",
              dosage: normalized.includes("temperature") ? "650 mg" : "75 mg",
              frequency: "1-0-1",
              duration: "3 days",
              quantity: 6,
              instructions:
                "Emergency draft generated from critical alert. Confirm immediately.",
            },
            {
              name: normalized.includes("spo2")
                ? "Oxygen Support"
                : "Amlodipine",
              dosage: normalized.includes("spo2") ? "2 L/min" : "5 mg",
              frequency: normalized.includes("spo2") ? "continuous" : "1-0-0",
              duration: "2 days",
              quantity: normalized.includes("spo2") ? 1 : 2,
            },
          ]
        : input.alertLevel === "HIGH"
          ? [
              {
                name: "Amlodipine",
                dosage: "5 mg",
                frequency: "1-0-0",
                duration: "5 days",
                quantity: 5,
              },
              {
                name: "Paracetamol",
                dosage: "500 mg",
                frequency: "1-1-1",
                duration: "3 days",
                quantity: 9,
              },
            ]
          : [
              {
                name: "Paracetamol",
                dosage: "500 mg",
                frequency: "0-1-1",
                duration: "2 days",
                quantity: 4,
                instructions:
                  "Draft follow-up treatment generated from monitoring signal.",
              },
            ];

    return {
      diagnosis,
      medicines,
      notes:
        "AI fallback draft generated from resolved alert. Doctor confirmation required before dispensing.",
      aiPowered: false,
    };
  }

  /**
   * Patient chatbot - answer health questions
   */
  async chat(
    messages: ChatMessage[],
    currentQuestion: string,
  ): Promise<string> {
    if (!this.genAI) {
      return "AI chatbot is currently unavailable. Please consult your doctor for medical advice.";
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const systemPrompt = `You are MedConnect AI Assistant, a helpful healthcare chatbot. You provide general health information and guidance.

IMPORTANT RULES:
1. You are NOT a doctor. Always recommend consulting a healthcare professional for specific medical advice.
2. Never diagnose conditions or prescribe medications.
3. Provide general, evidence-based health information.
4. Be empathetic and supportive.
5. If asked about emergency symptoms, advise calling emergency services immediately.
6. Keep responses concise and easy to understand.
7. Mention MedConnect features when relevant (e.g., "You can check your prescriptions in the MedConnect app").`;

      const chatHistory = messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({
        history: [
          {
            role: "user",
            parts: [
              { text: "You are a healthcare assistant. Acknowledge this." },
            ],
          },
          { role: "model", parts: [{ text: systemPrompt }] },
          ...chatHistory,
        ],
      });

      const result = await chat.sendMessage(currentQuestion);
      return result.response.text();
    } catch (error) {
      console.error("AI chat error:", error);
      return "I apologize, but I'm having trouble processing your question right now. Please try again or consult your healthcare provider.";
    }
  }
}

export const aiAgentService = new AIAgentService();
export default aiAgentService;
