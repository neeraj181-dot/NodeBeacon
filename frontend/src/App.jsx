import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ServerProvider } from './contexts/ServerContext';
import { AlertProvider } from './contexts/AlertContext';

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


function MainApp() {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [authPage, setAuthPage] = useState('login');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedServerId, setSelectedServerId] = useState(null);

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
