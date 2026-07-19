import React from 'react';

export default function OnlineBadge({ status }) {
  const isOnline = status === 'Online';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
      isOnline 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
      <span className="opacity-80">{isOnline ? 'Online' : 'Offline'}</span>
    </span>
  );
}
