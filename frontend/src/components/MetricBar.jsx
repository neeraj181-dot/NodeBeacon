import React from 'react';

export default function MetricBar({ label, value, unit = '%' }) {
  // If value is null/undefined, show placeholder
  if (value == null) {
    return (
      <div className="metric-bar">
        <span className="text-xs text-secondaryText uppercase block">{label}</span>
        <span className="text-sm text-white font-medium block">Waiting for metrics…</span>
      </div>
    );
  }

  const percent = Math.min(100, Math.round(value));
  return (
    <div className="metric-bar">
      <span className="text-xs text-secondaryText uppercase block">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-full bg-white/10 rounded h-4 overflow-hidden">
          <div
            className="h-4 bg-accent"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <span className="text-sm text-white font-medium">{percent}{unit}</span>
      </div>
    </div>
  );
}
