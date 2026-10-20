import React, { useState, useEffect, useRef } from 'react';
// React Router - Core Routing Components & Hooks
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ServerProvider } from './contexts/ServerContext';
import { AlertProvider, useAlerts } from './contexts/AlertContext';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Splash from './components/Splash';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import OAuthCallback from './components/OAuthCallback';

// Tab components
import ServersTab from './components/ServersTab';
import ServerDetailsTab from './components/ServerDetailsTab';
import AlertsTab from './components/AlertsTab';
import MetricsTab from './components/MetricsTab';
import LogsTab from './components/LogsTab';
import ReportsTab from './components/ReportsTab';
import IntegrationsTab from './components/IntegrationsTab';
import SettingsTab from './components/SettingsTab';
import MembersTab from './components/MembersTab';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './contexts/ThemeContext';
import {
  canDeliverDesktopNotifications,
  observeAlertSnapshot,
  loadNotifiedAlertIds,
  persistNotifiedAlertIds,
  showDesktopAlertNotification,
  showRecoveryNotification,
  watchNotificationLifecycle,
} from './components/desktopNotifications';


function MainApp() {
  // React Hook - useState (Manages component state for loading, active tab, server selection, and OAuth errors)
  const [isLoading, setIsLoading] = useState(true);
  // React Hook - useContext (Consumes user profile and authentication status from AuthContext)
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [oauthError, setOauthError] = useState('');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedServerId, setSelectedServerId] = useState(null);

  // React Router - useNavigate Hook (Programmatic navigation between pages)
  const navigate = useNavigate();
  // React Router - useLocation Hook (Inspects current URL path and query parameters)
  const location = useLocation();

  // React Hook - useRef (Retains mutable references across renders without triggering re-renders)
  const { notificationAlerts, notificationAlertsReady, setFilters } = useAlerts();
  const notifiedAlerts = useRef({ userId: null, ids: new Set() });
  const alertNotificationState = useRef({ userId: null, snapshot: null, pendingActive: new Map(), pendingRecoveries: new Map(), inFlight: new Set() });

  // React Router - Page Navigation Helper for auth views
  const handleNavigate = (page) => {
    setOauthError('');
    if (page === 'register') {
      navigate('/register');
    } else if (page === 'forgot-password') {
      navigate('/forgot-password');
    } else {
      navigate('/login');
    }
  };

  // React Router - Redirect to /auth/callback if OAuth code parameter arrives on root or login path
  useEffect(() => {
    if (location.search.includes('code=') && location.pathname !== '/auth/callback') {
      navigate(`/auth/callback${location.search}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // React Hook - useEffect (Manages desktop alert notifications lifecycle and subscription)
  useEffect(() => {
    void (async () => {
    if (!isAuthenticated || !user?.id || !notificationAlertsReady) return;

    if (notifiedAlerts.current.userId !== user.id) {
      notifiedAlerts.current = {
        userId: user.id,
        ids: loadNotifiedAlertIds(undefined, user.id),
      };
    }

    if (alertNotificationState.current.userId !== user.id) {
      alertNotificationState.current = {
        userId: user.id,
        snapshot: null,
        pendingActive: new Map(),
        pendingRecoveries: new Map(),
        inFlight: new Set(),
      };
    }

    const snapshotResult = observeAlertSnapshot(notificationAlerts, alertNotificationState.current.snapshot);
    alertNotificationState.current.snapshot = snapshotResult;
    if (!snapshotResult.initialized) return;

    console.debug('[DesktopNotification] alert received', { count: notificationAlerts.length });
    for (const alert of notificationAlerts) {
      console.debug('[DesktopNotification] alert id:', alert.id);
    }

    const notificationApi = typeof window.Notification === 'function' ? window.Notification : null;
    const permission = notificationApi?.permission || 'unsupported';
    console.debug('[DesktopNotification] permission:', permission);
    const notificationsAllowed = notificationApi
      && canDeliverDesktopNotifications(user?.enable_desktop_notifications, permission);

    snapshotResult.newActiveAlerts.forEach(alert => {
      console.info('[DesktopNotification] new alert detected', { id: alert.id });
      alertNotificationState.current.pendingActive.set(alert.id, alert);
    });
    snapshotResult.recoveries.forEach(alert => alertNotificationState.current.pendingRecoveries.set(alert.id, alert));

    if (!notificationsAllowed) {
      if (permission === 'denied') console.warn('[DesktopNotification] permission denied');
      return;
    }

    const rememberNotification = (key, delivery, onError) => {
      notifiedAlerts.current.ids = persistNotifiedAlertIds(
        undefined,
        user.id,
        new Set([...notifiedAlerts.current.ids, key]),
      );
      if (delivery.notification) {
        watchNotificationLifecycle(delivery.notification, {
          onShow: () => console.info('[DesktopNotification] notification onshow; OS popup visibility is unverified.', { id: key }),
          onError: event => {
            const remainingIds = new Set(notifiedAlerts.current.ids);
            remainingIds.delete(key);
            notifiedAlerts.current.ids = persistNotifiedAlertIds(undefined, user.id, remainingIds);
            console.error('[DesktopNotification] notification error:', event?.type || 'unknown error', { id: key });
            onError?.();
          },
          onClose: () => console.info('[DesktopNotification] notification close event; OS popup visibility is unverified.', { id: key }),
        });
      }
    };

    for (const [alertId, alert] of alertNotificationState.current.pendingActive) {
      if (alertNotificationState.current.inFlight.has(alertId)) continue;
      if (notifiedAlerts.current.ids.has(alertId)) {
        console.debug('[DesktopNotification] duplicate skipped', { id: alertId });
        alertNotificationState.current.pendingActive.delete(alertId);
        continue;
      }
      try {
        alertNotificationState.current.inFlight.add(alertId);
        console.info('[DesktopNotification] creating notification', { id: alertId });
        const delivery = await showDesktopAlertNotification(alert, notificationApi, selectedAlert => {
          setFilters({ status: 'Active', severity: '', server: String(selectedAlert.server) });
          setCurrentTab('alerts');
        }, () => window.focus(), window.navigator);
        console.info('[DesktopNotification] notification request accepted', { id: alertId, method: delivery.method });
        rememberNotification(alertId, delivery, () => {
          alertNotificationState.current.pendingActive.set(alertId, alert);
        });
        alertNotificationState.current.pendingActive.delete(alertId);
      } catch (error) {
        console.error('[DesktopNotification] notification error:', error);
      } finally {
        alertNotificationState.current.inFlight.delete(alertId);
      }
    }

    for (const [alertId, alert] of alertNotificationState.current.pendingRecoveries) {
      const notificationKey = `recovery:${alertId}`;
      if (alertNotificationState.current.inFlight.has(notificationKey)) continue;
      if (notifiedAlerts.current.ids.has(notificationKey)) {
        console.debug('[DesktopNotification] duplicate skipped', { id: notificationKey });
        alertNotificationState.current.pendingRecoveries.delete(alertId);
        continue;
      }
      try {
        alertNotificationState.current.inFlight.add(notificationKey);
        console.info('[DesktopNotification] creating notification', { id: notificationKey });
        const delivery = await showRecoveryNotification(alert, notificationApi, selectedAlert => {
          setFilters({ status: 'Resolved', severity: '', server: String(selectedAlert.server) });
          setCurrentTab('alerts');
        }, () => window.focus(), window.navigator);
        console.info('[DesktopNotification] notification request accepted', { id: notificationKey, method: delivery.method });
        rememberNotification(notificationKey, delivery, () => {
          alertNotificationState.current.pendingRecoveries.set(alertId, alert);
        });
        alertNotificationState.current.pendingRecoveries.delete(alertId);
      } catch (error) {
        console.error('[DesktopNotification] notification error:', error);
      } finally {
        alertNotificationState.current.inFlight.delete(notificationKey);
      }
    }
    })();
  }, [notificationAlerts, notificationAlertsReady, isAuthenticated, setFilters, user?.enable_desktop_notifications, user?.id]);

  // React Hook - useEffect (Service worker message event listener)
  useEffect(() => {
    const serviceWorker = window.navigator.serviceWorker;
    if (!serviceWorker) return undefined;
    const handleNotificationClick = event => {
      const data = event.data;
      if (data?.type !== 'NODEBEACON_NOTIFICATION_CLICK' || !data.alertId) return;
      setFilters({
        status: data.status || 'Active',
        severity: '',
        server: data.serverId == null ? '' : String(data.serverId),
      });
      setCurrentTab('alerts');
    };
    serviceWorker.addEventListener('message', handleNotificationClick);
    return () => serviceWorker.removeEventListener('message', handleNotificationClick);
  }, [setFilters]);

  // React Hook - useEffect (Stops splash screen once auth state is verified)
  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  // Loading splash screen state
  if (isLoading) {
    return <Splash onFinish={() => setIsLoading(false)} />;
  }

  const handleViewServerDetails = (id) => {
    setSelectedServerId(id);
    setCurrentTab('server-details');
  };

  // React Router - Declarative Routes Configuration
  return (
    <Routes>
      {/* React Router - Route: OAuth Callback handler */}
      <Route
        path="/auth/callback"
        element={
          <>
            <ThemeToggle className="fixed top-5 right-5 z-[60]" />
            <OAuthCallback
              onOAuthSuccess={() => {
                setOauthError('');
                navigate('/', { replace: true });
              }}
              onOAuthError={(err) => {
                setOauthError(err);
                navigate('/login', { replace: true });
              }}
            />
          </>
        }
      />

      {/* React Router - Route: Login Screen */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <>
              <ThemeToggle className="fixed top-5 right-5 z-[60]" />
              <Login
                initialError={oauthError}
                onLogin={() => navigate('/')}
                onNavigate={handleNavigate}
              />
            </>
          )
        }
      />

      {/* React Router - Route: Registration Screen */}
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <>
              <ThemeToggle className="fixed top-5 right-5 z-[60]" />
              <Register
                onRegister={() => navigate('/')}
                onNavigate={handleNavigate}
              />
            </>
          )
        }
      />

      {/* React Router - Route: Password Recovery Screen */}
      <Route
        path="/forgot-password"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <>
              <ThemeToggle className="fixed top-5 right-5 z-[60]" />
              <ForgotPassword
                onNavigate={handleNavigate}
              />
            </>
          )
        }
      />

      {/* React Router - Protected Route: Authenticated Dashboard Shell */}
      <Route
        path="/"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <div className="flex h-screen w-screen overflow-hidden bg-background">
              {/* Sidebar navigation */}
              <Sidebar
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
              />

              {/* Main Layout Area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top navigation */}
                <Navbar
                  onAddServerClick={() => {
                    setCurrentTab('servers');
                    // Wait briefly for tab transition to complete before triggering modal event
                    setTimeout(() => {
                      window.dispatchEvent(new Event('open_add_server_modal'));
                    }, 50);
                  }}
                  onNotificationsClick={() => setCurrentTab('alerts')}
                  isNotificationsActive={currentTab === 'alerts'}
                />

                {/* Tab rendering */}
                {currentTab === 'dashboard' && (
                  <Dashboard
                    onSelectServer={handleViewServerDetails}
                    onNavigateTab={setCurrentTab}
                  />
                )}

                {currentTab === 'servers' && (
                  <ServersTab onViewServer={handleViewServerDetails} />
                )}

                {currentTab === 'server-details' && (
                  <ServerDetailsTab
                    serverId={selectedServerId}
                    onBack={() => setCurrentTab('servers')}
                  />
                )}

                {currentTab === 'metrics' && (
                  <MetricsTab onSelectServer={handleViewServerDetails} />
                )}

                {currentTab === 'alerts' && (
                  <AlertsTab />
                )}

                {currentTab === 'logs' && (
                  <LogsTab />
                )}

                {currentTab === 'reports' && (
                  <ReportsTab />
                )}

                {currentTab === 'integrations' && (
                  <IntegrationsTab />
                )}

                {currentTab === 'settings' && (
                  <SettingsTab onNavigateTab={setCurrentTab} />
                )}

                {currentTab === 'members' && (
                  <MembersTab />
                )}

              </div>
            </div>
          )
        }
      />

      {/* React Router - Fallback Route redirects any unknown route to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    // React Router - BrowserRouter enables HTML5 History API client-side routing
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ServerProvider>
          <AlertProvider>
            <MainApp />
          </AlertProvider>
        </ServerProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
