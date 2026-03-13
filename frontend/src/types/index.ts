// User Types
export type UserRole = "patient" | "doctor" | "pharmacy" | "caregiver";

export interface User {
  id: string;
  name?: string;
  phone?: string;
  email: string;
  role: UserRole;
  govId: string;
  walletAddress?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Patient extends User {
  role: "patient";
  fullName: string;
  dob: string;
  gender: "male" | "female" | "other";
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  qrIdentityHash: string;
}

export interface Doctor extends User {
  role: "doctor";
  fullName: string;
  specialization: string;
  licenseNumber: string;
  hospital: string;
  verifiedStatus: "pending" | "verified" | "rejected";
}

export interface Pharmacy extends User {
  role: "pharmacy";
  pharmacyName: string;
  licenseNumber: string;
  address: string;
  verifiedStatus: "pending" | "verified" | "rejected";
}

export interface Caregiver extends User {
  role: "caregiver";
  fullName?: string;
  relationship?: string;
}

// Prescription Types
export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  strength: string;
  blockchainHash: string;
  requiresPrescription: boolean;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  qrCodeHash: string;
}

export interface PrescriptionMedicine {
  id: string;
  medicine: Medicine;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  doctor?: Doctor;
  patient?: Patient;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  blockchainHash: string;
  status: "active" | "dispensed" | "expired" | "cancelled";
  prescriptionDate: string;
  validUntil: string;
  notes?: string;
}

// Consent Types
export type ConsentType = "read" | "write" | "dispense";

export interface Consent {
  id: string;
  patientId: string;
  grantedToId: string;
  grantedTo?: Doctor | Pharmacy;
  consentTypes: ConsentType[];
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

// Dispensing Types
export interface DispensingRecord {
  id: string;
  prescriptionId: string;
  prescription?: Prescription;
  pharmacyId: string;
  patientId: string;
  dispensedAt: string;
  blockchainTxHash: string;
  patientQrVerified: boolean;
  medicineQrVerified: boolean;
}

// Verification Types
export interface VerificationResult {
  isValid: boolean;
  message: string;
  details?: {
    name?: string;
    manufacturer?: string;
    batchNumber?: string;
    expiryDate?: string;
    blockchainHash?: string;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export interface LoginCredentials {
  govId: string;
  role: UserRole;
}

export interface AuthState {
  user: Patient | Doctor | Pharmacy | Caregiver | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Monitoring Types
export interface VitalReading {
  id?: string;
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  activity_level: string;
  device_id?: string;
  recorded_at?: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessment {
  id: string;
  patient_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  contributing_factors: string[];
  trend_summary: string;
  recommended_action: string;
  assessed_at: string;
}

export interface AlertEvent {
  id: string;
  patient_id: string;
  risk_assessment_id: string;
  alert_level: RiskLevel;
  message: string;
  notified: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  escalated: boolean;
  resolved: boolean;
  resolved_at?: string | null;
  created_at: string;
}

export interface HealthScore {
  score: number;
  components: {
    vitals: number;
    trend: number;
    baseline: number;
    activity: number;
  };
}

export interface Baseline {
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  samples_count: number;
}

export interface MonitoringPatient {
  id: string;
  name: string;
  phone?: string;
  blood_group?: string;
  chronic_conditions?: string;
}
