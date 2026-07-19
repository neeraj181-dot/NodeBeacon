import React, { useState, useEffect } from 'react';
import { useServers } from '../contexts/ServerContext';
import { getMetrics } from '../api/metrics';
import { Activity, Server, Cpu, Database, HardDrive, ArrowRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MetricsTab({ onSelectServer }) {
  const { servers } = useServers();
  const [latestMetrics, setLatestMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchLatestMetrics = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMetrics();
      
      // Group metrics by server ID and get the latest one for each
      const latestByServer = {};
      
      // Since metrics is sorted descending (newest first), the first metric we encounter 
      // for a server is the latest one!
      data.forEach(metric => {
        if (!latestByServer[metric.server]) {
          latestByServer[metric.server] = metric;
        }
      });
      
      setLatestMetrics(latestByServer);
    } catch (err) {
      console.error("Failed to load metrics", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestMetrics();

    // Poll latest metrics every 10 seconds
    const interval = setInterval(() => {
      fetchLatestMetrics(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMetricPercentageStyle = (value) => {
    if (value > 90) return 'text-danger';
    if (value > 75) return 'text-warning';
    return 'text-accent';
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background text-white select-none">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-mono uppercase">
          Live Fleet Resources
        </h1>
        <p className="text-secondaryText text-sm mt-1">
          Real-time resource utilization across your active infrastructure nodes.
        </p>
      </div>

      {loading && Object.keys(latestMetrics).length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table Header */}
          <div className="bg-card/50 border border-white/5 px-6 py-3 rounded-xl hidden md:flex items-center text-secondaryText text-[10px] font-mono uppercase tracking-wider">
            <div className="flex-1">Server Node</div>
            <div className="w-32 text-center">CPU Load</div>
            <div className="w-32 text-center">Memory (RAM)</div>
            <div className="w-32 text-center">Disk Space</div>
            <div className="w-36 text-right">Net Upload</div>
            <div className="w-36 text-right">Net Download</div>
            <div className="w-24"></div>
          </div>

          {/* Server rows */}
          {servers.map((server) => {
            const m = latestMetrics[server.id] || {
              cpu_usage: 0,
              memory_usage: 0,
              disk_usage: 0,
              network_out: 0,
              network_in: 0
            };

            const hasActiveMetrics = !!latestMetrics[server.id];

            return (
              <motion.div
                key={server.id}
                onClick={() => onSelectServer(server.id)}
                className="bg-card border border-white/5 p-5 md:px-6 md:py-4 rounded-2xl hover:border-white/10 transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Server info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-hover rounded-xl border border-white/5 shrink-0">
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white font-mono block uppercase truncate">{server.name}</span>
                    <span className="text-[10px] text-secondaryText block truncate font-mono mt-0.5">{server.hostname}</span>
                  </div>
                </div>

                {hasActiveMetrics && server.status === 'Online' ? (
                  /* Live stats column */
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0 justify-between md:justify-end flex-1">
                    {/* CPU */}
                    <div className="md:w-32 flex md:flex-col justify-between items-center md:text-center">
                      <span className="text-[10px] text-secondaryText uppercase font-mono md:hidden">CPU</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                        <Cpu className="w-3 h-3 text-secondaryText" />
                        <span className={getMetricPercentageStyle(m.cpu_usage)}>{m.cpu_usage.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Memory */}
                    <div className="md:w-32 flex md:flex-col justify-between items-center md:text-center">
                      <span className="text-[10px] text-secondaryText uppercase font-mono md:hidden">RAM</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                        <Database className="w-3 h-3 text-secondaryText" />
                        <span className={getMetricPercentageStyle(m.memory_usage)}>{m.memory_usage.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Disk */}
                    <div className="md:w-32 flex md:flex-col justify-between items-center md:text-center">
                      <span className="text-[10px] text-secondaryText uppercase font-mono md:hidden">Disk</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                        <HardDrive className="w-3 h-3 text-secondaryText" />
                        <span className="text-white">{m.disk_usage.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Upload */}
                    <div className="md:w-36 flex md:flex-col justify-between items-center md:text-right">
                      <span className="text-[10px] text-secondaryText uppercase font-mono md:hidden font-semibold">Net Upload</span>
                      <span className="font-mono text-xs text-white">{formatBytes(m.network_out)}</span>
                    </div>

                    {/* Download */}
                    <div className="md:w-36 flex md:flex-col justify-between items-center md:text-right">
                      <span className="text-[10px] text-secondaryText uppercase font-mono md:hidden font-semibold">Net Download</span>
                      <span className="font-mono text-xs text-white">{formatBytes(m.network_in)}</span>
                    </div>
                  </div>
                ) : (
                  /* Offline state */
                  <div className="flex-1 flex justify-start md:justify-end items-center">
                    <span className="px-2 py-0.5 rounded bg-danger/10 border border-danger/20 text-danger text-[9px] font-bold uppercase tracking-wider font-mono">
                      {server.status === 'Online' ? 'Awaiting Data' : 'offline'}
                    </span>
                  </div>
                )}

                {/* Inspect button */}
                <div className="w-10 flex justify-end">
                  <ArrowRight className="w-4 h-4 text-secondaryText group-hover:text-accent group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </motion.div>
            );
          })}

          {servers.length === 0 && (
            <div className="bg-card border border-white/5 p-12 rounded-2xl text-center max-w-sm mx-auto space-y-2">
              <Activity className="w-6 h-6 text-secondaryText mx-auto" />
              <h4 className="text-xs font-bold uppercase font-mono text-white">No active servers</h4>
              <p className="text-[11px] text-secondaryText">
                Register a server node to begin querying real-time resource loads.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
