import React, { useState } from 'react';
import { useAlerts } from '../contexts/AlertContext';
import { useServers } from '../contexts/ServerContext';
import { ShieldAlert, CheckCircle, Clock, X, Search, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AlertsTab() {
  const { alerts, loading, filters, setFilters, triggerResolve } = useAlerts();
  const { servers } = useServers();
  const [searchQuery, setSearchQuery] = useState('');

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Filter alerts by search query on frontend (filtering server name / alert message)
  const filteredAlerts = alerts.filter(alert => {
    const serverName = alert.server_details?.name || '';
    const description = alert.description || '';
    const title = alert.title || '';
    const query = searchQuery.toLowerCase();
    
    return (
      serverName.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      title.toLowerCase().includes(query)
    );
  });

  const handleResolve = async (id) => {
    try {
      await triggerResolve(id);
    } catch (err) {
      alert(err.message || 'Failed to resolve alert.');
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'Critical':
        return 'bg-danger/10 border-danger/20 text-danger';
      case 'Warning':
        return 'bg-warning/10 border-warning/20 text-warning';
      default:
        return 'bg-blue/10 border-blue/20 text-blue';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background text-white select-none">
      
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-mono uppercase">
            Outages & Alerts
          </h1>
          <p className="text-secondaryText text-sm mt-1">
            Track and resolve anomalies and outages triggered across your infrastructure.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-card border border-white/5 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 text-secondaryText absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs font-mono placeholder-secondaryText text-white focus:outline-none focus:border-accent/40"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Server Filter */}
          <select
            value={filters.server}
            onChange={(e) => handleFilterChange('server', e.target.value)}
            className="bg-surface border border-white/5 p-2 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-accent/40"
          >
            <option value="">All Servers</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="bg-surface border border-white/5 p-2 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-accent/40"
          >
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="Warning">Warning</option>
            <option value="Info">Info</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="bg-surface border border-white/5 p-2 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-accent/40"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Alert logs list */}
      {loading && alerts.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={alert.id}
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
                alert.status === 'Resolved' 
                  ? 'bg-white/[0.01] border-white/5 opacity-60' 
                  : alert.severity === 'Critical' 
                    ? 'bg-danger/[0.02] border-danger/10 hover:border-danger/20 shadow-[0_0_20px_rgba(255,95,87,0.02)]' 
                    : 'bg-warning/[0.02] border-warning/10 hover:border-warning/20'
              }`}
            >
              <div className="flex items-start gap-4 flex-1">
                {alert.status === 'Resolved' ? (
                  <div className="p-2 bg-accent/10 border border-accent/20 rounded-xl text-accent shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                    alert.severity === 'Critical' ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-warning/10 border-warning/20 text-warning'
                  }`}>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                )}
                
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono uppercase truncate">
                      {alert.server_details?.name || 'Unknown Node'}
                    </span>
                    <span className="text-[9px] text-secondaryText font-mono uppercase">
                      {alert.server_details?.hostname}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getSeverityStyle(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                      alert.status === 'Resolved' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-danger/10 border-danger/20 text-danger'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                  
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide pt-0.5">{alert.title}</h4>
                  <p className="text-xs text-secondaryText leading-relaxed max-w-2xl">{alert.description}</p>
                  
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-secondaryText font-mono">
                    <Clock className="w-3 h-3" />
                    <span>Triggered: {new Date(alert.created_at).toLocaleString()}</span>
                    {alert.resolved_at && (
                      <span className="text-accent">• Resolved: {new Date(alert.resolved_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {alert.status === 'Active' && (
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="w-full sm:w-auto px-4 py-2 bg-hover hover:bg-accent hover:text-[#070707] border border-white/5 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer text-center"
                >
                  Resolve
                </button>
              )}
            </motion.div>
          ))}

          {filteredAlerts.length === 0 && (
            <div className="bg-card border border-white/5 p-12 rounded-2xl text-center max-w-sm mx-auto space-y-2">
              <ShieldAlert className="w-6 h-6 text-secondaryText mx-auto" />
              <h4 className="text-xs font-bold uppercase font-mono text-white">No alerts found</h4>
              <p className="text-[11px] text-secondaryText">
                Active alerts and system metrics look stable.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
