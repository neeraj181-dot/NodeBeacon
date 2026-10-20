import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Download, LoaderCircle, Monitor, RotateCcw, Save, X } from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { validateAgentPort, validateAgentTarget } from './agentDeploymentUtils';

const statusStyle = status => {
  if (status === 'Connected') return 'border-accent/35 bg-accent/10 text-accent';
  if (status === 'Reconnecting') return 'border-warning/35 bg-warning/10 text-warning';
  if (status === 'Not installed' || status === 'Stopped' || status === 'Offline') return 'border-danger/25 bg-danger/10 text-danger';
  return 'border-foreground/15 bg-foreground/5 text-secondaryText';
};

export default function AgentDeployment({ servers = [], initialServer, onClose }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const ownedServers = servers.filter(server => server.owner_email === user?.email);
  const [id, setId] = useState(ownedServers.some(server => String(server.id) === String(initialServer?.id))
    ? String(initialServer.id) : String(ownedServers[0]?.id || ''));
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [enrollmentReset, setEnrollmentReset] = useState(false);
  const closeButton = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const device = ownedServers.find(server => String(server.id) === String(id));
  const validation = validateAgentTarget(host, port);
  const hostValidation = validateAgentTarget(host, '');
  const portValidation = validateAgentPort(port);
  const agentStatus = enrollmentReset ? 'Not installed' : (device?.agent_connection_status || (device?.device_id ? 'Registered' : 'Not installed'));
  const isEnrolled = !enrollmentReset && Boolean(device?.device_id) && agentStatus !== 'Not installed';

  useEffect(() => {
    const priorFocus = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const closeOnEscape = event => { if (event.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      priorFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    setFeedback(null);
    setEnrollmentReset(false);
    if (!id) return () => { active = false; };
    api.get(`servers/${id}/agent-config/`).then(({ data }) => {
      if (active) {
        setHost(data.server_url || '');
        setPort(data.server_port == null ? '' : String(data.server_port));
        setReady(true);
      }
    }).catch(() => {
      if (active) setFeedback({ type: 'error', text: 'Could not load this device’s agent settings. Check your connection and confirm you own this device.' });
    });
    return () => { active = false; };
  }, [id]);

  const perform = async action => {
    if (action === 'save' && !validation.valid) {
      setFeedback({ type: 'error', text: validation.error });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (action === 'save') {
        const { data } = await api.patch(`servers/${id}/agent-config/`, {
          server_url: host.trim(), server_port: port.trim() === '' ? null : Number(port),
        });
        setHost(data.server_url || host.trim());
        setPort(data.server_port == null ? '' : String(data.server_port));
        setFeedback({ type: 'success', text: 'Backend settings saved. The agent will confirm connectivity on its next check-in.' });
      } else if (action === 'reset') {
        const { data } = await api.post(`servers/${id}/agent-reset/`, { confirm: true });
        setEnrollmentReset(true);
        setFeedback({ type: 'success', text: data.detail || 'Enrollment reset confirmed by the backend.' });
      } else {
        const { data } = await api.post(`servers/${id}/agent-download/`, {}, { responseType: 'blob', timeout: 120000 });
        const url = URL.createObjectURL(data);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `NodeBeacon-${id}-Setup.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        setFeedback({ type: 'success', text: 'Setup package downloaded. Extract the entire ZIP and keep enrollment.json beside NodeBeaconAgent.exe. Install within 30 minutes.' });
      }
    } catch (error) {
      let data = error.response?.data;
      if (data instanceof Blob) {
        try { data = JSON.parse(await data.text()); } catch { data = null; }
      }
      const detail = data?.detail || (data ? Object.values(data).flat().join(' ') : 'Request failed. Check that NodeBeacon is reachable, then try again.');
      setFeedback({ type: 'error', text: String(detail) });
    } finally {
      setBusy(false);
    }
  };

  const resetEnrollment = () => {
    if (window.confirm('Revoke this device’s current agent credentials? Stop or uninstall the old agent first. Metrics history will be kept.')) perform('reset');
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 backdrop-blur-sm sm:p-6" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose?.();
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="agent-title" aria-describedby="agent-description"
      className="w-full max-w-3xl max-h-[min(92dvh,850px)] overflow-y-auto rounded-2xl border border-foreground/15 bg-card text-foreground shadow-2xl shadow-black/35 sm:rounded-3xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-foreground/10 bg-card px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><Monitor size={19} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 id="agent-title" className="text-lg font-semibold tracking-tight sm:text-xl">NodeBeacon <span className="text-accent">Devices</span></h3>
            <p id="agent-description" className="mt-1 text-sm text-secondaryText">Configure this PC’s metrics destination and agent setup.</p>
          </div>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close device settings"
          className="rounded-lg p-2 text-secondaryText transition hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={19} /></button>
      </header>

      <div className="space-y-5 px-5 py-5 sm:space-y-5 sm:px-7 sm:py-6">
        {!ownedServers.length ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          Add a server you own first, then reopen device setup.
        </div> : <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-semibold" htmlFor="agent-device">Device
              <span className="relative mt-2 block">
                <select id="agent-device" value={id} onChange={event => setId(event.target.value)} disabled={busy}
                  style={{ colorScheme: theme }}
                  className="block min-h-12 w-full appearance-none rounded-xl border border-foreground/15 bg-surface px-3.5 py-3 pr-11 text-foreground outline-none transition hover:border-foreground/25 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60">
                  {ownedServers.map(server => <option key={server.id} value={server.id}>{server.name}</option>)}
                </select>
                <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-secondaryText" aria-hidden="true" />
              </span>
            </label>
            <span className={`inline-flex min-h-10 w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${statusStyle(agentStatus)}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{agentStatus}
            </span>
          </div>

          <div className="grid gap-x-5 gap-y-4 rounded-xl border border-foreground/10 bg-surface/55 p-4 sm:grid-cols-2 sm:p-5">
            <div className="min-w-0 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondaryText">Device ID</p>
              <p className="mt-1.5 break-all font-mono text-xs leading-relaxed text-foreground">{device?.device_id || 'Assigned when the setup package is created'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondaryText">Last agent check-in</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{device?.agent_last_seen ? new Date(device.agent_last_seen).toLocaleString() : 'No check-in yet'}</p>
            </div>
            <p className="self-end text-xs leading-relaxed text-secondaryText sm:text-right">Connection status is confirmed by an agent check-in, not just a saved URL.</p>
          </div>

          {isEnrolled && <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] p-4 text-sm leading-relaxed text-foreground" role="note">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div><p className="font-semibold">An agent is already enrolled</p><p className="mt-1 text-secondaryText">Stop or uninstall the existing agent, then reset enrollment before downloading a replacement setup package.</p></div>
          </div>}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="block text-sm font-semibold" htmlFor="agent-host">Backend host or URL
              <input id="agent-host" type="text" autoComplete="url" spellCheck="false" disabled={!ready || busy}
                value={host} onChange={event => setHost(event.target.value)} placeholder="https://api.example.com"
                aria-invalid={!hostValidation.valid && Boolean(host)} aria-describedby="agent-host-hint"
                className={`mt-2 block min-h-12 w-full rounded-xl border bg-surface px-3.5 py-3 text-foreground shadow-sm outline-none transition placeholder:text-secondaryText/75 focus:ring-2 disabled:opacity-60 ${!hostValidation.valid && host.trim() ? 'border-danger focus:border-danger focus:ring-danger/25' : 'border-foreground/20 focus:border-accent focus:ring-accent/25'}`} />
              <span id="agent-host-hint" className="mt-1.5 block text-xs font-normal text-secondaryText">Use the same NodeBeacon backend and database that receive this PC’s metrics.</span>
              {host.trim() && !hostValidation.valid && <span className="mt-1 block text-xs text-danger">{hostValidation.error}</span>}
            </label>
            <label className="block text-sm font-semibold" htmlFor="agent-port">Port <span className="font-normal text-secondaryText">(optional)</span>
              <input id="agent-port" type="number" inputMode="numeric" min="1" max="65535" step="1" disabled={!ready || busy}
                value={port} onChange={event => setPort(event.target.value)} placeholder="Default"
                aria-invalid={!portValidation.valid && Boolean(port)}
                className={`mt-2 block min-h-12 w-full rounded-xl border bg-surface px-3.5 py-3 text-foreground shadow-sm outline-none transition placeholder:text-secondaryText/75 focus:ring-2 disabled:opacity-60 ${!portValidation.valid && port.trim() ? 'border-danger focus:border-danger focus:ring-danger/25' : 'border-foreground/20 focus:border-accent focus:ring-accent/25'}`} />
              {port.trim() && !portValidation.valid && <span className="mt-1 block text-xs text-danger">{portValidation.error}</span>}
            </label>
          </div>

          {validation.loopback && <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] p-4 text-sm leading-relaxed text-foreground" role="note">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <p><strong className="font-semibold">Local address</strong><span className="block mt-0.5 text-secondaryText">127.0.0.1 / localhost points to the PC running the agent. Keep it only if the NodeBeacon metrics backend runs on this same PC.</span></p>
          </div>}

          {!ready && !feedback && <p className="text-sm text-secondaryText" role="status">Loading settings from NodeBeacon…</p>}

          {feedback && <div role={feedback.type === 'error' ? 'alert' : 'status'} aria-live="polite"
            className={`flex gap-2.5 rounded-xl border p-3.5 text-sm leading-relaxed ${feedback.type === 'error' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-accent/30 bg-accent/10 text-foreground'}`}>
            {feedback.type === 'error' ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />}
            <span>{feedback.text}</span>
          </div>}

          <div className="grid gap-3 border-t border-foreground/10 pt-5 sm:grid-cols-[auto_1fr]">
            <button type="button" disabled={busy || !ready || !validation.valid} onClick={() => perform('save')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-[#072111] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}Save settings
            </button>
            <button type="button" disabled={busy || !ready || isEnrolled} onClick={() => perform('download')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-hover px-5 py-3 font-semibold text-foreground transition hover:border-accent/45 hover:bg-hover/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45">
              <Download size={17} />{isEnrolled ? 'Agent already enrolled' : 'Download Windows setup'}
            </button>
          </div>

          <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs leading-relaxed text-secondaryText">Start and Stop are local controls in the installed agent. Setup downloads are owner-only and single-use.</p>
            <button type="button" disabled={busy || !ready || !isEnrolled} onClick={resetEnrollment}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-45">
              <RotateCcw size={14} />Reset enrollment
            </button>
          </div>
        </>}
      </div>
    </section>
  </div>;
}
