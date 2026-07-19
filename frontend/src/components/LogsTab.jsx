import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, BookOpen, ToggleLeft, ToggleRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LogsTab() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const initialLogs = [
    { timestamp: '2026-07-19 12:24:32', server: 'prod-api-01', level: 'INFO', message: 'Metrics payload published successfully.' },
    { timestamp: '2026-07-19 12:24:18', server: 'prod-db-01', level: 'WARNING', message: 'Memory load exceeded threshold warning: 84%.' },
    { timestamp: '2026-07-19 12:23:55', server: 'prod-api-02', level: 'ERROR', message: 'Connection timeout on API endpoint POST /api/metrics/.' },
    { timestamp: '2026-07-19 12:23:44', server: 'prod-dns-01', level: 'INFO', message: 'Heartbeat registered successfully. Uptime: 345600s.' },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLogs(initialLogs);
      setLoading(false);
    }, 800);
  };

  // Add auto generator mock logs if auto refresh is active
  useEffect(() => {
    if (!autoRefresh || logs.length === 0) return;
    
    const interval = setInterval(() => {
      const levels = ['INFO', 'WARNING', 'ERROR'];
      const servers = ['prod-api-01', 'prod-db-01', 'prod-api-02', 'prod-dns-01'];
      const messages = {
        INFO: ['Uptime heartbeat ping successful.', 'Disk sweep completed cleanly.', 'Cache metrics refreshed.'],
        WARNING: ['High active CPU load detected.', 'Network I/O speed slowing down.', 'System memory exceeding 80%.'],
        ERROR: ['Failed to reach agent post gateway.', 'Disk space critical threshold reached (>95%).', 'Critical service crash reported.']
      };

      const randLevel = levels[Math.floor(Math.random() * levels.length)];
      const randServer = servers[Math.floor(Math.random() * servers.length)];
      const randMsg = messages[randLevel][Math.floor(Math.random() * messages[randLevel].length)];

      const newLog = {
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        server: randServer,
        level: randLevel,
        message: randMsg
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 14)]);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoRefresh, logs]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#050505] text-white">
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
            System logs
          </h1>
          <p className="text-secondaryText text-xs font-medium mt-1">
            Real-time event aggregator from host monitoring agents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-xs font-mono tracking-wider uppercase text-secondaryText hover:text-white transition-all cursor-pointer"
          >
            <span>Auto Refresh</span>
            {autoRefresh ? (
              <ToggleRight className="w-5 h-5 text-accent" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-secondaryText" />
            )}
          </button>

          {/* Docs Button */}
          <a
            href="https://github.com/NodeBeacon"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-xs font-mono tracking-wider uppercase text-secondaryText hover:text-white transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Docs</span>
          </a>

          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase font-mono tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        /* Empty State with Glowing Terminal */
        <div className="flex-1 flex flex-col items-center justify-center p-12 py-24 glass-panel rounded-2xl max-w-xl mx-auto text-center space-y-6 relative overflow-hidden group">
          {/* Scanner glow lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_48%,rgba(87,227,137,0.1)_50%,transparent_52%)] bg-[size:100%_40px] opacity-10 animate-scanline pointer-events-none" />
          
          <div className="w-16 h-16 bg-accent/10 text-accent border border-accent/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(87,227,137,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Terminal className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              No log events collected yet
            </h3>
            <p className="text-xs text-secondaryText leading-relaxed max-w-sm">
              Connect your Windows or Linux host agents. Ensure they have started publishing data payloads to the metrics gateway.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 hover:border-accent/40 text-accent font-bold text-xs uppercase font-mono tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-accent" />
            <span>Simulate Host Agent Logs</span>
          </button>
        </div>
      ) : (
        /* Logs Terminal Display Table */
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.4)]">
          <div className="bg-[#101010] px-6 py-3 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-secondaryText uppercase tracking-wider">
            <span>Terminal log output console</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              <span>active streaming</span>
            </span>
          </div>

          <div className="p-4 font-mono text-[11px] overflow-x-auto max-h-[500px] overflow-y-auto space-y-1.5">
            {logs.map((log, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-4 py-1.5 px-3 rounded-lg hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all duration-100"
              >
                <span className="text-secondaryText select-none shrink-0 font-light">{log.timestamp}</span>
                <span className="text-white font-semibold shrink-0 uppercase tracking-wider bg-white/5 px-2 py-0.2 rounded border border-white/5">{log.server}</span>
                <span className={`shrink-0 font-bold tracking-wider ${
                  log.level === 'ERROR' ? 'text-danger' : log.level === 'WARNING' ? 'text-warning' : 'text-accent'
                }`}>
                  [{log.level}]
                </span>
                <span className="text-white/90 leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
