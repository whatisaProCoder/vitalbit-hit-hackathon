import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import AnalysisHistoryPage from "./pages/AnalysisHistoryPage";
import ProfilePage from "./pages/ProfilePage";
import api, { getAuthToken } from "./lib/api";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!getAuthToken()) return;

      try {
        const { data } = await api.get("/api/auth/me");
        setUser(data);
      } catch {
        setUser(null);
      }
    };

    loadCurrentUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route
          path="/auth"
          element={<AuthPage user={user} onAuthChange={setUser} />}
        />
        <Route path="/dashboard" element={<DashboardPage user={user} />} />
        <Route
          path="/profile"
          element={<ProfilePage user={user} onUserChange={setUser} />}
        />
        <Route
          path="/analysis-history"
          element={<AnalysisHistoryPage user={user} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
