import React, { useState } from 'react';
import { FileText, Download, Calendar, Play, CheckCircle2, TrendingUp, ShieldAlert, Cpu } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { exportPDF } from '../api/metrics';

export default function ReportsTab() {
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mockCpuData = [
    { day: 'Mon', CPU: 34 },
    { day: 'Tue', CPU: 42 },
    { day: 'Wed', CPU: 58 },
    { day: 'Thu', CPU: 31 },
    { day: 'Fri', CPU: 45 },
    { day: 'Sat', CPU: 20 },
    { day: 'Sun', CPU: 22 },
  ];

  const handleGenerateReport = () => {
    setGenerating(true);
    setErrorMsg('');
    setTimeout(() => {
      setReportGenerated(true);
      setGenerating(false);
    }, 1200);
  };

  const handleExportPDF = async () => {
    setDownloading(true);
    setErrorMsg('');
    try {
      const response = await exportPDF();
      
      // Determine file name from content-disposition header if available
      let filename = 'NodeBeacon_Report.pdf';
      const disposition = response.headers?.['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }

      // Create local URL blob reference and initiate download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF report', err);
      setErrorMsg('Failed to download PDF report. Please verify connection or try again later.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#050505] text-white">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
            Node Reports
          </h1>
          <p className="text-secondaryText text-xs font-medium mt-1">
            Weekly infrastructure health, uptime audits, and memory load summaries.
          </p>
        </div>
        
        {reportGenerated && (
          <button 
            onClick={() => setReportGenerated(false)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-xs font-mono tracking-wider uppercase text-secondaryText hover:text-white transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Change Period</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {!reportGenerated ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-12 py-24 glass-panel rounded-2xl max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-accent/10 text-accent border border-accent/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(87,227,137,0.15)]">
            <FileText className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Weekly Performance Audit
            </h3>
            <p className="text-xs text-secondaryText leading-relaxed max-w-sm">
              Generate performance audit reviews compiling CPU peaks, disk depletion predictions, and outages records.
            </p>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase font-mono tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
          >
            {generating ? (
              <span>Compiling Report metrics...</span>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate Audit Report</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Populated Report Dashboard */
        <div className="space-y-6">
          {/* Top Actions Row */}
          <div className="flex justify-between items-center bg-[#101010] p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold font-mono uppercase tracking-wider text-white">Report generated for July 12 - July 19</span>
            </div>
            <button 
              onClick={handleExportPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent text-[#070707] font-bold text-[10px] uppercase font-mono tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(87,227,137,0.15)] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Downloading...' : 'Export PDF'}</span>
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Availability */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Infrastructure Uptime</span>
              <div className="text-2xl font-bold font-mono text-accent">99.98%</div>
              <p className="text-[10px] text-secondaryText font-mono">Out of 168 total hours audited.</p>
            </div>

            {/* Incidents Summary */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Incidents Triggered</span>
              <div className="text-2xl font-bold font-mono text-white">0</div>
              <p className="text-[10px] text-accent font-mono">All systems nominal.</p>
            </div>

            {/* CPU peak */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Peak CPU utilization</span>
              <div className="text-2xl font-bold font-mono text-warning">84.2%</div>
              <p className="text-[10px] text-secondaryText font-mono">Logged on prod-db-01.</p>
            </div>

            {/* Average RAM */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Average memory consumption</span>
              <div className="text-2xl font-bold font-mono text-white">41.8%</div>
              <p className="text-[10px] text-secondaryText font-mono">Stable allocation levels.</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CPU trends */}
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-accent" />
                  <span>CPU Trends (7 Days)</span>
                </h3>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockCpuData}>
                    <defs>
                      <linearGradient id="reportCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#57E389" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#57E389" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }} 
                      labelStyle={{ color: '#8A8A8A', fontFamily: 'monospace', fontSize: '10px' }}
                      itemStyle={{ fontSize: '11px', color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="CPU" stroke="#57E389" strokeWidth={1.5} fillOpacity={1} fill="url(#reportCpu)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Incidents Details */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent" />
                <span>Incident Log Summary</span>
              </h3>
              <div className="space-y-3 font-mono text-[10px] text-secondaryText leading-relaxed">
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
                  <span>Critical: prod-api-02 offline</span>
                  <span className="text-[9px] bg-danger/10 border border-danger/20 text-danger px-1.5 py-0.2 rounded font-bold uppercase">resolved</span>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
                  <span>Warning: high memory load</span>
                  <span className="text-[9px] bg-danger/10 border border-danger/20 text-danger px-1.5 py-0.2 rounded font-bold uppercase">resolved</span>
                </div>
                <div className="p-8 text-center text-secondaryText font-mono uppercase text-[9px]">
                  All incidents resolved during audit period.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
