import React, { useState, useEffect } from 'react';
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
import Logo from './components/Logo';

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


function MainApp() {
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [authPage, setAuthPage] = useState('login');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedServerId, setSelectedServerId] = useState(null);
  
  // Desktop / Browser notifications hooks moved to top
  const { alerts } = useAlerts();
  const [notifiedAlerts, setNotifiedAlerts] = useState(new Set());

  // Request browser Notification API permission when logged in
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [isAuthenticated]);

  // Dispatch browser popups when alerts status changes to Active
  useEffect(() => {
    if (isAuthenticated && alerts.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      alerts.forEach(alert => {
        if (alert.status === 'Active' && !notifiedAlerts.has(alert.id)) {
          // Verify desktop alerts are enabled on user preferences
          if (user?.enable_desktop_notifications !== false) {
            const title = `NodeBeacon: ${alert.title}`;
            const serverName = alert.server_details?.name || 'Unknown Host';
            const options = {
              body: `Server: ${serverName}\n${alert.description}`,
              tag: `alert-${alert.id}`,
            };
            const notification = new Notification(title, options);
            notification.onclick = () => {
              window.focus();
              setCurrentTab('alerts');
            };
          }
          setNotifiedAlerts(prev => new Set([...prev, alert.id]));
        }
      });
    }
  }, [alerts, isAuthenticated, user, notifiedAlerts]);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  // Loading splash screen state
  if (isLoading) {
    return <Splash onFinish={() => setIsLoading(false)} />;
  }

  // Authentication routing
  if (!isAuthenticated) {
    if (authPage === 'register') {
      return (
        <Register 
          onRegister={() => {}} 
          onNavigate={setAuthPage} 
        />
      );
    }
    if (authPage === 'forgot-password') {
      return (
        <ForgotPassword 
          onNavigate={setAuthPage} 
        />
      );
    }
    return (
      <Login 
        onLogin={() => {}} 
        onNavigate={setAuthPage} 
      />
    );
  }

  const handleViewServerDetails = (id) => {
    setSelectedServerId(id);
    setCurrentTab('server-details');
  };

  // Authenticated dashboard layout
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top navigation */}
        <Navbar onAddServerClick={() => {
          setCurrentTab('servers');
          // Wait briefly for tab transition to complete before triggering modal event
          setTimeout(() => {
            window.dispatchEvent(new Event('open_add_server_modal'));
          }, 50);
        }} />

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
          <SettingsTab />
        )}

        {currentTab === 'members' && (
          <MembersTab />
        )}

      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ServerProvider>
        <AlertProvider>
          <MainApp />
        </AlertProvider>
      </ServerProvider>
    </AuthProvider>
  );
}
