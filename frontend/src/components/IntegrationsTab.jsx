import React, { useState } from 'react';
import { Blocks, MessageCircle, MessageSquare, Send, Mail, Link2, AlertTriangle, BarChart3, Check } from 'lucide-react';

import { motion } from 'framer-motion';

export default function IntegrationsTab() {
  const [connected, setConnected] = useState({
    slack: false,
    webhook: false
  });

  const integrations = [
    {
      id: 'slack',
      name: 'Slack Alerts',
      icon: MessageCircle,
      color: '#4A154B',

      description: 'Stream server outage logs and warnings directly to your slack channels.',
      status: connected.slack ? 'Connected' : 'Configure',
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
      id: 'discord',
      name: 'Discord Webhook',
      icon: MessageSquare,
      color: '#5865F2',
      description: 'Publish critical host heartbeats directly inside your Discord servers.',
      status: 'Coming Soon',
      available: false
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      icon: Send,
      color: '#6264A7',
      description: 'Configure incoming webhook connections for Teams notification chats.',
      status: 'Coming Soon',
      available: false
    },
    {
      id: 'email',
      name: 'Email Alerts',
      icon: Mail,
      color: '#EA4335',
      description: 'Receive immediate email reports and incident recovery summaries.',
      status: 'Coming Soon',
      available: false
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty',
      icon: AlertTriangle,
      color: '#06AC38',
      description: 'Integrate dynamic escalation triggers and phone paging checks.',
      status: 'Coming Soon',
      available: false
    },
    {
      id: 'grafana',
      name: 'Grafana Integration',
      icon: BarChart3,
      color: '#F47A20',
      description: 'Publish aggregate host metrics payloads directly to Grafana Cloud.',
      status: 'Coming Soon',
      available: false
    }
  ];

  const handleToggleConnect = (id) => {
    setConnected(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#050505] text-white">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
          Integrations
        </h1>
        <p className="text-secondaryText text-xs font-medium mt-1">
          Connect your infrastructure dashboard alert pipeline to external channels.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((item) => {
          const Icon = item.icon;
          const isConnected = connected[item.id];
          return (
            <div 
              key={item.id}
              className={`glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6 relative overflow-hidden transition-all duration-300 ${
                item.available ? 'hover:border-white/10' : 'opacity-60'
              }`}
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
                      {item.available ? 'Alert channel' : 'Planned plugin'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-secondaryText leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Action Button */}
              <div>
                {item.available ? (
                  <button
                    onClick={() => handleToggleConnect(item.id)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase font-mono tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isConnected 
                        ? 'bg-accent/10 border border-accent/20 text-accent hover:border-accent/40' 
                        : 'bg-white/5 border border-white/5 hover:border-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.02)]'
                    }`}
                  >
                    {isConnected && <Check className="w-3.5 h-3.5" />}
                    <span>{isConnected ? 'Connected' : 'Configure'}</span>
                  </button>
                ) : (
                  <span className="w-full block py-2.5 rounded-xl border border-white/5 bg-white/[0.01] text-secondaryText font-bold text-xs uppercase font-mono tracking-wider text-center">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
