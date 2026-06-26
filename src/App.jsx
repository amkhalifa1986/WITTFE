import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/authContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { PopupProvider } from './context/PopupContext';
import { AdProvider } from './context/AdContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import { Clock } from 'lucide-react';

const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Dashboard = React.lazy(() => import('./pages/DashboardNew'));
const Search = React.lazy(() => import('./pages/Search'));
const TripDetails = React.lazy(() => import('./pages/TripDetails'));
const TrainDetails = React.lazy(() => import('./pages/TrainDetails'));
const LostFound = React.lazy(() => import('./pages/LostFound'));
const Suggestions = React.lazy(() => import('./pages/Suggestions'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Admin = React.lazy(() => import('./pages/Admin'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
    <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
  </div>
);

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 1 || user.role === 'Admin' || user.role?.toString().toLowerCase() === 'admin';
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PopupProvider>
          <AuthProvider>
            <AdProvider>
              <SettingsProvider>
                <BrowserRouter>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Public Authentication Routes */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />

                      {/* Protected Application Routes */}
                      <Route 
                        path="/" 
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/search" 
                        element={
                          <ProtectedRoute>
                            <Search />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/trip/:id" 
                        element={
                          <ProtectedRoute>
                            <TripDetails />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/train/:id" 
                        element={
                          <ProtectedRoute>
                            <TrainDetails />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/lost-found" 
                        element={
                          <ProtectedRoute>
                            <LostFound />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/suggestions" 
                        element={
                          <ProtectedRoute>
                            <Suggestions />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/profile" 
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/admin" 
                        element={
                          <ProtectedRoute adminOnly>
                            <Admin />
                          </ProtectedRoute>
                        } 
                      />


                      {/* Fallback to Dashboard */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
            </SettingsProvider>
          </AdProvider>
        </AuthProvider>
        </PopupProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
