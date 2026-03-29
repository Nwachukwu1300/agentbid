import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth';
import {
  LandingPage,
  LiveAuctionsPage,
  DashboardPage,
  AnalyticsPage,
  BarterBoardPage,
  AuthPage,
  CreateAgentPage,
  AgentProfilePage,
} from '@/pages';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth routes */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Public marketplace routes (no auth required, shows all agents) */}
        <Route path="/auctions" element={<LiveAuctionsPage />} />
        <Route path="/auctions/:id" element={<LiveAuctionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/barter" element={<BarterBoardPage />} />

        {/* Protected routes (require auth, user's own agents) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-agent"
          element={
            <ProtectedRoute>
              <CreateAgentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents/:id"
          element={
            <ProtectedRoute>
              <AgentProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
