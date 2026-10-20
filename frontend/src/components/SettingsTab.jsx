import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, ExternalLink, LoaderCircle, LockKeyhole, ShieldCheck, UserRound, BellRing, Building2, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword, getTelegramSettings, updateProfile } from '../api/auth';
import {
  getDesktopNotificationDiagnostics,
  requestDesktopNotificationPermission,
  showTestDesktopNotification,
  watchNotificationLifecycle,
} from './desktopNotifications';

const sectionClass = 'rounded-2xl border border-foreground/10 bg-card p-5 sm:p-6';
const inputClass = 'h-10 w-full rounded-xl border border-foreground/10 bg-surface/60 px-3.5 text-sm text-foreground outline-none transition placeholder:text-secondaryText focus:border-accent/50 focus:ring-2 focus:ring-accent/10 disabled:opacity-60';
const labelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-secondaryText';

function SectionHeading({ id, icon: Icon, title, description }) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-foreground/10 pb-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <h2 id={id} className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-secondaryText">{description}</p>}
      </div>
    </div>
  );
}

export default function SettingsTab({ onNavigateTab }) {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [desktopNotifs, setDesktopNotifs] = useState(user?.enable_desktop_notifications ?? true);
  const [desktopPermission, setDesktopPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [testingDesktop, setTestingDesktop] = useState(false);
  const [desktopMessage, setDesktopMessage] = useState({ type: '', message: '' });
  const [desktopDiagnostics, setDesktopDiagnostics] = useState(() => ({
    ...getDesktopNotificationDiagnostics(),
    serviceWorkerStatus: 'checking',
  }));
  const [telegram, setTelegram] = useState({ loading: true, error: false, connected: false, botInfoAvailable: false, botName: '', botUsername: '' });
  const [cpuThreshold, setCpuThreshold] = useState(user?.cpu_threshold || 90);
  const [memoryThreshold, setMemoryThreshold] = useState(user?.memory_threshold || 90);
  const [diskThreshold, setDiskThreshold] = useState(user?.disk_threshold || 95);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(user?.heartbeat_timeout || 60);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setEmail(user.email || '');
    setDesktopNotifs(user.enable_desktop_notifications ?? true);
    setCpuThreshold(user.cpu_threshold || 90);
    setMemoryThreshold(user.memory_threshold || 90);
    setDiskThreshold(user.disk_threshold || 95);
    setHeartbeatTimeout(user.heartbeat_timeout || 60);
  }, [user]);

  useEffect(() => {
    let current = true;
    const refreshDiagnostics = () => {
      const diagnostics = getDesktopNotificationDiagnostics();
      setDesktopPermission(diagnostics.permission);
      setDesktopDiagnostics({
        ...diagnostics,
        serviceWorkerStatus: diagnostics.serviceWorkerSupported ? 'checking' : 'unsupported',
      });
      if (!diagnostics.serviceWorkerSupported) return;
      const registrationPromise = window.__nodeBeaconNotificationRegistrationPromise
        || window.navigator.serviceWorker.ready;
      Promise.resolve(registrationPromise).then(registration => {
        if (!current) return;
        setDesktopDiagnostics(previous => ({
          ...previous,
          serviceWorkerStatus: registration?.active ? 'registered and active' : registration ? 'registered, inactive' : 'registration failed',
          serviceWorkerController: Boolean(window.navigator.serviceWorker.controller),
        }));
      }).catch(error => {
        console.warn('[DesktopNotification] Could not inspect service worker registration:', error);
        if (current) setDesktopDiagnostics(previous => ({ ...previous, serviceWorkerStatus: 'status unavailable' }));
      });
    };
    refreshDiagnostics();
    window.addEventListener('focus', refreshDiagnostics);
    window.navigator.serviceWorker?.addEventListener('controllerchange', refreshDiagnostics);
    return () => {
      current = false;
      window.removeEventListener('focus', refreshDiagnostics);
      window.navigator.serviceWorker?.removeEventListener('controllerchange', refreshDiagnostics);
    };
  }, []);

  useEffect(() => {
    let current = true;
    getTelegramSettings()
      .then(data => {
        if (!current) return;
        setTelegram({
          loading: false,
          error: Boolean(data.configured && !data.bot_info_available),
          connected: Boolean(data.connected),
          botInfoAvailable: Boolean(data.bot_info_available),
          botName: data.bot_name || '',
          botUsername: data.bot_username || '',
        });
      })
      .catch(() => {
        if (current) setTelegram(value => ({ ...value, loading: false, error: true }));
      });
    return () => { current = false; };
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updatedUser = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        email,
      });
      updateUser(updatedUser);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update profile', err);
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAlertSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updatedUser = await updateProfile({
        cpu_threshold: parseFloat(cpuThreshold),
        memory_threshold: parseFloat(memoryThreshold),
        disk_threshold: parseFloat(diskThreshold),
        heartbeat_timeout: parseInt(heartbeatTimeout, 10),
      });
      updateUser(updatedUser);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update alert thresholds', err);
      alert('Failed to save alert settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const requestDesktopPermission = async () => {
    setDesktopMessage({ type: '', message: '' });
    try {
      const result = await requestDesktopNotificationPermission();
      setDesktopPermission(result.permission);
      if (!result.supported) {
        setDesktopMessage({ type: 'error', message: 'This browser does not support desktop notifications.' });
        return false;
      }
      if (result.permission === 'denied') {
        setDesktopMessage({ type: 'error', message: 'Browser notification permission is blocked. Enable it in this site’s browser settings, then try again.' });
        return false;
      }
      if (result.permission !== 'granted') {
        setDesktopMessage({ type: 'error', message: 'Allow browser notifications to receive NodeBeacon alerts on your desktop.' });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Could not request browser notification permission', error);
      setDesktopMessage({ type: 'error', message: 'Could not check notification permission. Try again from your browser settings.' });
      return false;
    }
  };

  const handleDesktopToggle = async () => {
    setDesktopBusy(true);
    setDesktopMessage({ type: '', message: '' });
    try {
      if (!desktopNotifs && !(await requestDesktopPermission())) return;
      const nextEnabled = !desktopNotifs;
      const updatedUser = await updateProfile({ enable_desktop_notifications: nextEnabled });
      updateUser(updatedUser);
      setDesktopNotifs(Boolean(updatedUser.enable_desktop_notifications));
      setDesktopMessage({ type: 'success', message: nextEnabled ? 'Desktop notifications enabled.' : 'Desktop notifications disabled.' });
    } catch (error) {
      console.error('Failed to update desktop notification preference', error);
      setDesktopMessage({ type: 'error', message: 'Could not save the desktop notification setting. Try again.' });
    } finally {
      setDesktopBusy(false);
    }
  };

  const handleGrantDesktopPermission = async () => {
    const granted = await requestDesktopPermission();
    if (!granted) return;
    if (!desktopNotifs) await handleDesktopToggle();
    else setDesktopMessage({ type: 'success', message: 'Browser permission granted. Desktop alerts are ready.' });
  };

  const handleTestDesktopNotification = async () => {
    setTestingDesktop(true);
    setDesktopMessage({ type: '', message: '' });
    try {
      if (!desktopNotifs) {
        setDesktopMessage({ type: 'error', message: 'Turn on Desktop notifications before sending a test notification.' });
        return;
      }
      if (!(await requestDesktopPermission())) return;
      const diagnostics = getDesktopNotificationDiagnostics();
      const nextDiagnostics = {
        ...diagnostics,
        serviceWorkerStatus: diagnostics.serviceWorkerSupported ? desktopDiagnostics.serviceWorkerStatus : 'unsupported',
      };
      setDesktopDiagnostics(nextDiagnostics);
      console.info('[DesktopNotification] Notification.permission:', diagnostics.permission);
      console.info('[DesktopNotification] Notification.maxActions:', diagnostics.maxActions ?? 'not reported');
      console.info('[DesktopNotification] document.visibilityState:', diagnostics.visibilityState);
      console.info('[DesktopNotification] window.isSecureContext:', diagnostics.secureContext);
      console.info('[DesktopNotification] location.origin:', diagnostics.origin);
      console.info('[DesktopNotification] navigator.userAgent:', diagnostics.userAgent);
      console.info('[DesktopNotification] Service Worker:', nextDiagnostics.serviceWorkerStatus);
      const delivery = await showTestDesktopNotification(window.Notification, window.navigator);
      console.info('[DesktopNotification] Notification request accepted', { method: delivery.method });
      setDesktopMessage({
        type: 'info',
        message: `Notification request accepted by Chrome${delivery.method === 'service-worker' ? ' via the service worker' : ''}. If no popup appears, check Windows notification settings. Windows display is not verified by the web app.`,
      });
      if (!delivery.notification) return;
      watchNotificationLifecycle(delivery.notification, {
        onShow: () => {
          console.info('[DesktopNotification] test notification onshow; OS popup visibility is unverified.');
          setDesktopMessage({ type: 'info', message: 'Browser reported its notification show event. Windows popup visibility is still unverified; check Windows notification settings if no toast appeared.' });
        },
        onError: event => {
          console.error('[DesktopNotification] test notification error:', event?.type || 'unknown error');
          setDesktopMessage({ type: 'error', message: 'The browser reported a notification error. Check the browser console and Windows notification settings.' });
        },
        onClose: () => {
          console.info('[DesktopNotification] test notification close event; OS popup visibility is unverified.');
          setDesktopMessage({ type: 'info', message: 'Browser reported that the test notification closed. Windows popup visibility is unverified.' });
        },
      });
    } catch (error) {
      console.error('[DesktopNotification] test notification error:', error);
      setDesktopMessage({ type: 'error', message: error.message || 'Could not create the test notification.' });
    } finally {
      setTestingDesktop(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setUpdatingPassword(true);
    setSecurityFeedback({ type: '', message: '' });
    try {
      const strongPassword = newPassword.length >= 8
        && /[A-Z]/.test(newPassword)
        && /[a-z]/.test(newPassword)
        && /[0-9]/.test(newPassword)
        && /[^A-Za-z0-9]/.test(newPassword);
      if (!strongPassword) {
        setSecurityFeedback({ type: 'error', message: 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setSecurityFeedback({ type: 'error', message: 'The new passwords do not match.' });
        return;
      }
      await changePassword(currentPassword, newPassword);
      setSecurityFeedback({ type: 'success', message: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSecurityFeedback({ type: 'error', message: err.response?.data?.error || 'Could not update the password. Check your current password and try again.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
        <header className="border-b border-foreground/10 pb-4">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-secondaryText">NodeBeacon / Account</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">System settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondaryText">Customize your NodeBeacon account, security, and monitoring preferences.</p>
        </header>

        <section className={sectionClass} aria-labelledby="profile-settings-heading">
          <SectionHeading id="profile-settings-heading" icon={UserRound} title="Profile" description="Manage the personal details associated with your account." />
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className={labelClass}>First name</span><input type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} /></label>
              <label className="block"><span className={labelClass}>Last name</span><input type="text" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} /></label>
              <label className="block sm:col-span-2"><span className={labelClass}>Email address</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-foreground/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-secondaryText">Your profile changes are saved to your NodeBeacon account.</p>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-xs font-semibold text-[#072111] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60">
                {saved ? <><Check className="h-4 w-4" />Changes saved</> : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>

        <section className={sectionClass} aria-labelledby="security-settings-heading">
          <SectionHeading id="security-settings-heading" icon={ShieldCheck} title="Security" description="Change your password using your current account credentials." />
          {securityFeedback.message && <div role="status" className={`mb-5 rounded-xl border p-3 text-sm ${securityFeedback.type === 'success' ? 'border-accent/25 bg-accent/10 text-accent' : 'border-danger/25 bg-danger/10 text-danger'}`}>{securityFeedback.message}</div>}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: 'Current password', value: currentPassword, setter: setCurrentPassword, visible: showCurrent, setVisible: setShowCurrent, autoComplete: 'current-password' },
                { label: 'New password', value: newPassword, setter: setNewPassword, visible: showNew, setVisible: setShowNew, autoComplete: 'new-password' },
                { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword, visible: showConfirm, setVisible: setShowConfirm, autoComplete: 'new-password' },
              ].map((field) => (
                <label className="block" key={field.label}>
                  <span className={labelClass}>{field.label}</span>
                  <span className="relative block">
                    <input type={field.visible ? 'text' : 'password'} required autoComplete={field.autoComplete} value={field.value} onChange={(e) => field.setter(e.target.value)} className={`${inputClass} pr-11`} />
                    <button type="button" aria-label={`${field.visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} onClick={() => field.setVisible((value) => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-secondaryText transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#57E389]/60">
                      {field.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-secondaryText"><LockKeyhole className="h-4 w-4 shrink-0 text-accent" />Use 8+ characters, uppercase and lowercase letters, a number, and a symbol.</p>
              <button type="submit" disabled={updatingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword} className="h-10 shrink-0 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-5 text-xs font-semibold text-foreground transition hover:border-accent/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40">{updatingPassword ? 'Updating…' : 'Update password'}</button>
            </div>
          </form>
        </section>

        <section className={sectionClass} aria-labelledby="alert-settings-heading">
          <SectionHeading id="alert-settings-heading" icon={BellRing} title="Alerts & notifications" description="Configure how NodeBeacon delivers monitoring alerts." />
          <form onSubmit={handleSaveAlertSettings} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TelegramAlertStatus telegram={telegram} onManage={() => onNavigateTab?.('integrations')} />
              <div className="rounded-xl border border-foreground/10 bg-surface/60 p-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-sm font-semibold text-foreground">Desktop notifications</h3><p className="mt-1 text-xs leading-5 text-secondaryText">Show native browser notifications for new alerts and recoveries.</p></div>
                  <PreferenceToggle title="Desktop notifications" checked={desktopNotifs} onChange={handleDesktopToggle} disabled={desktopBusy} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-foreground/10 pt-3">
                  <p className={`text-xs font-semibold ${desktopPermission === 'denied' || desktopPermission === 'unsupported' ? 'text-danger' : desktopNotifs && desktopPermission === 'granted' ? 'text-accent' : 'text-secondaryText'}`} role="status">
                    {desktopPermission === 'denied' ? 'Blocked · Permission denied' : desktopPermission === 'unsupported' ? 'Unavailable · Notifications unsupported' : desktopNotifs && desktopPermission === 'granted' ? 'Enabled · Permission granted' : desktopNotifs ? 'Waiting for browser permission' : 'Off'}
                  </p>
                  {desktopPermission === 'default' && <button type="button" onClick={handleGrantDesktopPermission} disabled={desktopBusy} className="shrink-0 text-xs font-semibold text-accent hover:underline disabled:opacity-50">Allow notifications</button>}
                </div>
                <p className="mt-2 break-all text-[11px] text-secondaryText">Permission applies to this site: {window.location.origin}</p>
                {desktopPermission === 'denied' && <p className="mt-2 text-xs leading-5 text-danger">Browser notification permission is blocked. Enable notifications for this site in your browser settings.</p>}
                {desktopPermission === 'unsupported' && <p className="mt-2 text-xs leading-5 text-secondaryText">This browser does not support native desktop notifications.</p>}
                {desktopMessage.message && <p className={`mt-2 flex items-start gap-1.5 text-xs leading-5 ${desktopMessage.type === 'error' ? 'text-danger' : 'text-secondaryText'}`} role={desktopMessage.type === 'error' ? 'alert' : 'status'}><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{desktopMessage.message}</p>}
                <button type="button" onClick={handleTestDesktopNotification} disabled={testingDesktop || desktopBusy} className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-foreground/10 px-3 text-xs font-semibold text-foreground transition hover:border-accent/40 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60">{testingDesktop ? 'Testing…' : 'Send Test Desktop Notification'}</button>
                <details className="mt-3 rounded-lg border border-foreground/10 bg-background/50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-secondaryText">Browser notification diagnostics</summary>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] leading-4 text-secondaryText">
                    <dt>Notification API</dt><dd>{desktopDiagnostics.apiAvailable ? 'Available' : 'Unavailable'}</dd>
                    <dt>Permission</dt><dd>{desktopDiagnostics.permission}</dd>
                    <dt>Origin</dt><dd className="break-all">{desktopDiagnostics.origin}</dd>
                    <dt>Secure context</dt><dd>{desktopDiagnostics.secureContext ? 'Yes' : 'No'}</dd>
                    <dt>Document visibility</dt><dd>{desktopDiagnostics.visibilityState}</dd>
                    <dt>Maximum actions</dt><dd>{desktopDiagnostics.maxActions ?? 'Not reported'}</dd>
                    <dt>Service worker</dt><dd>{desktopDiagnostics.serviceWorkerStatus}</dd>
                    <dt>Controls this page</dt><dd>{desktopDiagnostics.serviceWorkerController ? 'Yes' : 'No'}</dd>
                  </dl>
                  <p className="mt-2 break-all text-[10px] leading-4 text-secondaryText">{desktopDiagnostics.userAgent}</p>
                </details>
                <p className="mt-3 text-[11px] leading-4 text-secondaryText">If the browser accepts the request but no Windows toast appears, check Windows Settings → System → Notifications → Google Chrome, and Chrome Settings → Site settings → Notifications → Allowed → localhost.</p>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-5">
              <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-foreground">Alert thresholds</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberSetting label="CPU threshold (%)" value={cpuThreshold} onChange={setCpuThreshold} min="0" max="100" />
                <NumberSetting label="Memory threshold (%)" value={memoryThreshold} onChange={setMemoryThreshold} min="0" max="100" />
                <NumberSetting label="Disk threshold (%)" value={diskThreshold} onChange={setDiskThreshold} min="0" max="100" />
                <NumberSetting label="Heartbeat timeout (seconds)" value={heartbeatTimeout} onChange={setHeartbeatTimeout} min="10" />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-foreground/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-secondaryText">Changes are confirmed only after the server accepts them.</p>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-xs font-semibold text-[#072111] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60">{saved ? <><Check className="h-4 w-4" />Changes saved</> : saving ? 'Saving…' : 'Save alert settings'}</button>
            </div>
          </form>
        </section>

        {(user?.role === 'ORGANIZATION_ADMIN' || user?.role === 'MEMBER') && (
          <section className={sectionClass} aria-labelledby="organization-settings-heading">
            <SectionHeading id="organization-settings-heading" icon={Building2} title="Organization" description="Organization details and recipients available to your account." />
            <OrgSettingsForm />
          </section>
        )}
      </div>
    </main>
  );
}

function TelegramAlertStatus({ telegram, onManage }) {
  const connected = telegram.connected && telegram.botInfoAvailable && !telegram.error;
  const status = telegram.loading ? 'Checking status' : telegram.error ? 'Connection error' : connected ? 'Connected' : 'Telegram is not connected';
  return (
    <div className="rounded-xl border border-foreground/10 bg-surface/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent"><Bot className="h-4 w-4" aria-hidden="true" /></span>
          <div><h3 className="text-sm font-semibold text-foreground">Telegram connection</h3><p className="mt-1 text-xs leading-5 text-secondaryText">View the status of your paired NodeBeacon Telegram bot.</p></div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${connected ? 'border-accent/25 bg-accent/10 text-accent' : telegram.error ? 'border-danger/25 bg-danger/10 text-danger' : 'border-foreground/15 bg-foreground/5 text-secondaryText'}`} role="status">
          {telegram.loading ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" /> : <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-accent' : telegram.error ? 'bg-danger' : 'bg-current'}`} aria-hidden="true" />}
          {status}
        </span>
      </div>
      {connected && <div className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">{telegram.botName || 'NodeBeacon Alerts'}</p>
        {telegram.botUsername && <p className="mt-0.5 font-mono text-[11px] text-secondaryText">@{telegram.botUsername}</p>}
      </div>}
      {!telegram.loading && !connected && <p className="mt-2 text-xs text-secondaryText">Connect Telegram from Integrations to manage this channel.</p>}
      <button type="button" onClick={onManage} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {connected ? 'Manage Telegram' : 'Open Integrations'}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function PreferenceToggle({ title, checked, onChange, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={onChange} disabled={disabled} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60 ${checked ? 'bg-accent' : 'bg-foreground/20'}`}>
        {disabled && <LoaderCircle className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" aria-hidden="true" />}
        {!disabled && <span className={`pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />}
      </button>
    );
}

function NumberSetting({ label, value, onChange, min, max }) {
  return <label className="block"><span className={labelClass}>{label}</span><input type="number" required min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} nodebeacon-number-input`} /></label>;
}

function OrgSettingsForm() {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertRecipients, setAlertRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const { getOrgSettings } = await import('../api/auth');
        const data = await getOrgSettings();
        setOrgName(data.organization_name || '');
        setAlertEmail(data.alert_email || '');
        setAlertRecipients(data.alert_recipients || '');
      } catch (err) {
        console.error('Failed to load organization settings', err);
      }
    };
    fetchOrg();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const { updateOrgSettings } = await import('../api/auth');
      await updateOrgSettings({ organization_name: orgName, alert_email: alertEmail, alert_recipients: alertRecipients });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update organization settings', err);
      alert('Failed to update organization settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'ORGANIZATION_ADMIN';
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block"><span className={labelClass}>Organization name</span><input type="text" required disabled={!isAdmin} value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} /></label>
        <label className="block"><span className={labelClass}>Alert email</span><input type="email" required disabled={!isAdmin} value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} className={inputClass} /></label>
        <label className="block sm:col-span-2"><span className={labelClass}>Alert recipients (comma separated)</span><textarea disabled={!isAdmin} value={alertRecipients} onChange={(e) => setAlertRecipients(e.target.value)} placeholder="admin@example.com, ops@example.com" className={`${inputClass} h-24 py-3 font-mono`} /></label>
      </div>
      {isAdmin && <div className="flex justify-end border-t border-foreground/10 pt-4"><button type="submit" disabled={loading} className="h-10 rounded-xl bg-accent px-5 text-xs font-semibold text-[#072111] transition hover:brightness-105 disabled:opacity-60">{loading ? 'Saving…' : saved ? 'Changes saved' : 'Save organization settings'}</button></div>}
    </form>
  );
}
