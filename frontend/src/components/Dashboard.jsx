import React, { useState, useEffect, useMemo } from 'react';
import { useServers } from '../contexts/ServerContext';
import { useAlerts } from '../contexts/AlertContext';
import { getMetrics } from '../api/metrics';
import { openActiveAlerts } from './dashboardAlertNavigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import {
  Server,
  Cpu,
  Database,
  HardDrive,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Activity
} from 'lucide-react';

function MetricSparkline({ values, color }) {
  if (values.length < 2) {
    return <span className="text-[10px] text-secondaryText">History unavailable</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 25 - ((value - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Recent metric history" className="h-7 w-24 shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Dashboard({ onSelectServer, onNavigateTab }) {
  // React Hook - useContext (Subscribes to global servers and alerts contexts)
  const { servers } = useServers();
  const { alerts, setFilters } = useAlerts();

  // React Hook - useState (Manages metric telemetry data and network loading state)
  const [metrics, setMetrics] = useState([]);
  const [, setLoadingMetrics] = useState(true);

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

  // React Hook - useEffect (Initiates periodic 10-second polling for live metric telemetry)
  useEffect(() => {
    fetchDashboardMetrics();
    const interval = setInterval(() => {
      fetchDashboardMetrics(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // React Hook - useMemo (Optimizes server and alert summary calculations across renders)
  const totalServers = servers.length;
  const onlineServers = useMemo(() => servers.filter(s => s.status === 'Online').length, [servers]);
  const offlineServers = totalServers - onlineServers;

  const activeAlerts = useMemo(() => alerts.filter(a => a.status === 'Active'), [alerts]);
  const activeAlertsCount = activeAlerts.length;
  const criticalAlertsCount = useMemo(() => activeAlerts.filter(a => a.severity === 'Critical').length, [activeAlerts]);
  const handleViewActiveAlerts = () => openActiveAlerts(activeAlerts, setFilters, onNavigateTab);

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

  const metricHistory = [...metrics].reverse();
  const cpuTrend = metricHistory.map(metric => Number(metric.cpu_usage)).filter(Number.isFinite).slice(-16);
  const memoryTrend = metricHistory.map(metric => Number(metric.memory_usage)).filter(Number.isFinite).slice(-16);
  const diskTrend = metricHistory.map(metric => Number(metric.disk_usage)).filter(Number.isFinite).slice(-16);
  const hasTelemetry = onlineServersWithMetrics.length > 0;
  const diskCritical = hasTelemetry && avgDisk >= 90;

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
    <div className="flex-1 min-w-0 overflow-y-auto px-5 py-6 sm:px-6 lg:px-8 space-y-6 bg-background text-foreground">
      {/* Hero Header */}
      <div className="border-b border-foreground/10 pb-5">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-secondaryText mb-2">NodeBeacon / Operations</p>
        <h1 className="text-3xl sm:text-[2rem] font-bold tracking-tight text-foreground">
          Monitor your infrastructure.
        </h1>
        <p className="text-secondaryText text-sm mt-1.5">
          Real-time metrics, node states, and health monitoring logs.
        </p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Servers KPI */}
        <div className="min-w-0 bg-card border border-foreground/10 p-4 sm:p-5 rounded-xl transition-colors hover:border-accent/35">
          <div className="flex justify-between items-start gap-3">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-[0.12em]">Total Servers</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Server className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl leading-none font-semibold font-mono tabular-nums text-foreground tracking-tight">{totalServers}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-[10px] font-semibold uppercase tracking-wide">
              <span className="inline-flex items-center gap-1.5 text-accent"><span className="w-1.5 h-1.5 rounded-full bg-accent" />{onlineServers} online</span>
              <span className={offlineServers > 0 ? 'inline-flex items-center gap-1.5 text-danger' : 'text-secondaryText'}>{offlineServers} offline</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden" aria-label={`${onlineServers} of ${totalServers} servers online`}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${totalServers ? (onlineServers / totalServers) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Avg CPU KPI */}
        <div className="min-w-0 bg-card border border-foreground/10 p-4 sm:p-5 rounded-xl transition-colors hover:border-accent/35">
          <div className="flex justify-between items-start gap-3">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-[0.12em]">Avg CPU Load</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Cpu className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl leading-none font-semibold font-mono tabular-nums text-foreground tracking-tight">{avgCpu}%</span>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              <span className={`w-1.5 h-1.5 rounded-full ${hasTelemetry ? 'bg-accent' : 'bg-secondaryText'}`} />
              <span>{hasTelemetry ? 'Telemetry active' : 'Awaiting telemetry'}</span>
            </div>
            <div className="mt-3 flex h-7 items-center justify-between gap-2 border-t border-foreground/10 pt-2">
              <span className="text-[10px] text-secondaryText">Recent samples</span>
              <MetricSparkline values={cpuTrend} color="var(--color-accent)" />
            </div>
          </div>
        </div>

        {/* Avg Memory KPI */}
        <div className="min-w-0 bg-card border border-foreground/10 p-4 sm:p-5 rounded-xl transition-colors hover:border-accent/35">
          <div className="flex justify-between items-start gap-3">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-[0.12em]">Avg RAM Load</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Database className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl leading-none font-semibold font-mono tabular-nums text-foreground tracking-tight">{avgMemory}%</span>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-secondaryText">
              <span className={`w-1.5 h-1.5 rounded-full ${hasTelemetry ? 'bg-accent' : 'bg-secondaryText'}`} />
              <span>{hasTelemetry ? 'Allocated load' : 'Awaiting telemetry'}</span>
            </div>
            <div className="mt-3 flex h-7 items-center justify-between gap-2 border-t border-foreground/10 pt-2">
              <span className="text-[10px] text-secondaryText">Recent samples</span>
              <MetricSparkline values={memoryTrend} color="var(--color-accent)" />
            </div>
          </div>
        </div>

        {/* Avg Disk KPI */}
        <div className={`min-w-0 bg-card border p-4 sm:p-5 rounded-xl transition-colors ${diskCritical ? 'border-danger/40' : 'border-foreground/10 hover:border-accent/35'}`}>
          <div className="flex justify-between items-start gap-3">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-[0.12em]">Avg Disk Load</span>
            <div className={`p-2 rounded-lg ${diskCritical ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
              <HardDrive className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl leading-none font-semibold font-mono tabular-nums text-foreground tracking-tight">{avgDisk}%</span>
            <div className={`flex items-center gap-1.5 mt-2.5 text-[10px] font-semibold uppercase tracking-wide ${diskCritical ? 'text-danger' : hasTelemetry ? 'text-accent' : 'text-secondaryText'}`}>
              {diskCritical ? <ShieldAlert className="w-3.5 h-3.5" /> : <span className={`w-1.5 h-1.5 rounded-full ${hasTelemetry ? 'bg-accent' : 'bg-secondaryText'}`} />}
              <span>{diskCritical ? 'Critical utilization' : hasTelemetry ? 'Capacity in range' : 'Awaiting telemetry'}</span>
            </div>
            <div className="mt-3 flex h-7 items-center justify-between gap-2 border-t border-foreground/10 pt-2">
              <span className="text-[10px] text-secondaryText">Recent samples</span>
              <MetricSparkline values={diskTrend} color={diskCritical ? 'var(--color-danger)' : 'var(--color-accent)'} />
            </div>
          </div>
        </div>

        {/* Active Alerts KPI */}
        <button
          type="button"
          onClick={handleViewActiveAlerts}
          disabled={activeAlertsCount === 0}
          aria-label={activeAlertsCount > 0 ? `View ${activeAlertsCount} active incidents in Alerts` : 'No active incidents'}
          className={`min-w-0 w-full appearance-none text-left bg-card border p-4 sm:p-5 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default ${activeAlertsCount > 0 ? 'cursor-pointer border-danger/40 bg-danger/[0.04] hover:border-danger/60 hover:bg-danger/[0.07]' : 'border-foreground/10'}`}
        >
          <div className="flex justify-between items-start gap-3">
            <span className="text-[10px] font-bold text-secondaryText uppercase tracking-[0.12em]">Active Outages</span>
            <div className={`p-2 rounded-lg ${activeAlertsCount > 0 ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl leading-none font-semibold font-mono tabular-nums text-foreground tracking-tight">{activeAlertsCount}</span>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-wide">
              {activeAlertsCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                  <span className="text-danger">{criticalAlertsCount} critical</span>
                </>
              ) : (
                <span className="text-accent">All nodes operational</span>
              )}
            </div>
            <p className="mt-3 border-t border-foreground/10 pt-2 text-[10px] text-secondaryText">{activeAlertsCount > 0 ? 'Incident requires attention' : 'No active incidents'}</p>
          </div>
        </button>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CPU Chart */}
        <div className="bg-card border border-foreground/10 p-5 sm:p-6 rounded-xl lg:col-span-2 space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">CPU History (24h)</h3>
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
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cpuBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-blue)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--chart-tooltip)', color: 'var(--color-foreground)', border: '1px solid var(--chart-grid)', borderRadius: '12px' }}
                    labelStyle={{ color: 'var(--chart-label)', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ fontSize: '11px', color: 'var(--color-foreground)' }}
                  />
                  {serverNamesForLegend[0] && (
                    <Area type="monotone" dataKey={serverNamesForLegend[0]} stroke="var(--color-accent)" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuGreen)" />
                  )}
                  {serverNamesForLegend[1] && (
                    <Area type="monotone" dataKey={serverNamesForLegend[1]} stroke="var(--color-blue)" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuBlue)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Network & Traffic Info */}
        <div className="bg-card border border-foreground/10 p-5 sm:p-6 rounded-xl space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">Network IO</h3>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--chart-tooltip)', color: 'var(--color-foreground)', border: '1px solid var(--chart-grid)', borderRadius: '12px' }}
                    labelStyle={{ color: 'var(--chart-label)', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ fontSize: '11px', color: 'var(--color-foreground)' }}
                  />
                  <Line type="monotone" dataKey="Download" stroke="var(--color-accent)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Upload" stroke="var(--color-danger)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Grid containing Active Alerts & Servers status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Alerts Card */}
        <div className="bg-card border border-foreground/10 p-5 sm:p-6 rounded-xl space-y-4">
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
                className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${alert.status === 'Resolved'
                    ? 'bg-white/[0.01] border-white/5 opacity-50'
                    : alert.severity === 'Critical'
                      ? 'bg-danger/5 border-danger/20 hover:border-danger/30'
                      : 'bg-warning/5 border-warning/20 hover:border-warning/30'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${alert.status === 'Resolved' ? 'bg-accent animate-pulse' : alert.severity === 'Critical' ? 'bg-danger animate-pulse' : 'bg-warning'
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
        <div className="bg-card border border-foreground/10 p-5 sm:p-6 rounded-xl space-y-4">
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
