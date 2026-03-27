import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LandingPage,
  LiveAuctionsPage,
  DashboardPage,
  AnalyticsPage,
  BarterBoardPage,
} from '@/pages';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Main app routes */}
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/auctions" element={<LiveAuctionsPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/barter" element={<BarterBoardPage />} />

      {/* Placeholder routes */}
      <Route path="/create-agent" element={<DashboardPage />} />
      <Route path="/agents/:id" element={<DashboardPage />} />
      <Route path="/auctions/:id" element={<LiveAuctionsPage />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
