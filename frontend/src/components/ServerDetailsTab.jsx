import React, { useState, useEffect } from 'react';
import { getServer } from '../api/servers';
import { getServerMetrics } from '../api/metrics';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { 
  Server, Cpu, Database, HardDrive, ShieldCheck, Activity, ArrowLeft, RefreshCw, Clock
} from 'lucide-react';

export default function ServerDetailsTab({ serverId, onBack }) {
  const [server, setServer] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h'); // '1h' | '24h' | '7d'

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const serverData = await getServer(serverId);
      setServer(serverData);
      
      // Fetch up to 200 items of history
      const metricsData = await getServerMetrics(serverId, 200);
      // Reverse history data so that charts render chronologically (left to right)
      setMetrics([...metricsData].reverse());
    } catch (err) {
      console.error("Failed to load server details", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll server details and metrics every 10 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [serverId]);

  if (loading && !server) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-secondaryText font-mono text-xs uppercase tracking-wider gap-3">
        <RefreshCw className="w-4 h-4 animate-spin text-accent" />
        <span>Loading Node Fleet logs...</span>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-secondaryText gap-4 p-8">
        <span className="font-mono text-sm uppercase">Server not found</span>
        <button onClick={onBack} className="px-4 py-2 bg-hover border border-white/5 rounded-xl text-white text-xs font-mono uppercase">
          Back to fleet
        </button>
      </div>
    );
  }

  // Filter metrics on frontend based on selected time range
  const filteredMetrics = metrics.filter(m => {
    const timestamp = new Date(m.timestamp);
    const now = new Date();
    const diffMs = now - timestamp;
    
    if (timeRange === '1h') return diffMs <= 60 * 60 * 1000;
    if (timeRange === '24h') return diffMs <= 24 * 60 * 60 * 1000;
    if (timeRange === '7d') return diffMs <= 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  // Latest snapshot metrics (default to 0 if no metrics report yet)
  const latestMetric = metrics[metrics.length - 1] || {
    cpu_usage: 0.0,
    memory_usage: 0.0,
    disk_usage: 0.0,
    network_in: 0,
    network_out: 0,
    uptime: 0
  };

  // Format network traffic to human readable formats
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format uptime to human readable string
  const formatUptime = (seconds) => {
    if (!seconds) return '0h';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Format chart time labels
  const formatChartTime = (timeString) => {
    const date = new Date(timeString);
    if (timeRange === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Format chart data mapping
  const chartData = filteredMetrics.map(m => ({
    time: formatChartTime(m.timestamp),
    CPU: parseFloat(m.cpu_usage.toFixed(1)),
    RAM: parseFloat(m.memory_usage.toFixed(1)),
    Disk: parseFloat(m.disk_usage.toFixed(1)),
    Download: m.network_in,
    Upload: m.network_out
  }));

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background text-white select-none">
      
      {/* Header back navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-hover rounded-xl border border-white/5 text-secondaryText hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono uppercase">{server.name}</h1>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              server.status === 'Online' ? 'bg-accent/15 border border-accent/20 text-accent' : 'bg-danger/15 border border-danger/20 text-danger'
            }`}>
              {server.status}
            </span>
          </div>
          <p className="text-secondaryText text-xs mt-1 font-mono">{server.hostname} • {server.ip_address}</p>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU usage */}
        <div className="bg-card border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-secondaryText">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">CPU load</span>
            <Cpu className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono">{latestMetric.cpu_usage.toFixed(1)}%</span>
            <div className="w-full bg-surface h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
              <div className="bg-accent h-full rounded-full" style={{ width: `${latestMetric.cpu_usage}%` }}></div>
            </div>
          </div>
        </div>

        {/* Memory usage */}
        <div className="bg-card border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-secondaryText">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">Memory utilization</span>
            <Database className="w-4 h-4 text-blue" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono">{latestMetric.memory_usage.toFixed(1)}%</span>
            <div className="w-full bg-surface h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
              <div className="bg-blue h-full rounded-full" style={{ width: `${latestMetric.memory_usage}%` }}></div>
            </div>
          </div>
        </div>

        {/* Disk space */}
        <div className="bg-card border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-secondaryText">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">Disk space</span>
            <HardDrive className="w-4 h-4 text-white" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono">{latestMetric.disk_usage.toFixed(1)}%</span>
            <div className="w-full bg-surface h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
              <div className="bg-white h-full rounded-full" style={{ width: `${latestMetric.disk_usage}%` }}></div>
            </div>
          </div>
        </div>

        {/* System Uptime */}
        <div className="bg-card border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-secondaryText">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">Uptime</span>
            <Clock className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3 flex flex-col justify-between h-[52px]">
            <span className="text-3xl font-bold font-mono block leading-none">{formatUptime(latestMetric.uptime)}</span>
            <span className="text-[10px] text-secondaryText block leading-none mt-1">Platform: {server.operating_system}</span>
          </div>
        </div>
      </div>

      {/* Historical charts Filter */}
      <div className="bg-card border border-white/5 p-4 rounded-xl flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span>Historical Analytics</span>
        </h3>
        <div className="flex bg-surface p-1 rounded-lg border border-white/5 gap-1">
          {['1h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-[10px] font-bold font-mono uppercase rounded-md transition-all cursor-pointer ${
                timeRange === range ? 'bg-hover text-accent border border-white/5' : 'text-secondaryText hover:text-white'
              }`}
            >
              {range === '1h' ? 'Last Hour' : range === '24h' ? 'Last 24h' : 'Last 7 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      {chartData.length === 0 ? (
        <div className="bg-card border border-white/5 p-12 rounded-2xl text-center max-w-sm mx-auto space-y-2">
          <Activity className="w-6 h-6 text-secondaryText mx-auto" />
          <h4 className="text-xs font-bold uppercase font-mono text-white">No historical metrics</h4>
          <p className="text-[11px] text-secondaryText">
            Wait for the standalone Python agent on this node to submit metrics using the server API Key.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Area Chart */}
          <div className="bg-card border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">CPU History (%)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#57E389" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#57E389" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '9px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="CPU" stroke="#57E389" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Memory Area Chart */}
          <div className="bg-card border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">Memory History (%)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ramColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B8CFF" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#5B8CFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '9px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="RAM" stroke="#5B8CFF" strokeWidth={1.5} fillOpacity={1} fill="url(#ramColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Disk space Area Chart */}
          <div className="bg-card border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">Disk History (%)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="diskColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.06}/>
                      <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '9px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="Disk" stroke="#FFFFFF" strokeWidth={1.5} fillOpacity={1} fill="url(#diskColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Network Line Chart */}
          <div className="bg-card border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">Network Throughput</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={9} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => formatBytes(v)}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                    labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '9px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                    formatter={(value) => [formatBytes(value)]}
                  />
                  <Line type="monotone" dataKey="Download" stroke="#57E389" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Upload" stroke="#FF5F57" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
