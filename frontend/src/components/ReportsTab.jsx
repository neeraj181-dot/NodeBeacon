import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calendar, Play, CheckCircle2, ShieldAlert, Cpu, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportPDF, getReportData } from '../api/metrics';

export default function ReportsTab() {
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Default reporting window: latest 7 calendar days ending today ('7d')
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const pickerRef = useRef(null);

  // Real report data returned from backend source of truth
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const fetchReport = async (period = selectedPeriod, cStart = customStart, cEnd = customEnd) => {
    setLoadingReport(true);
    setErrorMsg('');
    try {
      const params = { period };
      if (period === 'custom' && cStart && cEnd) {
        params.start_date = cStart;
        params.end_date = cEnd;
      }
      const data = await getReportData(params);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report data', err);
      setErrorMsg('Failed to fetch reporting metrics from backend.');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchReport('7d');
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPeriodPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectPeriod = (periodId) => {
    setSelectedPeriod(periodId);
    setShowPeriodPicker(false);
    fetchReport(periodId);
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      setSelectedPeriod('custom');
      setShowPeriodPicker(false);
      fetchReport('custom', customStart, customEnd);
    }
  };

  const handleGenerateReport = () => {
    setGenerating(true);
    setErrorMsg('');
    setTimeout(() => {
      setReportGenerated(true);
      setGenerating(false);
    }, 600);
  };

  const handleExportPDF = async () => {
    setDownloading(true);
    setErrorMsg('');
    try {
      const response = await exportPDF({
        period: selectedPeriod,
        start_date: customStart,
        end_date: customEnd,
      });

      let filename = 'NodeBeacon_Report.pdf';
      const disposition = response.headers?.['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }

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

  const getPeriodButtonLabel = () => {
    if (selectedPeriod === '24h') return 'Last 24 Hours';
    if (selectedPeriod === '7d') return 'Last 7 Days';
    if (selectedPeriod === '30d') return 'Last 30 Days';
    if (selectedPeriod === 'custom') return 'Custom Range';
    return 'Last 7 Days';
  };

  const hasData = reportData?.has_data;
  const coverageLabel = reportData?.coverage_label || 'NO MONITORING DATA AVAILABLE';

  const chartData = reportData?.cpu_trends && reportData.cpu_trends.length > 0
    ? reportData.cpu_trends
    : [{ day: 'No Data', CPU: 0 }];

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

        {/* Change Period Control */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPeriodPicker(prev => !prev)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-xs font-mono tracking-wider uppercase text-secondaryText hover:text-white transition-all cursor-pointer shadow-sm"
            id="change-period-btn"
          >
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span>{getPeriodButtonLabel()}</span>
            <ChevronDown className="w-3 h-3 text-secondaryText" />
          </button>

          {showPeriodPicker && (
            <div className="absolute right-0 mt-2 w-72 p-3 bg-[#11161B] border border-white/10 rounded-2xl shadow-2xl z-50 space-y-3 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-secondaryText px-1 border-b border-white/5 pb-2">
                Select Reporting Period
              </div>

              <div className="space-y-1">
                {[
                  { id: '24h', label: 'Last 24 Hours' },
                  { id: '7d', label: 'Last 7 Days (Weekly)' },
                  { id: '30d', label: 'Last 30 Days (Monthly)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectPeriod(opt.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-between text-xs ${
                      selectedPeriod === opt.id
                        ? 'bg-accent/15 text-accent font-bold border border-accent/30'
                        : 'text-secondaryText hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selectedPeriod === opt.id && <Check className="w-3.5 h-3.5 text-accent" />}
                  </button>
                ))}

                <button
                  onClick={() => setSelectedPeriod('custom')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-between text-xs ${
                    selectedPeriod === 'custom'
                      ? 'bg-accent/15 text-accent font-bold border border-accent/30'
                      : 'text-secondaryText hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Custom Date Range</span>
                  {selectedPeriod === 'custom' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              </div>

              {selectedPeriod === 'custom' && (
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl space-y-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-secondaryText uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-[#182029] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-secondaryText uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-[#182029] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    onClick={handleApplyCustom}
                    disabled={!customStart || !customEnd}
                    className="w-full mt-2 py-1.5 bg-accent text-[#070707] font-bold rounded-lg text-[10px] uppercase tracking-wider hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-40"
                  >
                    Apply Custom Range
                  </button>
                </div>
              )}

              <div className="border-t border-white/5 pt-2 flex items-center justify-end text-[10px]">
                <button
                  onClick={() => setShowPeriodPicker(false)}
                  className="text-secondaryText hover:text-white tracking-wider uppercase cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
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
              System Performance Health Audit
            </h3>
            <p className="text-xs text-secondaryText leading-relaxed max-w-sm">
              Generate performance audit reviews compiling CPU peaks, disk depletion predictions, and outages records.
            </p>
          </div>

          {/* Period Indicator */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-mono">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span className="text-secondaryText">Period:</span>
            <span className="text-white font-semibold">
              {hasData ? coverageLabel : (reportData ? 'NO MONITORING DATA AVAILABLE' : 'Last 7 Days')}
            </span>
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
          {/* Top Actions Row with dynamic banner */}
          <div className="flex justify-between items-center bg-[#101010] p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              {hasData ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold font-mono uppercase tracking-wider text-white" id="report-period-banner">
                    Report generated for {coverageLabel}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-xs font-semibold font-mono uppercase tracking-wider text-warning" id="report-period-banner">
                    NO MONITORING DATA AVAILABLE
                  </span>
                </>
              )}
            </div>

            <button
              onClick={handleExportPDF}
              disabled={downloading || loadingReport}
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
              <div className="text-2xl font-bold font-mono text-accent">
                {reportData ? reportData.fleet_uptime : '—'}
              </div>
              <p className="text-[10px] text-secondaryText font-mono">
                Out of {reportData?.audited_hours || 0} total hours audited.
              </p>
            </div>

            {/* Incidents Summary */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Incidents Triggered</span>
              <div className="text-2xl font-bold font-mono text-white">
                {reportData ? reportData.incidents_count : 0}
              </div>
              <p className="text-[10px] text-accent font-mono">
                {reportData?.incidents_count === 0 ? 'All systems nominal.' : `${reportData?.incidents_count} incident(s) triggered.`}
              </p>
            </div>

            {/* CPU peak */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Peak CPU utilization</span>
              <div className="text-2xl font-bold font-mono text-warning">
                {reportData ? `${reportData.peak_cpu}%` : '0.0%'}
              </div>
              <p className="text-[10px] text-secondaryText font-mono">
                Logged on {reportData?.peak_server || 'None'}.
              </p>
            </div>

            {/* Average RAM */}
            <div className="glass-panel p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Average memory consumption</span>
              <div className="text-2xl font-bold font-mono text-white">
                {reportData ? `${reportData.avg_memory}%` : '0.0%'}
              </div>
              <p className="text-[10px] text-secondaryText font-mono">
                {hasData ? 'Stable allocation levels.' : 'No telemetry records.'}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CPU trends */}
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-accent" />
                  <span>CPU Trends ({getPeriodButtonLabel()})</span>
                </h3>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="reportCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--chart-label)" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--chart-tooltip)', color: 'var(--color-foreground)', border: '1px solid var(--chart-grid)', borderRadius: '12px' }}
                      labelStyle={{ color: 'var(--chart-label)', fontFamily: 'monospace', fontSize: '10px' }}
                      itemStyle={{ fontSize: '11px', color: 'var(--color-foreground)' }}
                      formatter={(val) => [val != null ? `${val}%` : 'No Data (Gap)', 'CPU Load']}
                    />
                    <Area
                      type="monotone"
                      dataKey="CPU"
                      stroke="var(--color-accent)"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#reportCpu)"
                      connectNulls={false}
                    />
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
                {reportData?.incidents && reportData.incidents.length > 0 ? (
                  reportData.incidents.map((inc) => (
                    <div key={inc.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
                      <span>{inc.title}</span>
                      <span className="text-[9px] bg-danger/10 border border-danger/20 text-danger px-1.5 py-0.2 rounded font-bold uppercase">
                        {inc.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-secondaryText font-mono uppercase text-[9px]">
                    All incidents resolved during audit period.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
