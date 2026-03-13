import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { LandingPage } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import TestQR from "@/pages/TestQR";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/store/auth.store";

// Patient Pages
import { PatientDashboard } from "@/pages/patient/Dashboard";
import { PatientPrescriptions } from "@/pages/patient/Prescriptions";
import { PatientConsents } from "@/pages/patient/Consents";
import { PatientScan } from "@/pages/patient/Scan";
import { PatientProfile } from "@/pages/patient/Profile";
import { PatientMonitoringDashboard } from "@/pages/monitoring/patient/Dashboard";
import { PatientMonitoringVitals } from "@/pages/monitoring/patient/Vitals";
import { PatientMonitoringAlerts } from "@/pages/monitoring/patient/Alerts";

// Doctor Pages
import { DoctorDashboard } from "@/pages/doctor/Dashboard";
import { DoctorPatients } from "@/pages/doctor/Patients";
import { DoctorPrescribe } from "@/pages/doctor/Prescribe";
import { DoctorPrescriptions } from "@/pages/doctor/Prescriptions";
import { DoctorMonitoringDashboard } from "@/pages/monitoring/doctor/Dashboard";
import { DoctorMonitoringPatients } from "@/pages/monitoring/doctor/Patients";
import { DoctorMonitoringAlerts } from "@/pages/monitoring/doctor/Alerts";

// Pharmacy Pages
import { PharmacyDashboard } from "@/pages/pharmacy/Dashboard";
import { PharmacyDispense } from "@/pages/pharmacy/Dispense";
import { PharmacyInventory } from "@/pages/pharmacy/Inventory";
import { PharmacyHistory } from "@/pages/pharmacy/History";

// Caregiver Monitoring Pages
import { CaregiverMonitoringDashboard } from "@/pages/monitoring/caregiver/Dashboard";
import { CaregiverMonitoringPatients } from "@/pages/monitoring/caregiver/Patients";
import { CaregiverMonitoringAlerts } from "@/pages/monitoring/caregiver/Alerts";

// Protected Route wrapper
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <>{children}</>;
}

function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <PageTransition>
              <LandingPage />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <Login />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <Register />
            </PageTransition>
          }
        />

        {/* Patient Routes */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <PageTransition>
                <PatientDashboard />
              </PageTransition>
            }
          />
          <Route
            path="prescriptions"
            element={
              <PageTransition>
                <PatientPrescriptions />
              </PageTransition>
            }
          />
          <Route
            path="consents"
            element={
              <PageTransition>
                <PatientConsents />
              </PageTransition>
            }
          />
          <Route
            path="scan"
            element={
              <PageTransition>
                <PatientScan />
              </PageTransition>
            }
          />
          <Route
            path="profile"
            element={
              <PageTransition>
                <PatientProfile />
              </PageTransition>
            }
          />
          <Route
            path="monitoring"
            element={
              <PageTransition>
                <PatientMonitoringDashboard />
              </PageTransition>
            }
          />
          <Route
            path="monitoring/vitals"
            element={
              <PageTransition>
                <PatientMonitoringVitals />
              </PageTransition>
            }
          />
          <Route
            path="monitoring/alerts"
            element={
              <PageTransition>
                <PatientMonitoringAlerts />
              </PageTransition>
            }
          />
        </Route>

        {/* Doctor Routes */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <PageTransition>
                <DoctorDashboard />
              </PageTransition>
            }
          />
          <Route
            path="patients"
            element={
              <PageTransition>
                <DoctorPatients />
              </PageTransition>
            }
          />
          <Route
            path="prescribe"
            element={
              <PageTransition>
                <DoctorPrescribe />
              </PageTransition>
            }
          />
          <Route
            path="prescriptions"
            element={
              <PageTransition>
                <DoctorPrescriptions />
              </PageTransition>
            }
          />
          <Route
            path="monitoring"
            element={
              <PageTransition>
                <DoctorMonitoringDashboard />
              </PageTransition>
            }
          />
          <Route
            path="monitoring/patients"
            element={
              <PageTransition>
                <DoctorMonitoringPatients />
              </PageTransition>
            }
          />
          <Route
            path="monitoring/alerts"
            element={
              <PageTransition>
                <DoctorMonitoringAlerts />
              </PageTransition>
            }
          />
        </Route>

        {/* Pharmacy Routes */}
        <Route
          path="/pharmacy"
          element={
            <ProtectedRoute allowedRoles={["pharmacy"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <PageTransition>
                <PharmacyDashboard />
              </PageTransition>
            }
          />
          <Route
            path="dispense"
            element={
              <PageTransition>
                <PharmacyDispense />
              </PageTransition>
            }
          />
          <Route
            path="inventory"
            element={
              <PageTransition>
                <PharmacyInventory />
              </PageTransition>
            }
          />
          <Route
            path="history"
            element={
              <PageTransition>
                <PharmacyHistory />
              </PageTransition>
            }
          />
        </Route>

        {/* Caregiver Routes */}
        <Route
          path="/caregiver"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <PageTransition>
                <CaregiverMonitoringDashboard />
              </PageTransition>
            }
          />
          <Route
            path="patients"
            element={
              <PageTransition>
                <CaregiverMonitoringPatients />
              </PageTransition>
            }
          />
          <Route
            path="alerts"
            element={
              <PageTransition>
                <CaregiverMonitoringAlerts />
              </PageTransition>
            }
          />
        </Route>

        <Route
          path="/test-qr"
          element={
            <PageTransition>
              <TestQR />
            </PageTransition>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default App;
