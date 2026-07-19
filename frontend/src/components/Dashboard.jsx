import React, { useState, useEffect } from 'react';
import { useServers } from '../contexts/ServerContext';
import { useAlerts } from '../contexts/AlertContext';
import { getMetrics } from '../api/metrics';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  Clock,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard({ onSelectServer, onNavigateTab }) {
  const { servers, loading: serversLoading } = useServers();
  const { alerts, loading: alertsLoading } = useAlerts();
  const [metrics, setMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const fetchDashboardMetrics = async (silent = false) => {
    if (!silent) setLoadingMetrics(true);
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
    } finally {
      if (!silent) setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
    const interval = setInterval(() => {
      fetchDashboardMetrics(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalServers = servers.length;
  const onlineServers = servers.filter(s => s.status === 'Online').length;
  const offlineServers = totalServers - onlineServers;

  const activeAlerts = alerts.filter(a => a.status === 'Active');
  const activeAlertsCount = activeAlerts.length;
  const criticalAlertsCount = activeAlerts.filter(a => a.severity === 'Critical').length;

  const latestMetricByServer = {};
  metrics.forEach(m => {
    if (!latestMetricByServer[m.server]) {
      latestMetricByServer[m.server] = m;
    }
  });

  const onlineServersWithMetrics = servers.filter(s => s.status === 'Online' && latestMetricByServer[s.id]);
  const avgCpu = onlineServersWithMetrics.length > 0
    ? Math.round(onlineServersWithMetrics.reduce((acc, s) => acc + latestMetricByServer[s.id].cpu_usage, 0) / onlineServersWithMetrics.length)
    : 0;

  const avgMemory = onlineServersWithMetrics.length > 0
    ? (onlineServersWithMetrics.reduce((acc, s) => acc + latestMetricByServer[s.id].memory_usage, 0) / onlineServersWithMetrics.length).toFixed(1)
    : '0.0';

  const avgDisk = onlineServersWithMetrics.length > 0
    ? Math.round(onlineServersWithMetrics.reduce((acc, s) => acc + latestMetricByServer[s.id].disk_usage, 0) / onlineServersWithMetrics.length)
    : 0;

  const formatTimeSlot = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getCpuChartData = () => {
    if (metrics.length === 0) return [];
    const sorted = [...metrics].reverse().slice(-50);
    const timeSlots = {};
    sorted.forEach(m => {
      const slot = formatTimeSlot(m.timestamp);
      if (!timeSlots[slot]) {
        timeSlots[slot] = { time: slot };
      }
      const serverObj = servers.find(s => s.id === m.server);
      if (serverObj) {
        timeSlots[slot][serverObj.name] = parseFloat(m.cpu_usage.toFixed(1));
      }
    });
    return Object.values(timeSlots);
  };

  const getNetworkChartData = () => {
    if (metrics.length === 0) return [];
    const sorted = [...metrics].reverse().slice(-50);
    const timeSlots = {};
    sorted.forEach(m => {
      const slot = formatTimeSlot(m.timestamp);
      if (!timeSlots[slot]) {
        timeSlots[slot] = { time: slot, Upload: 0, Download: 0, count: 0 };
      }
      timeSlots[slot].Upload += m.network_out;
      timeSlots[slot].Download += m.network_in;
      timeSlots[slot].count += 1;
    });

    return Object.values(timeSlots).map(slot => ({
      time: slot.time,
      Upload: parseFloat((slot.Upload / (1024 * 1024)).toFixed(2)),
      Download: parseFloat((slot.Download / (1024 * 1024)).toFixed(2))
    }));
  };

  const cpuChartData = getCpuChartData();
  const networkChartData = getNetworkChartData();
  const serverNamesForLegend = servers.slice(0, 2).map(s => s.name);

  const formatAlertTime = (dateStr) => {
    const date = new Date(dateStr);
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#050505] text-white">
      {/* Hero Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
          Monitor your infrastructure.
        </h1>
        <p className="text-secondaryText text-xs font-medium mt-1">
          Real-time metrics, node states, and health monitoring logs.
        </p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Servers KPI */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Total Servers</span>
            <div className="p-2.5 bg-white/5 border border-white/5 group-hover:border-accent/30 group-hover:bg-accent/5 rounded-xl transition-all duration-300">
              <Server className="w-4 h-4 text-white group-hover:text-accent transition-colors" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{totalServers}</span>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              <span className="text-[10px] text-accent font-semibold uppercase font-mono">{onlineServers} Online</span>
              <span className="text-secondaryText text-[10px] uppercase font-mono ml-1">/ {offlineServers} Offline</span>
            </div>
          </div>
        </div>

        {/* Avg CPU KPI */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Avg CPU Load</span>
            <div className="p-2.5 bg-white/5 border border-white/5 group-hover:border-accent/30 group-hover:bg-accent/5 rounded-xl transition-all duration-300">
              <Cpu className="w-4 h-4 text-accent group-hover:scale-105 transition-transform" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{avgCpu}%</span>
            <div className="flex items-center gap-1 mt-2 text-accent">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase font-mono">Telemetry Active</span>
            </div>
          </div>
        </div>

        {/* Avg Memory KPI */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Avg RAM Load</span>
            <div className="p-2.5 bg-white/5 border border-white/5 group-hover:border-[#5B8CFF]/30 group-hover:bg-[#5B8CFF]/5 rounded-xl transition-all duration-300">
              <Database className="w-4 h-4 text-[#5B8CFF] group-hover:scale-105 transition-transform" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{avgMemory}%</span>
            <div className="flex items-center gap-1 mt-2 text-secondaryText">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase font-mono">Allocated load</span>
            </div>
          </div>
        </div>

        {/* Avg Disk KPI */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Avg Disk Load</span>
            <div className="p-2.5 bg-white/5 border border-white/5 group-hover:border-white/20 group-hover:bg-white/5 rounded-xl transition-all duration-300">
              <HardDrive className="w-4 h-4 text-white group-hover:scale-105 transition-transform" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{avgDisk}%</span>
            <div className="flex items-center gap-1 mt-2 text-secondaryText">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase font-mono">Cluster Capacity</span>
            </div>
          </div>
        </div>

        {/* Active Alerts KPI */}
        <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group transition-all duration-300 border ${activeAlertsCount > 0 ? 'border-danger/20 shadow-[0_0_15px_rgba(255,95,87,0.03)]' : 'glass-panel-hover'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Active Outages</span>
            <div className={`p-2.5 rounded-xl border transition-all duration-300 ${activeAlertsCount > 0 ? 'bg-danger/5 border-danger/20 group-hover:border-danger/40' : 'bg-white/5 border-white/5'}`}>
              <ShieldAlert className={`w-4 h-4 ${activeAlertsCount > 0 ? 'text-danger animate-pulse' : 'text-accent'}`} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{activeAlertsCount}</span>
            <div className="flex items-center gap-1 mt-2">
              {activeAlertsCount > 0 ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger"></span>
                  </span>
                  <span className="text-[10px] font-bold text-danger uppercase font-mono">{criticalAlertsCount} Critical</span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-accent uppercase font-mono">All nodes operational</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Chart */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">CPU History (24h)</h3>
              <p className="text-[10px] text-secondaryText font-mono">Aggregate workload usage per infrastructure node.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-secondaryText">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              <span>Real-time aggregation</span>
            </div>
          </div>
          {cpuChartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-secondaryText font-mono text-xs uppercase gap-2 border border-white/[0.02] rounded-xl bg-[#101010]/20">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Awaiting agent metric payloads...</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuChartData}>
                  <defs>
                    <linearGradient id="cpuGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#57E389" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#57E389" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cpuBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B8CFF" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#5B8CFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ fontSize: '11px', color: '#fff' }}
                  />
                  {serverNamesForLegend[0] && (
                    <Area type="monotone" dataKey={serverNamesForLegend[0]} stroke="#57E389" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuGreen)" />
                  )}
                  {serverNamesForLegend[1] && (
                    <Area type="monotone" dataKey={serverNamesForLegend[1]} stroke="#5B8CFF" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuBlue)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Network & Traffic Info */}
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Network IO</h3>
              <p className="text-[10px] text-secondaryText font-mono">Throughput speeds (MB/s).</p>
            </div>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          {networkChartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-secondaryText font-mono text-xs uppercase gap-2 border border-white/[0.02] rounded-xl bg-[#101010]/20">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Awaiting agent metric payloads...</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={networkChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ fontSize: '11px', color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="Download" stroke="#57E389" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Upload" stroke="#FF5F57" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Grid containing Active Alerts & Servers status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts Card */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Active Alerts log</h3>
            <button 
              onClick={() => onNavigateTab('alerts')}
              className="text-[10px] text-accent tracking-wider font-semibold hover:underline font-mono uppercase cursor-pointer"
            >
              Manage Alerts
            </button>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {alerts.slice(0, 5).map(alert => (
              <div 
                key={alert.id}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                  alert.status === 'Resolved'
                    ? 'bg-white/[0.01] border-white/5 opacity-50'
                    : alert.severity === 'Critical' 
                      ? 'bg-danger/5 border-danger/20 hover:border-danger/30' 
                      : 'bg-warning/5 border-warning/20 hover:border-warning/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    alert.status === 'Resolved' ? 'bg-accent animate-pulse' : alert.severity === 'Critical' ? 'bg-danger animate-pulse' : 'bg-warning'
                  }`}></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white uppercase truncate max-w-[120px]">
                        {alert.server_details?.name || 'Node'}
                      </span>
                      <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-secondaryText uppercase tracking-wider font-mono">
                        {alert.title}
                      </span>
                    </div>
                    <span className="text-xs text-secondaryText block mt-1 truncate max-w-[220px]">
                      {alert.description}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-secondaryText font-mono shrink-0 ml-3">
                  {formatAlertTime(alert.created_at)}
                </span>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="p-8 text-center text-secondaryText font-mono text-[10px] uppercase tracking-wider">
                No alerts detected. All systems nominal.
              </div>
            )}
          </div>
        </div>

        {/* Server List Status */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Infra Nodes Status</h3>
            <button 
              onClick={() => onNavigateTab('servers')}
              className="text-[10px] text-secondaryText hover:text-white flex items-center gap-1 uppercase font-mono tracking-wider cursor-pointer"
            >
              <span>View All</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {servers.slice(0, 5).map(server => {
              const m = latestMetricByServer[server.id] || { cpu_usage: 0, memory_usage: 0 };
              return (
                <div 
                  key={server.id} 
                  className="p-3 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-xl transition-all duration-150 flex items-center justify-between cursor-pointer"
                  onClick={() => onSelectServer(server.id)}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block font-mono uppercase truncate max-w-[150px]">{server.name}</span>
                    <span className="text-[10px] text-secondaryText block truncate mt-0.5 max-w-[150px] font-mono">{server.operating_system}</span>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {server.status === 'Online' && latestMetricByServer[server.id] ? (
                      <>
                        <div className="text-right">
                          <span className="text-[9px] text-secondaryText block font-mono">CPU</span>
                          <span className="text-xs font-mono text-white font-semibold">{m.cpu_usage.toFixed(0)}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-secondaryText block font-mono">RAM</span>
                          <span className="text-xs font-mono text-white font-semibold">{m.memory_usage.toFixed(0)}%</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-[9px] font-bold uppercase tracking-wider font-mono">online</span>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-[9px] font-bold uppercase tracking-wider font-mono">offline</span>
                    )}
                  </div>
                </div>
              );
            })}

            {servers.length === 0 && (
              <div className="p-8 text-center text-secondaryText font-mono text-[10px] uppercase tracking-wider">
                No server nodes registered.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
