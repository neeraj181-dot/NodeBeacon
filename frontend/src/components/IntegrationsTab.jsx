import React, { useState, useEffect } from 'react';
import { Blocks, MessageCircle, MessageSquare, Send, Mail, Link2, AlertTriangle, BarChart3, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, sendTestEmail } from '../api/auth';
import { motion } from 'framer-motion';

export default function IntegrationsTab() {
  const { user } = useAuth();
  const [testingEmail, setTestingEmail] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [connected, setConnected] = useState({
    slack: false,
    webhook: false,
    email: false
  });

  // Sync state from dynamic user record
  useEffect(() => {
    if (user) {
      setConnected(prev => ({
        ...prev,
        email: !!user.enable_email_notifications
      }));
    }
  }, [user]);

  const integrations = [
    {
      id: 'email',
      name: 'Email Alerts',
      icon: Mail,
      color: '#EA4335',
      description: 'Receive immediate email reports and incident recovery summaries.',
      status: connected.email ? 'Connected' : 'Configure',
      available: true
    },
    {
      id: 'webhook',
      name: 'Generic Webhooks',
      icon: Link2,
      color: '#57E389',
      description: 'POST structured JSON incident payloads to custom HTTP endpoints.',
      status: connected.webhook ? 'Connected' : 'Configure',
      available: true
    },
    {
      id: 'slack',
      name: 'Slack Alerts',
      icon: MessageCircle,
      color: '#4A154B',
      description: 'Stream server outage logs and warnings directly to your slack channels.',
      status: connected.slack ? 'Connected' : 'Configure',
      available: true
    }
  ];

  const handleToggleConnect = async (id) => {
    if (id === 'email') {
      const nextVal = !connected.email;
      try {
        await updateProfile({ enable_email_notifications: nextVal });
        setConnected(prev => ({ ...prev, email: nextVal }));
      } catch (err) {
        console.error('Failed to update email alerts integration state', err);
        alert('Failed to configure email alerts integration.');
      }
    } else {
      setConnected(prev => ({
        ...prev,
        [id]: !prev[id]
      }));
    }
  };

  const handleSendTest = async () => {
    setTestingEmail(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await sendTestEmail();
      setFeedback({ type: 'success', message: res.message || 'Test email sent successfully!' });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'SMTP Configuration check failed. Please confirm environment credentials.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setTestingEmail(false);
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#050505] text-white relative">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
          Integrations
        </h1>
        <p className="text-secondaryText text-xs font-medium mt-1">
          Connect your infrastructure dashboard alert pipeline to external channels.
        </p>
      </div>

      {/* Floating top-right success toast */}
      {feedback.message && feedback.type === 'success' && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl text-xs font-mono bg-[#10381F] border border-[#2ECC71] text-[#2ECC71] shadow-[0_0_20px_rgba(46,204,113,0.25)] flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((item) => {
          const Icon = item.icon;
          const isConnected = connected[item.id];
          return (
            <div 
              key={item.id}
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-72 relative overflow-hidden transition-all duration-300 hover:border-white/10"
            >
              <div className="space-y-4">
                {/* Logo & Header */}
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/5"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">{item.name}</h3>
                    <span className="text-[9px] font-mono text-secondaryText uppercase tracking-wider block mt-0.5">
                      Alert channel
                    </span>
                  </div>
                </div>

                <p className="text-xs text-secondaryText leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 flex flex-col justify-end">
                {item.id === 'email' && isConnected && (
                  <button
                    onClick={handleSendTest}
                    disabled={testingEmail}
                    className="w-full h-10 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-white font-bold text-[11px] uppercase font-mono tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testingEmail && (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    <span>{testingEmail ? 'Sending...' : 'Send Test Email'}</span>
                  </button>
                )}
                
                {item.id === 'email' ? (
                  <button
                    onClick={() => handleToggleConnect(item.id)}
                    className={`w-full h-11 rounded-xl font-bold text-xs uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isConnected 
                        ? feedback.type === 'error'
                          ? 'bg-rose-950/40 border border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                          : 'bg-[#10381F] border border-[#2ECC71] text-[#2ECC71] shadow-[0_0_15px_rgba(46,204,113,0.15)]' 
                        : 'bg-white/5 border border-white/5 hover:border-white/10 text-secondaryText'
                    }`}
                  >
                    {isConnected ? (
                      feedback.type === 'error' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          <span>● Connection Failed</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-[#2ECC71]" />
                          <span>Connected</span>
                        </>
                      )
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-secondaryText" />
                        <span>○ Not Connected</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleConnect(item.id)}
                    className={`w-full h-11 rounded-xl font-bold text-xs uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isConnected 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40' 
                        : 'bg-white/5 border border-white/5 hover:border-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.02)]'
                    }`}
                  >
                    {isConnected && <Check className="w-3.5 h-3.5" />}
                    <span>{isConnected ? '✓ Connected' : 'Configure'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
