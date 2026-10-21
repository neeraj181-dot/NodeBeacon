import React, { useState, useEffect } from 'react';
import {
  AlertCircle, Bot, CheckCircle2, Clock, ExternalLink, Inbox,
  LoaderCircle, Mail, RefreshCw, Send, ShieldCheck
} from 'lucide-react';
import {
  getTelegramSettings, updateTelegramSettings, startTelegramConnect,
  verifyTelegramConnect, sendTelegramTest,
  getEmailSettings, updateEmailSettings, connectEmail,
  verifyEmailCode, resendEmailVerification, sendEmailTestNotification
} from '../api/auth';

const emptyTelegramSettings = {
  configured: false,
  connected: false,
  notify_on_laptop_unlock_telegram: false,
  bot_info_available: false,
  bot_name: '',
  bot_username: '',
  bot_url: '',
};

const emptyEmailSettings = {
  configured: false,
  status: 'not_connected',
  recipient_email: '',
  unverified_email: '',
  is_verified: false,
  enable_email_notifications: true,
  notify_offline_email: true,
  notify_critical_email: true,
  notify_on_laptop_unlock: false,
  resend_cooldown: 0,
};

const isTrustedTelegramUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export default function IntegrationsTab() {
  // Telegram State
  const [telegram, setTelegram] = useState(emptyTelegramSettings);
  const [telegramStatusError, setTelegramStatusError] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramFeedback, setTelegramFeedback] = useState({ type: '', message: '' });
  const [telegramBusy, setTelegramBusy] = useState('');

  // Email State
  const [email, setEmail] = useState(emptyEmailSettings);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailFeedback, setEmailFeedback] = useState({ type: '', message: '' });
  const [emailBusy, setEmailBusy] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Load initial settings
  useEffect(() => {
    let active = true;

    // Fetch Telegram settings
    getTelegramSettings()
      .then(value => {
        if (!active) return;
        setTelegram({ ...emptyTelegramSettings, ...value });
        const unavailable = Boolean(value.configured && !value.bot_info_available);
        setTelegramStatusError(unavailable);
        if (unavailable) setTelegramFeedback({ type: 'error', message: 'Unable to retrieve Telegram bot information. Retry the connection check.' });
      })
      .catch(() => {
        if (active) {
          setTelegramStatusError(true);
          setTelegramFeedback({ type: 'error', message: 'Unable to retrieve Telegram status. Check backend connection.' });
        }
      })
      .finally(() => {
        if (active) setTelegramLoading(false);
      });

    // Fetch Email settings
    getEmailSettings()
      .then(value => {
        if (!active) return;
        setEmail({ ...emptyEmailSettings, ...value });
        if (value.unverified_email) {
          setInputEmail(value.unverified_email);
        } else if (value.recipient_email) {
          setInputEmail(value.recipient_email);
        }
        if (value.resend_cooldown > 0) {
          setResendTimer(value.resend_cooldown);
        }
      })
      .catch(() => {
        if (active) {
          setEmailFeedback({ type: 'error', message: 'Unable to retrieve Email notification settings.' });
        }
      })
      .finally(() => {
        if (active) setEmailLoading(false);
      });

    // Inspect URL query params for email verification redirect
    try {
      const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
      if (urlParams.get('email_verified') === 'true') {
        const verifiedAddress = urlParams.get('recipient') || '';
        setEmailFeedback({
          type: 'success',
          message: verifiedAddress
            ? `Email ${verifiedAddress} was verified successfully. Notifications are now active.`
            : 'Email address verified successfully. Notifications are active.'
        });
      } else if (urlParams.get('email_verified') === 'false') {
        const err = urlParams.get('error') || '';
        setEmailFeedback({
          type: 'error',
          message: err === 'invalid_or_expired'
            ? 'The email verification link has expired or is invalid. Request a new link.'
            : 'Email verification could not be completed.'
        });
      }
    } catch {
      // Ignore URL parsing errors
    }

    return () => { active = false; };
  }, []);

  // Countdown timer for email resend cooldown
  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const interval = setInterval(() => {
      setResendTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Telegram link expiry
  useEffect(() => {
    if (!telegramLink) return undefined;
    const timeout = window.setTimeout(() => {
      setTelegramLink(null);
      setTelegramFeedback({ type: 'info', message: 'The Telegram link expired. Create a new link to continue connecting.' });
    }, Math.max(0, telegramLink.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [telegramLink]);

  // ----------------------------------------------------
  // Telegram Action Handlers
  // ----------------------------------------------------
  const runTelegramAction = async (name, action) => {
    setTelegramBusy(name);
    setTelegramFeedback({ type: '', message: '' });
    try {
      await action();
    } catch (err) {
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message;
      const message = backendMessage || (name === 'test'
        ? 'Failed to send test notification.'
        : name === 'verify' && status === 400
          ? 'Could not verify the chat. Open the latest Telegram link, press Start, then retry verification.'
          : name === 'connect' && status === 503
            ? 'Telegram could not be reached. Check the backend connection and retry.'
            : 'Telegram request failed. Check the NodeBeacon connection and try again.');
      setTelegramFeedback({ type: 'error', message });
    } finally {
      setTelegramBusy('');
    }
  };

  const applyTelegramSettings = value => {
    setTelegram({ ...emptyTelegramSettings, ...value });
    setTelegramStatusError(Boolean(value.configured && !value.bot_info_available));
  };

  const handleTelegramRefresh = () => runTelegramAction('refresh', async () => {
    const value = await getTelegramSettings();
    applyTelegramSettings(value);
    if (value.configured && !value.bot_info_available) {
      setTelegramFeedback({ type: 'error', message: 'Unable to retrieve Telegram bot information. Check the backend connection and retry.' });
    }
  });

  const handleTelegramConnect = () => runTelegramAction('connect', async () => {
    const result = await startTelegramConnect();
    if (!isTrustedTelegramUrl(result.bot_url)) throw new Error('Invalid Telegram link');
    const lifetime = Math.min(86400, Math.max(1, Number(result.expires_in) || 600));
    setTelegramLink({ url: result.bot_url, expiresAt: Date.now() + lifetime * 1000 });
    setTelegramFeedback({ type: 'info', message: 'Your secure link is ready. Open Telegram, press Start, then verify the connection here.' });
  });

  const handleTelegramVerify = () => runTelegramAction('verify', async () => {
    await verifyTelegramConnect();
    const value = await getTelegramSettings();
    applyTelegramSettings(value);
    setTelegramLink(null);
    setTelegramFeedback(value.connected
      ? { type: 'success', message: 'Telegram connected. Your unlock-alert setting is up to date.' }
      : { type: 'error', message: 'The backend did not confirm the Telegram connection. Retry verification.' });
  });

  const handleTelegramTest = () => runTelegramAction('test', async () => {
    await sendTelegramTest();
    setTelegramFeedback({ type: 'success', message: 'Test notification sent successfully.' });
  });

  const handleTelegramNotifyToggle = () => runTelegramAction('toggle', async () => {
    const result = await updateTelegramSettings({
      notify_on_laptop_unlock_telegram: !telegram.notify_on_laptop_unlock_telegram,
    });
    setTelegram(value => ({ ...value, ...result }));
    setTelegramFeedback({ type: 'success', message: result.notify_on_laptop_unlock_telegram ? 'Laptop unlock alerts enabled for Telegram.' : 'Telegram laptop unlock alerts disabled.' });
  });

  const handleTelegramDisconnect = () => runTelegramAction('disconnect', async () => {
    const result = await updateTelegramSettings({ disconnect: true });
    setTelegram(value => ({ ...value, ...result }));
    setTelegramLink(null);
    setTelegramFeedback({ type: 'success', message: 'Telegram disconnected and unlock alerts disabled.' });
  });

  // ----------------------------------------------------
  // Email Action Handlers
  // ----------------------------------------------------
  const runEmailAction = async (name, action) => {
    setEmailBusy(name);
    setEmailFeedback({ type: '', message: '' });
    try {
      await action();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Email request failed. Please check your settings.';
      setEmailFeedback({ type: 'error', message: errMsg });
    } finally {
      setEmailBusy('');
    }
  };

  const handleConnectEmail = e => {
    if (e) e.preventDefault();
    if (!inputEmail.trim()) return;

    runEmailAction('connect', async () => {
      const res = await connectEmail(inputEmail.trim());
      const refreshed = await getEmailSettings();
      setEmail({ ...emptyEmailSettings, ...refreshed });
      setIsEditingEmail(false);
      setResendTimer(60);
      setEmailFeedback({
        type: 'info',
        message: res.message || `Verification code sent to ${inputEmail.trim()}. Check your inbox or spam folder.`
      });
    });
  };

  const handleVerifyEmail = e => {
    if (e) e.preventDefault();
    if (!verificationCode.trim()) return;

    runEmailAction('verify', async () => {
      const res = await verifyEmailCode(verificationCode.trim());
      const refreshed = await getEmailSettings();
      setEmail({ ...emptyEmailSettings, ...refreshed });
      setVerificationCode('');
      setIsEditingEmail(false);
      setEmailFeedback({
        type: 'success',
        message: res.message || 'Email verified successfully. Notifications are active.'
      });
    });
  };

  const handleResendEmail = () => {
    runEmailAction('resend', async () => {
      const res = await resendEmailVerification();
      setResendTimer(res.cooldown || 60);
      setEmailFeedback({
        type: 'info',
        message: res.message || 'Verification email resent. Please check your inbox.'
      });
    });
  };

  const handleSendTestEmail = () => {
    runEmailAction('test', async () => {
      const res = await sendEmailTestNotification();
      setEmailFeedback({
        type: 'success',
        message: res.message || 'Test notification sent successfully.'
      });
    });
  };

  const handleEmailPreferenceToggle = preferenceKey => {
    runEmailAction(`toggle-${preferenceKey}`, async () => {
      const updated = await updateEmailSettings({
        [preferenceKey]: !email[preferenceKey],
      });
      setEmail(prev => ({ ...prev, ...updated }));
      setEmailFeedback({
        type: 'success',
        message: 'Notification preference saved.'
      });
    });
  };

  const handleDisconnectEmail = () => {
    runEmailAction('disconnect', async () => {
      await updateEmailSettings({ disconnect: true });
      const refreshed = await getEmailSettings();
      setEmail({ ...emptyEmailSettings, ...refreshed });
      setInputEmail('');
      setVerificationCode('');
      setIsEditingEmail(false);
      setEmailFeedback({
        type: 'success',
        message: 'Email disconnected and notifications deactivated.'
      });
    });
  };

  const handleRefreshEmailSettings = () => {
    runEmailAction('refresh', async () => {
      const refreshed = await getEmailSettings();
      setEmail({ ...emptyEmailSettings, ...refreshed });
    });
  };

  // Status Computations
  const telegramConnected = telegram.connected && telegram.bot_info_available && !telegramStatusError;
  const isEmailConnected = email.is_verified && email.status === 'connected';
  const isEmailPending = email.status === 'pending_verification';
  const isEmailError = email.status === 'error';

  const activeEmailCategoriesCount = [
    email.notify_offline_email,
    email.notify_critical_email,
    email.notify_on_laptop_unlock
  ].filter(Boolean).length;

  return (
    <main className="flex-1 overflow-y-auto bg-[#050505] px-4 py-6 text-white sm:px-6 sm:py-8">
      <header className="mb-7 border-b border-white/5 pb-4">
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">Integrations</h1>
        <p className="mt-1 text-xs font-medium text-secondaryText">Manage your NodeBeacon notification channels and multi-channel incident dispatch.</p>
      </header>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* ==================================================== */}
        {/* 1. EMAIL NOTIFICATIONS CARD */}
        {/* ==================================================== */}
        <section
          className="w-full rounded-2xl border border-foreground/10 bg-card p-5 shadow-xl shadow-black/20 sm:p-6"
          aria-labelledby="email-card-title"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
              <Mail size={24} aria-hidden="true" />
            </span>
            <h2 id="email-card-title" className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              Email Notifications
            </h2>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${emailLoading
                  ? 'border-foreground/15 bg-foreground/5 text-secondaryText'
                  : isEmailConnected
                    ? 'border-accent/25 bg-accent/10 text-accent'
                    : isEmailPending
                      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                      : isEmailError
                        ? 'border-danger/25 bg-danger/10 text-danger'
                        : 'border-foreground/15 bg-foreground/5 text-secondaryText'
                }`}
              role="status"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${emailLoading
                    ? 'bg-current'
                    : isEmailConnected
                      ? 'bg-accent'
                      : isEmailPending
                        ? 'bg-amber-400'
                        : isEmailError
                          ? 'bg-danger'
                          : 'bg-current'
                  }`}
                aria-hidden="true"
              />
              {emailLoading
                ? 'Checking status'
                : isEmailConnected
                  ? 'Connected'
                  : isEmailPending
                    ? 'Pending verification'
                    : isEmailError
                      ? 'Configuration error'
                      : email.configured
                        ? 'Not connected'
                        : 'Not configured'}
            </div>
          </div>

          {/* Info Banner */}
          {isEmailConnected && !isEditingEmail ? (
            <div className="mt-5 rounded-xl border border-foreground/10 bg-surface/60 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-secondaryText">
                <CheckCircle2 size={15} className="text-accent" aria-hidden="true" />
                Verified Recipient
              </div>
              <p className="mt-1.5 truncate font-mono text-sm font-semibold text-foreground">
                {email.recipient_email}
              </p>
              <p className="mt-0.5 text-xs text-accent">Active &amp; ready to receive alert dispatches</p>
            </div>
          ) : isEmailPending && !isEditingEmail ? (
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400">
                <Clock size={15} aria-hidden="true" />
                Awaiting Verification
              </div>
              <p className="mt-1.5 truncate font-mono text-sm font-semibold text-foreground">
                {email.unverified_email}
              </p>
              <p className="mt-0.5 text-xs text-secondaryText">Enter the 6-digit code sent to your inbox</p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-foreground/10 bg-surface/60 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-secondaryText">
                <Inbox size={15} aria-hidden="true" />
                SMTP Delivery Gateway
              </div>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {email.configured ? 'SMTP Gateway Ready' : 'SMTP Not Configured'}
              </p>
              <p className="mt-0.5 text-xs text-secondaryText">
                {email.configured ? 'Connect an email address to receive alerts' : 'Configure SMTP settings in backend/.env'}
              </p>
            </div>
          )}

          {/* Quick Metrics */}
          <dl className="mt-4 grid grid-cols-2 divide-x divide-foreground/10 rounded-xl border border-foreground/10 bg-foreground/[0.02] py-3">
            <div className="px-3 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondaryText">Delivery Status</dt>
              <dd className={`mt-1 text-xs font-semibold ${isEmailConnected ? 'text-accent' : isEmailPending ? 'text-amber-400' : 'text-foreground'}`}>
                {isEmailConnected ? 'Active' : isEmailPending ? 'Pending' : 'Inactive'}
              </dd>
            </div>
            <div className="px-3 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondaryText">Alert Channels</dt>
              <dd className={`mt-1 text-xs font-semibold ${isEmailConnected ? 'text-accent' : 'text-secondaryText'}`}>
                {isEmailConnected ? `${activeEmailCategoriesCount} Categories Active` : 'Connect first'}
              </dd>
            </div>
          </dl>

          {/* Feedback Banner */}
          {emailFeedback.message && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${emailFeedback.type === 'error'
                  ? 'border-danger/20 bg-danger/5 text-danger'
                  : emailFeedback.type === 'success'
                    ? 'border-accent/20 bg-accent/5 text-foreground'
                    : 'border-foreground/10 bg-foreground/[0.03] text-secondaryText'
                }`}
              role={emailFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {emailFeedback.type === 'error' ? (
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              ) : emailFeedback.type === 'success' ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              ) : null}
              <span>{emailFeedback.message}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-4">
            {/* Case A: Pending verification form */}
            {isEmailPending && !isEditingEmail && (
              <div className="space-y-3">
                <form onSubmit={handleVerifyEmail} className="flex gap-2">
                  <input
                    id="email-verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    disabled={Boolean(emailBusy)}
                    className="flex-1 rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2 text-center font-mono text-base tracking-widest text-foreground outline-none focus:border-accent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={verificationCode.length !== 6 || Boolean(emailBusy)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#072111] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {emailBusy === 'verify' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                    {emailBusy === 'verify' ? 'Verifying…' : 'Verify'}
                  </button>
                </form>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resendTimer > 0 || Boolean(emailBusy)}
                    className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-secondaryText disabled:no-underline"
                  >
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend verification code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditingEmail(true); setVerificationCode(''); }}
                    className="text-secondaryText hover:text-foreground"
                  >
                    Change email
                  </button>
                </div>
              </div>
            )}

            {/* Case B: Connect / Change Email Input */}
            {(!isEmailConnected && !isEmailPending) || isEditingEmail ? (
              <form onSubmit={handleConnectEmail} className="space-y-2">
                <label htmlFor="notification-email-input" className="block text-xs font-semibold uppercase tracking-wider text-secondaryText">
                  {isEditingEmail ? 'New Notification Email:' : 'Enter Notification Email:'}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="notification-email-input"
                    type="email"
                    required
                    placeholder="admin@example.com"
                    value={inputEmail}
                    onChange={e => setInputEmail(e.target.value)}
                    disabled={Boolean(emailBusy) || !email.configured}
                    className="flex-1 rounded-xl border border-foreground/15 bg-foreground/5 px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-secondaryText/60 focus:border-accent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!inputEmail.trim() || Boolean(emailBusy) || !email.configured}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#072111] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {emailBusy === 'connect' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                    {emailBusy === 'connect' ? 'Sending code…' : 'Connect Email'}
                  </button>
                </div>
                {isEditingEmail && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(false)}
                      className="text-xs text-secondaryText hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </form>
            ) : null}

            {/* Case C: Connected Actions */}
            {isEmailConnected && !isEditingEmail && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={Boolean(emailBusy)}
                  className="col-span-full inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#072111] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {emailBusy === 'test' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  {emailBusy === 'test' ? 'Sending Test…' : 'Send Test Notification'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  disabled={Boolean(emailBusy)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/35 focus-visible:outline-none disabled:opacity-55"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleDisconnectEmail}
                  disabled={Boolean(emailBusy)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm font-semibold text-secondaryText transition hover:bg-danger/5 hover:text-danger focus-visible:outline-none disabled:opacity-55"
                >
                  Disconnect
                </button>
              </div>
            )}

            {isEmailError && (
              <button
                type="button"
                onClick={handleRefreshEmailSettings}
                disabled={Boolean(emailBusy)}
                className="mt-2 w-full inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-55"
              >
                <RefreshCw size={15} className={emailBusy === 'refresh' ? 'animate-spin' : ''} aria-hidden="true" />
                Retry connection
              </button>
            )}
          </div>

          {/* Preferences Section (Independent Toggles) */}
          <div className="mt-5 space-y-3 border-t border-foreground/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondaryText">Notification Preferences</h3>

            {/* 1. Server Offline & Recovery Alerts */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Server Offline &amp; Recovery</p>
                <p className="text-xs text-secondaryText">Alerts when server heartbeats drop or restore</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Server offline and recovery email alerts"
                aria-checked={Boolean(isEmailConnected && email.notify_offline_email)}
                onClick={() => handleEmailPreferenceToggle('notify_offline_email')}
                disabled={!isEmailConnected || Boolean(emailBusy)}
                className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border p-1 text-[9px] font-extrabold tracking-wide transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${isEmailConnected && email.notify_offline_email
                    ? 'border-accent bg-accent text-[#062112]'
                    : 'border-foreground/15 bg-foreground/10 text-secondaryText'
                  }`}
              >
                <span
                  className={`absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out ${isEmailConnected && email.notify_offline_email ? 'left-[43px]' : 'left-1'
                    }`}
                  aria-hidden="true"
                />
                <span className={`absolute inset-y-0 flex items-center ${isEmailConnected && email.notify_offline_email ? 'left-2' : 'right-2'}`}>
                  {isEmailConnected && email.notify_offline_email ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* 2. Critical System Alerts */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Critical Resource Spikes</p>
                <p className="text-xs text-secondaryText">Alerts when CPU, RAM, or Disk exceeds threshold</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Critical resource spike email alerts"
                aria-checked={Boolean(isEmailConnected && email.notify_critical_email)}
                onClick={() => handleEmailPreferenceToggle('notify_critical_email')}
                disabled={!isEmailConnected || Boolean(emailBusy)}
                className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border p-1 text-[9px] font-extrabold tracking-wide transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${isEmailConnected && email.notify_critical_email
                    ? 'border-accent bg-accent text-[#062112]'
                    : 'border-foreground/15 bg-foreground/10 text-secondaryText'
                  }`}
              >
                <span
                  className={`absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out ${isEmailConnected && email.notify_critical_email ? 'left-[43px]' : 'left-1'
                    }`}
                  aria-hidden="true"
                />
                <span className={`absolute inset-y-0 flex items-center ${isEmailConnected && email.notify_critical_email ? 'left-2' : 'right-2'}`}>
                  {isEmailConnected && email.notify_critical_email ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* 3. Windows Laptop Unlock Alerts */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Windows Unlock Alerts</p>
                <p className="text-xs text-secondaryText">Security notice when a monitored PC session unlocks</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Windows laptop unlock email alerts"
                aria-checked={Boolean(isEmailConnected && email.notify_on_laptop_unlock)}
                onClick={() => handleEmailPreferenceToggle('notify_on_laptop_unlock')}
                disabled={!isEmailConnected || Boolean(emailBusy)}
                className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border p-1 text-[9px] font-extrabold tracking-wide transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${isEmailConnected && email.notify_on_laptop_unlock
                    ? 'border-accent bg-accent text-[#062112]'
                    : 'border-foreground/15 bg-foreground/10 text-secondaryText'
                  }`}
              >
                <span
                  className={`absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out ${isEmailConnected && email.notify_on_laptop_unlock ? 'left-[43px]' : 'left-1'
                    }`}
                  aria-hidden="true"
                />
                <span className={`absolute inset-y-0 flex items-center ${isEmailConnected && email.notify_on_laptop_unlock ? 'left-2' : 'right-2'}`}>
                  {isEmailConnected && email.notify_on_laptop_unlock ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 2. TELEGRAM NOTIFICATIONS CARD (PRESERVED) */}
        {/* ==================================================== */}
        <section
          className="w-full rounded-2xl border border-foreground/10 bg-card p-5 shadow-xl shadow-black/20 sm:p-6"
          aria-labelledby="telegram-card-title"
        >
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
              <Send size={24} aria-hidden="true" />
            </span>
            <h2 id="telegram-card-title" className="mt-3 text-lg font-semibold tracking-tight text-foreground">Telegram Notifications</h2>
            <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${telegramStatusError ? 'border-danger/25 bg-danger/10 text-danger' : telegramConnected ? 'border-accent/25 bg-accent/10 text-accent' : 'border-foreground/15 bg-foreground/5 text-secondaryText'}`} role="status">
              <span className={`h-1.5 w-1.5 rounded-full ${telegramStatusError ? 'bg-danger' : telegramConnected ? 'bg-accent' : 'bg-current'}`} aria-hidden="true" />
              {telegramLoading ? 'Checking status' : telegramStatusError ? 'Connection error' : telegramConnected ? 'Connected' : telegram.configured ? 'Not connected' : 'Not configured'}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-foreground/10 bg-surface/60 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-secondaryText">
              <Bot size={15} aria-hidden="true" />NodeBeacon Alerts
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
              {telegram.bot_info_available ? telegram.bot_name : telegramLoading ? 'Loading bot information…' : 'Bot information unavailable'}
            </p>
            {telegram.bot_info_available && <p className="mt-0.5 truncate font-mono text-xs text-secondaryText">@{telegram.bot_username}</p>}
          </div>

          <dl className="mt-4 grid grid-cols-2 divide-x divide-foreground/10 rounded-xl border border-foreground/10 bg-foreground/[0.02] py-3">
            <div className="px-3 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondaryText">Connection</dt>
              <dd className={`mt-1 text-xs font-semibold ${telegramConnected ? 'text-accent' : telegramStatusError ? 'text-danger' : 'text-foreground'}`}>
                {telegramStatusError ? 'Unavailable' : telegramConnected ? 'Verified' : 'Not connected'}
              </dd>
            </div>
            <div className="px-3 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondaryText">Unlock Alerts</dt>
              <dd className={`mt-1 text-xs font-semibold ${telegramConnected && telegram.notify_on_laptop_unlock_telegram ? 'text-accent' : 'text-secondaryText'}`}>
                {telegramConnected ? telegram.notify_on_laptop_unlock_telegram ? 'Enabled' : 'Disabled' : 'Connect first'}
              </dd>
            </div>
          </dl>

          {telegramStatusError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs leading-relaxed text-danger" role="alert">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>Unable to retrieve Telegram bot information. Retry the status check.</p>
            </div>
          )}

          {!telegram.configured && !telegramLoading && !telegramStatusError && (
            <p className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-xs leading-relaxed text-secondaryText">
              Telegram is not configured on the NodeBeacon backend. Ask the backend administrator to complete the integration setup.
            </p>
          )}

          {telegramFeedback.message && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${telegramFeedback.type === 'error'
                  ? 'border-danger/20 bg-danger/5 text-danger'
                  : telegramFeedback.type === 'success'
                    ? 'border-accent/20 bg-accent/5 text-foreground'
                    : 'border-foreground/10 bg-foreground/[0.03] text-secondaryText'
                }`}
              role={telegramFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {telegramFeedback.type === 'error' ? (
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              ) : telegramFeedback.type === 'success' ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              ) : null}
              <span>{telegramFeedback.message}</span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {telegramConnected && isTrustedTelegramUrl(telegram.bot_url) && (
              <a
                href={telegram.bot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ExternalLink size={16} aria-hidden="true" />Open Telegram
              </a>
            )}

            {telegramConnected && (
              <button
                type="button"
                onClick={handleTelegramTest}
                disabled={Boolean(telegramBusy)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#072111] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-55"
              >
                {telegramBusy === 'test' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {telegramBusy === 'test' ? 'Sending…' : 'Send Test Notification'}
              </button>
            )}

            {!telegramConnected && telegramLink && (
              <>
                <a
                  href={telegramLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ExternalLink size={16} aria-hidden="true" />Open Telegram
                </a>
                <button
                  type="button"
                  onClick={handleTelegramVerify}
                  disabled={Boolean(telegramBusy)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-55"
                >
                  {telegramBusy === 'verify' && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                  {telegramBusy === 'verify' ? 'Verifying…' : 'Verify Connection'}
                </button>
              </>
            )}

            {!telegramConnected && !telegramLink && (
              <button
                type="button"
                onClick={handleTelegramConnect}
                disabled={Boolean(telegramBusy) || telegramLoading || !telegram.configured}
                className="col-span-full inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#072111] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                {telegramBusy === 'connect' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {telegramBusy === 'connect' ? 'Creating secure link…' : 'Connect Telegram'}
              </button>
            )}

            {telegramStatusError && (
              <button
                type="button"
                onClick={handleTelegramRefresh}
                disabled={Boolean(telegramBusy)}
                className="col-span-full inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-55"
              >
                <RefreshCw size={15} className={telegramBusy === 'refresh' ? 'animate-spin' : ''} aria-hidden="true" />Retry status
              </button>
            )}

            {telegramConnected && (
              <button
                type="button"
                onClick={handleTelegramDisconnect}
                disabled={Boolean(telegramBusy)}
                className="col-span-full min-h-9 rounded-xl px-3 py-1.5 text-xs font-medium text-secondaryText transition hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-55"
              >
                Disconnect
              </button>
            )}
          </div>

          <div className="mt-4 border-t border-foreground/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Windows Unlock Alerts</h3>
              <button
                type="button"
                role="switch"
                aria-label="Windows unlock Telegram alerts"
                aria-checked={Boolean(telegramConnected && telegram.notify_on_laptop_unlock_telegram)}
                onClick={handleTelegramNotifyToggle}
                disabled={!telegramConnected || Boolean(telegramBusy)}
                className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border p-1 text-[9px] font-extrabold tracking-wide transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${telegramConnected && telegram.notify_on_laptop_unlock_telegram
                    ? 'border-accent bg-accent text-[#062112]'
                    : 'border-foreground/15 bg-foreground/10 text-secondaryText'
                  }`}
              >
                <span
                  className={`absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out motion-reduce:transition-none ${telegramConnected && telegram.notify_on_laptop_unlock_telegram ? 'left-[43px]' : 'left-1'
                    }`}
                  aria-hidden="true"
                />
                <span className={`absolute inset-y-0 flex items-center ${telegramConnected && telegram.notify_on_laptop_unlock_telegram ? 'left-2' : 'right-2'}`}>
                  {telegramConnected && telegram.notify_on_laptop_unlock_telegram ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
            <p className={`mt-1.5 text-xs ${telegramConnected && telegram.notify_on_laptop_unlock_telegram ? 'text-accent' : 'text-secondaryText'}`}>
              {telegramConnected && telegram.notify_on_laptop_unlock_telegram
                ? 'Notify me when this Windows device is unlocked.'
                : telegramConnected ? 'Unlock notifications are disabled.' : 'Connect Telegram to enable unlock alerts.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
