import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { SignupPage } from './routes/SignupPage'
import { OnboardingPage } from './routes/OnboardingPage'
import { RequireFamily } from './routes/RequireFamily'
import { KioskPage } from './routes/KioskPage'
import { SettingsLayout } from './routes/settings/SettingsLayout'
import { MembersPage } from './routes/settings/MembersPage'
import { ChoresPage } from './routes/settings/ChoresPage'
import { FamilyPage } from './routes/settings/FamilyPage'

// Recharts adds significant weight the kiosk board never needs — load the
// dashboard route as its own chunk instead of bundling it into the app's
// initial load.
const DashboardPage = lazy(() =>
  import('./routes/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route
          path="/"
          element={
            <RequireFamily>
              <KioskPage />
            </RequireFamily>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireFamily>
              <SettingsLayout />
            </RequireFamily>
          }
        >
          <Route index element={<Navigate to="members" replace />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="chores" element={<ChoresPage />} />
          <Route path="family" element={<FamilyPage />} />
        </Route>
        <Route
          path="/dashboard"
          element={
            <RequireFamily>
              <Suspense
                fallback={
                  <div className="min-h-svh flex items-center justify-center text-slate-500">
                    Loading…
                  </div>
                }
              >
                <DashboardPage />
              </Suspense>
            </RequireFamily>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
