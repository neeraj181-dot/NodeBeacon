import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMembers, inviteMember, updateMemberRole, removeMember } from '../api/auth';
import { UserMinus, UserPlus, UserCheck, Shield, Eye, HelpCircle } from 'lucide-react';

export default function MembersTab() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviting(true);
    try {
      await inviteMember(inviteUsername, inviteEmail, inviteRole);
      setSuccess('Member invited successfully! Default password is: NodeBeaconInvitedTemp123!');
      setInviteUsername('');
      setInviteEmail('');
      setInviteRole('VIEWER');
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite member.');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await updateMemberRole(id, newRole);
      fetchMembers();
    } catch (err) {
      alert("Failed to update role.");
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await removeMember(id);
      fetchMembers();
    } catch (err) {
      alert("Failed to remove member.");
    }
  };

  const isAdmin = user?.role === 'ORGANIZATION_ADMIN';

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#050505] text-white">
      <div className="border-b border-white/5 pb-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
          Team Management
        </h1>
        <p className="text-secondaryText text-sm mt-1">
          Manage member permissions, assignments, and authorization roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left List of Members */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Active Organization Members ({members.length})
            </h3>

            {loading ? (
              <div className="text-xs text-secondaryText font-mono">Loading team roster...</div>
            ) : (
              <div className="divide-y divide-white/5">
                {members.map((m) => (
                  <div key={m.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold font-mono text-accent text-xs">
                        {m.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          {m.first_name || m.last_name ? `${m.first_name} ${m.last_name}`.trim() : m.username}
                        </span>
                        <span className="text-[10px] text-secondaryText block font-mono">{m.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Role selection badge */}
                      {isAdmin && m.id !== user.id ? (
                        <select
                          value={m.member_role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="bg-[#101010] border border-white/10 rounded-lg px-2.5 py-1 text-[10px] font-mono text-white focus:outline-none"
                        >
                          <option value="ADMINISTRATOR">Administrator</option>
                          <option value="OPERATOR">Operator</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-[9px] font-mono text-secondaryText uppercase tracking-wider rounded-md">
                          {m.member_role}
                        </span>
                      )}

                      {isAdmin && m.id !== user.id && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-secondaryText hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-colors"
                          title="Remove Member"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invite Member Section */}
        {isAdmin && (
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Invite Member
            </h3>

            {error && (
              <div className="p-3 bg-danger/5 border border-danger/25 text-danger rounded-xl text-xs font-mono">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-accent/5 border border-accent/25 text-accent rounded-xl text-xs font-mono">
                {success}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Username</label>
                <input
                  type="text"
                  required
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                >
                  <option value="ADMINISTRATOR">Administrator</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full h-10 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{inviting ? 'Inviting...' : 'Send Invitation'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
