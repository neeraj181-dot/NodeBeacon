import React, { useState, useEffect } from 'react';
import { MoreVertical, Server, Eye, Edit2, Trash2, Monitor, Terminal, Apple } from 'lucide-react';
import { motion } from 'framer-motion';
import OnlineBadge from './OnlineBadge';
// import MetricBar removed for simplified UI

// Helper to format last heartbeat
const formatLastSeen = (dateStr) => {
  const date = new Date(dateStr);
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ServerCard({ server, metrics, onViewServer, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  const toggleMenu = () => setShowMenu(!showMenu);

  // Determine OS icon and label
  const renderOS = () => {
    const os = server.operating_system?.toLowerCase() || '';
    if (os.includes('windows')) {
      return (
        <span className="flex items-center gap-1">
          <Monitor className="w-3.5 h-3.5 text-blue-400" />
          <span>{server.operating_system}</span>
        </span>
      );
    }
    if (os.includes('linux') || os.includes('ubuntu') || os.includes('debian') || os.includes('centos') || os.includes('mint') || os.includes('fedora') || os.includes('arch')) {
      return (
        <span className="flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5 text-yellow-500" />
          <span>{server.operating_system}</span>
        </span>
      );
    }
    if (os.includes('macos') || os.includes('apple')) {
      return (
        <span className="flex items-center gap-1">
          <Apple className="w-3.5 h-3.5 text-white/90" />
          <span>{server.operating_system}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        <Monitor className="w-3.5 h-3.5 text-secondaryText" />
        <span>{server.operating_system || 'Unknown OS'}</span>
      </span>
    );
  };

  const metric = metrics?.[server.id] || {};

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="server-card glass-panel"
    >
      {/* Top Header Row */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Server className="w-4 h-4 text-accent shrink-0" />
          <h3 className="text-base font-semibold text-white font-mono truncate" title={server.hostname}>
            {server.hostname}
          </h3>
          <span className="text-[11px] text-secondaryText font-mono px-1.5 py-0.5 bg-white/5 rounded">
            {server.device_type || 'Server'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <OnlineBadge status={server.status} />
          <div className="relative">
            <button onClick={toggleMenu} className="p-1 rounded text-secondaryText hover:text-white hover:bg-white/5 transition-colors">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-28 bg-[#121212] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden font-mono text-xs">
                <button onClick={() => { onViewServer?.(server.id); setShowMenu(false); }} className="flex items-center w-full px-3 py-2 text-white hover:bg-white/5 transition-colors">
                  <Eye className="w-3.5 h-3.5 mr-2" /> Inspect
                </button>
                <button onClick={() => { onEdit?.(server); setShowMenu(false); }} className="flex items-center w-full px-3 py-2 text-white hover:bg-white/5 transition-colors">
                  <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                </button>
                <button onClick={() => { onDelete?.(server); setShowMenu(false); }} className="flex items-center w-full px-3 py-2 text-danger hover:bg-white/5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Info Section */}
      <section className="mt-3 flex flex-col gap-1.5 text-xs text-secondaryText">
        <div className="flex items-center gap-2">
          <span className="shrink-0">{renderOS()}</span>
          <span className="text-white/20 font-mono">•</span>
          <span className="font-mono text-white/90">{server.ip_address}</span>
        </div>
        
        {/* Org Metadata info (optional) */}
        {(server.department || server.location || server.owner_email) && (
          <div className="text-[10px] font-mono text-secondaryText/80 space-y-0.5 border-t border-white/5 pt-1.5 mt-1">
            {server.owner_email && <div>Owner: <span className="text-white/80">{server.owner_email}</span></div>}
            {server.department && <div>Dept: <span className="text-white/80">{server.department}</span></div>}
            {server.location && <div>Loc: <span className="text-white/80">{server.location}</span></div>}
          </div>
        )}

        <div className="text-[11px] font-mono mt-1">
          Last check-in: <span className="text-white/80">{formatLastSeen(server.last_seen)}</span>
        </div>
      </section>

      {/* Metric Chips Row */}
      <section className="mt-3.5 flex gap-2">
        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-[11px] font-mono">
          <span className="text-secondaryText">CPU</span>
          <span className="font-bold text-white">{metric.cpu_usage != null ? `${metric.cpu_usage}%` : '—'}</span>
        </div>
        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-[11px] font-mono">
          <span className="text-secondaryText">RAM</span>
          <span className="font-bold text-white">{metric.memory_usage != null ? `${metric.memory_usage}%` : '—'}</span>
        </div>
        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-[11px] font-mono">
          <span className="text-secondaryText">DISK</span>
          <span className="font-bold text-white">{metric.disk_usage != null ? `${metric.disk_usage}%` : '—'}</span>
        </div>
      </section>

      {/* Compact Action Footer */}
      <footer className="mt-3.5 pt-3 border-t border-white/5 flex gap-2">
        <button
          onClick={() => onViewServer?.(server.id)}
          className="flex-1 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-semibold text-xs font-mono transition-colors flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Inspect
        </button>
        <button
          onClick={() => onEdit?.(server)}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs font-mono transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete?.(server)}
          className="px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger font-medium text-xs font-mono transition-colors"
        >
          Delete
        </button>
      </footer>
    </motion.div>
  );
}
