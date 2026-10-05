import { useEffect } from 'react';
import SessionGuard from '@/components/SessionGuard';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Kiosk from '@/pages/Kiosk';
import Display from '@/pages/Display';
import Agent from '@/pages/Agent';
import Admin from '@/pages/Admin';
import AdminStats from '@/pages/AdminStats';
import Approvals from '@/pages/Approvals';
import ApprovalsLogin from '@/pages/ApprovalsLogin';
import ImpersonateBridge from '@/pages/ImpersonateBridge';
import LandingPage from '@/pages/LandingPage';
import { isPublicAccessRoute } from '@/lib/accessRules';

const applyThemeClass = (theme) => {
  const root = document.documentElement;
  const normalized = theme === 'dark' ? 'dark' : 'light';
  root.classList.toggle('dark', normalized === 'dark');
  root.dataset.theme = normalized;
};

const ThemeInitializer = () => {
  const { user } = useAuth();

  useEffect(() => {
    const pathname = window.location.pathname;

    if (pathname.startsWith('/approvals')) {
      applyThemeClass('light');
      return;
    }

    if (pathname.startsWith('/mirror') || pathname === '/ecran') {
      applyThemeClass('dark');
      return;
    }

    if (!user) {
      const fallback = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyThemeClass(fallback);
      return;
    }

    applyThemeClass(user.displayMode || 'light');
  }, [user]);

  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      const pathname = window.location.pathname;

      if (!isPublicAccessRoute(pathname)) {
        navigateToLogin();
        return null;
      }
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/approvals/login" element={<ApprovalsLogin />} />
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/mirror/:token" element={<Display />} />
      <Route path="/impersonate-bridge" element={<ImpersonateBridge />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/ecran" element={<Display />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/statistiques" element={<AdminStats />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
          <ThemeInitializer />
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SessionGuard />
        </div>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App