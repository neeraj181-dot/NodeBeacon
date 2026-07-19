import React, { useState } from 'react';
import { useServers } from '../contexts/ServerContext';
import { Server, Plus, Edit2, Trash2, Eye, Terminal, X, Copy, Check, Download, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


export default function ServersTab({ onViewServer }) {
  const { servers, loading, error, addServer, editServer, removeServer } = useServers();
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  
  // Form states
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [os, setOs] = useState('Ubuntu 24.04');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedServer, setSelectedServer] = useState(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState('');

  // Filtered servers
  const filteredServers = servers.filter(server => 
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.ip_address.includes(searchQuery)
  );

  React.useEffect(() => {
    const handleOpenModal = () => {
      openAddModal();
    };
    window.addEventListener('open_add_server_modal', handleOpenModal);
    return () => {
      window.removeEventListener('open_add_server_modal', handleOpenModal);
    };
  }, []);

  const handleCopyKey = () => {

    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const result = await addServer({
        name,
        hostname,
        operating_system: os,
        ip_address: ipAddress
      });
      setGeneratedKey(result.api_key);
      // Don't close modal yet so the user can copy the API Key!
    } catch (err) {
      setFormError(err.message || 'Validation failed. Please verify inputs.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await editServer(selectedServer.id, {
        name,
        hostname,
        operating_system: os,
        ip_address: ipAddress
      });
      setIsEditModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err.message || 'Update failed.');
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      await removeServer(selectedServer.id);
      setIsDeleteModalOpen(false);
      resetForm();
    } catch (err) {
      alert('Delete failed.');
    }
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (server) => {
    setSelectedServer(server);
    setName(server.name);
    setHostname(server.hostname);
    setOs(server.operating_system);
    setIpAddress(server.ip_address);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (server) => {
    setSelectedServer(server);
    setIsDeleteModalOpen(true);
  };

  const resetForm = () => {
    setName('');
    setHostname('');
    setOs('Ubuntu 24.04');
    setIpAddress('');
    setSelectedServer(null);
    setGeneratedKey('');
    setCopied(false);
    setFormError('');
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background text-white select-none">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-mono uppercase">
            Servers Fleet
          </h1>
          <p className="text-secondaryText text-sm mt-1">
            Register and monitor your Unix or Windows server nodes.
          </p>
        </div>
        <div className="flex gap-3">

          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-hover border border-white/5 text-white font-bold text-xs uppercase tracking-wider font-mono hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-accent" />
            <span>Download Agent</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase tracking-wider font-mono hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Node</span>
          </button>
        </div>
      </div>


      {/* Search Fleet */}
      <div className="bg-card border border-white/5 p-4 rounded-xl flex items-center justify-between">
        <input
          type="text"
          placeholder="Search by name, hostname, or IP address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-surface/50 border border-white/5 rounded-lg px-4 py-2 text-xs font-mono text-white placeholder-secondaryText w-full max-w-md focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
        />
        <div className="text-[10px] font-mono text-secondaryText uppercase tracking-wider">
          Found {filteredServers.length} servers
        </div>
      </div>

      {/* Grid showing Servers fleet */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredServers.map((server) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              key={server.id}
              className="bg-card border border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-[210px] group shadow-lg"
            >
              {/* Status Indicator */}
              <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none">
                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${
                  server.status === 'Online' ? 'bg-accent animate-pulse' : 'bg-danger'
                }`} />
              </div>

              {/* Server Metadata */}
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-hover rounded border border-white/5">
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono truncate max-w-[170px] uppercase">
                      {server.name}
                    </h3>
                    <span className="text-[10px] text-secondaryText block truncate max-w-[170px] font-mono">
                      {server.hostname}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-4 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-[9px] text-secondaryText uppercase tracking-wider font-semibold block">OS</span>
                    <span className="text-xs font-medium text-white truncate block">{server.operating_system}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-secondaryText uppercase tracking-wider font-semibold block">IP Address</span>
                    <span className="text-xs font-mono text-white truncate block">{server.ip_address}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-secondaryText uppercase tracking-wider font-semibold block">Status</span>
                    <span className={`text-[10px] font-bold uppercase ${
                      server.status === 'Online' ? 'text-accent' : 'text-danger'
                    }`}>
                      {server.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-secondaryText uppercase tracking-wider font-semibold block">Last Heartbeat</span>
                    <span className="text-xs font-mono text-white block">{formatLastSeen(server.last_seen)}</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-4">
                <button
                  onClick={() => onViewServer(server.id)}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-accent hover:underline uppercase cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(server)}
                    className="p-1.5 bg-hover rounded-lg border border-white/5 text-secondaryText hover:text-white transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(server)}
                    className="p-1.5 bg-hover rounded-lg border border-white/5 text-secondaryText hover:text-danger transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredServers.length === 0 && !loading && (
        <div className="bg-card border border-white/5 p-12 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
          <Terminal className="w-8 h-8 text-secondaryText" />
          <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white">No server nodes found</h3>
          <p className="text-xs text-secondaryText leading-relaxed">
            There are no servers matching "{searchQuery}" registered in your fleet. Add a new server node to deploy monitoring agents.
          </p>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-[#070707] font-bold text-xs uppercase tracking-wider font-mono hover:scale-105 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Node</span>
          </button>
        </div>
      )}

      {/* ADD SERVER MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 p-8 rounded-[24px] w-full max-w-lg space-y-6 relative overflow-hidden"
            >
              <button
                onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                className="absolute top-6 right-6 text-secondaryText hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold font-mono text-white uppercase tracking-wider">
                  Register Server Node
                </h3>
                <p className="text-xs text-secondaryText">
                  Define your server details to register and generate a monitoring API Key.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-danger/5 border border-danger/25 text-danger rounded-xl text-xs font-medium font-sans">
                  {formError}
                </div>
              )}

              {generatedKey ? (
                /* Success key generated view */
                <div className="space-y-4">
                  <div className="p-4 bg-accent/5 border border-accent/25 rounded-xl space-y-2">
                    <span className="text-[10px] text-accent font-bold uppercase tracking-wider">Server API Key Generated</span>
                    <p className="text-[11px] text-secondaryText leading-relaxed">
                      Copy this secure key now. You will need it to configure the standalone Python agent. It will not be shown again.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-surface border border-white/5 p-3 rounded-lg font-mono text-xs text-white">
                    <span className="flex-1 truncate">{generatedKey}</span>
                    <button
                      onClick={handleCopyKey}
                      className="p-1.5 bg-hover rounded border border-white/10 hover:text-accent transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <span className="text-[9px] text-secondaryText uppercase tracking-wider font-semibold block">Deploy Agent Command</span>
                    <div className="bg-surface p-3 rounded-lg font-mono text-[10px] text-white overflow-x-auto leading-relaxed border border-white/5">
                      python main.py
                    </div>
                  </div>

                  <button
                    onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                    className="w-full py-2.5 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase tracking-wider font-mono hover:opacity-90 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Input form view */
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Node Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. prod-api-01"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Hostname</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. api-server.net"
                      value={hostname}
                      onChange={(e) => setHostname(e.target.value)}
                      className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Operating System</label>
                      <select
                        value={os}
                        onChange={(e) => setOs(e.target.value)}
                        className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                      >
                        <option value="Ubuntu 24.04">Ubuntu 24.04</option>
                        <option value="Debian 12">Debian 12</option>
                        <option value="CentOS Stream 9">CentOS Stream 9</option>
                        <option value="Windows Server 2022">Windows Server 2022</option>
                        <option value="macOS Sequoia">macOS Sequoia</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">IP Address</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 192.168.1.10"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase tracking-wider font-mono hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer mt-2"
                  >
                    Create Node
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT SERVER MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 p-8 rounded-[24px] w-full max-w-lg space-y-6 relative"
            >
              <button
                onClick={() => { setIsEditModalOpen(false); resetForm(); }}
                className="absolute top-6 right-6 text-secondaryText hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold font-mono text-white uppercase tracking-wider">
                  Update Server Config
                </h3>
                <p className="text-xs text-secondaryText">
                  Modify the node network configurations for {selectedServer?.name}.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-danger/5 border border-danger/25 text-danger rounded-xl text-xs font-medium font-sans">
                  {formError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Node Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. prod-api-01"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. api-server.net"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">Operating System</label>
                    <select
                      value={os}
                      onChange={(e) => setOs(e.target.value)}
                      className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                    >
                      <option value="Ubuntu 24.04">Ubuntu 24.04</option>
                      <option value="Debian 12">Debian 12</option>
                      <option value="CentOS Stream 9">CentOS Stream 9</option>
                      <option value="Windows Server 2022">Windows Server 2022</option>
                      <option value="macOS Sequoia">macOS Sequoia</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-secondaryText font-mono uppercase tracking-wider">IP Address</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.1.10"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      className="w-full bg-surface border border-white/5 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-accent text-[#070707] font-bold text-xs uppercase tracking-wider font-mono hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer mt-2"
                >
                  Save Configuration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE SERVER MODAL */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 p-6 rounded-[20px] w-full max-w-sm space-y-6 relative"
            >
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 bg-danger/10 text-danger border border-danger/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-md font-bold font-mono text-white uppercase tracking-wider">
                  Delete server node?
                </h3>
                <p className="text-xs text-secondaryText leading-relaxed">
                  This action is irreversible. Node <strong>{selectedServer?.name}</strong> and all historical metrics will be removed from your profile.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setIsDeleteModalOpen(false); resetForm(); }}
                  className="flex-1 py-2 rounded-xl bg-hover border border-white/5 text-white font-mono text-xs uppercase tracking-wider font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSubmit}
                  className="flex-1 py-2 rounded-xl bg-danger text-white font-mono text-xs uppercase tracking-wider font-bold hover:opacity-90 cursor-pointer shadow-[0_0_15px_rgba(255,95,87,0.2)]"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOWNLOAD AGENT MODAL */}
      <AnimatePresence>
        {isDownloadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 p-8 rounded-[24px] w-full max-w-lg space-y-6 relative overflow-hidden"
            >
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="absolute top-6 right-6 text-secondaryText hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                  <Download className="w-5 h-5 text-accent" />
                  <span>Agent Deployment Guide</span>
                </h3>
                <p className="text-xs text-secondaryText font-medium">
                  Follow these simple steps to install the monitoring agent on Windows.
                </p>
              </div>

              {/* Steps list */}
              <div className="space-y-3.5 pt-2">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">1</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Create Server Node</h4>
                    <p className="text-[11px] text-secondaryText">Click "Add Node" on the dashboard to register your server details.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">2</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Copy API Key</h4>
                    <p className="text-[11px] text-secondaryText">Copy the secure, unique API Key generated for your server.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">3</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Download Installer</h4>
                    <p className="text-[11px] text-secondaryText">Click the button below to download the compiled NodeBeaconAgent.exe installer.</p>

                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">4</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Run Installer</h4>
                    <p className="text-[11px] text-secondaryText">Run the downloaded setup executable, approving the Windows administrator prompt.</p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">5</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Paste Key & Install</h4>
                    <p className="text-[11px] text-secondaryText">Paste your API Key, configure interval settings, and click "Install".</p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded bg-accent/15 border border-accent/25 text-accent font-bold font-mono text-[10px] flex items-center justify-center shrink-0">6</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Starts Monitoring</h4>
                    <p className="text-[11px] text-secondaryText">The agent installs as a Windows service and immediately begins publishing system metrics.</p>
                  </div>
                </div>
              </div>

              {/* Download CTA Button */}
              <div className="pt-2 border-t border-white/5">
                <a
                  href="http://127.0.0.1:8000/api/agent/download/"
                  download
                  className="w-full h-11 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] text-center"
                >
                  <Download className="w-4 h-4 text-[#070707]" />
                  <span>Download Windows Installer (EXE)</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

