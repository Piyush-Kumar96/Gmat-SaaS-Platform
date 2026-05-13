import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AccountInfo,
  AccountInvite,
  AccountMember,
  changeMemberRole,
  getAccount,
  inviteMember,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  updateAccount,
} from '../services/account';

const AccountPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [accountRole, setAccountRole] = useState<string>('');
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [latestInvite, setLatestInvite] = useState<AccountInvite | null>(null);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isOwner = accountRole === 'owner';
  const isOwnerOrAdmin = isOwner || accountRole === 'admin';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { account: acc, accountRole: role } = await getAccount();
      setAccount(acc);
      setAccountRole(role);
      setNameInput(acc.name);
      // Members + invites only loadable by owner/admin.
      if (role === 'owner' || role === 'admin') {
        const [m, i] = await Promise.all([listMembers(), listInvites()]);
        setMembers(m);
        setInvites(i);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    if (nameInput.trim().length < 2) return;
    try {
      const updated = await updateAccount({ name: nameInput.trim() });
      setAccount(updated);
      setEditingName(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save.');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSubmitting(true);
    try {
      const inv = await inviteMember({ email: inviteEmail.trim(), accountRole: inviteRole });
      setLatestInvite(inv);
      setInviteEmail('');
      const refreshed = await listInvites();
      setInvites(refreshed);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to create invite.');
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!window.confirm('Revoke this invite? The link will stop working.')) return;
    try {
      await revokeInvite(inviteId);
      const refreshed = await listInvites();
      setInvites(refreshed);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to revoke.');
    }
  }

  async function handleRemoveMember(member: AccountMember) {
    if (!window.confirm(`Remove ${member.fullName || member.email} from this account?`)) return;
    try {
      await removeMember(member._id);
      setMembers((prev) => prev.filter((m) => m._id !== member._id));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to remove.');
    }
  }

  async function handleRoleChange(member: AccountMember, newRole: 'admin' | 'member') {
    try {
      await changeMemberRole(member._id, newRole);
      setMembers((prev) => prev.map((m) => (m._id === member._id ? { ...m, accountRole: newRole } : m)));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to change role.');
    }
  }

  async function copyLink(link: string, token: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 1500);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }

  if (!user) return null;
  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-gray-500">Loading account…</div>;
  }
  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }
  if (!account) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Account</h1>
      <p className="text-sm text-gray-600 mb-6">
        {account.type === 'business' ? 'Business workspace' : 'Personal workspace'} — your role:{' '}
        <span className="font-medium text-gray-900">{accountRole}</span>
      </p>

      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <button onClick={saveName} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                  Save
                </button>
                <button onClick={() => { setEditingName(false); setNameInput(account.name); }} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-gray-900">{account.name}</span>
                {isOwner && (
                  <button onClick={() => setEditingName(true)} className="text-sm text-indigo-600 hover:text-indigo-500">
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <span className="text-gray-900 capitalize">{account.type}</span>
          </div>
          {account.type === 'business' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Members</label>
                <span className="text-gray-900">{members.length}{account.maxMembers ? ` / ${account.maxMembers}` : ''}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className="text-gray-900 capitalize">{account.businessStatus || '—'}</span>
              </div>
            </>
          )}
        </div>
      </section>

      {isOwnerOrAdmin && account.type === 'business' && (
        <>
          <section className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite a member</h2>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="member">Member (read-only)</option>
                <option value="admin">Admin (manages content + members)</option>
              </select>
              <button
                type="submit"
                disabled={inviteSubmitting}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {inviteSubmitting ? 'Creating…' : 'Create invite'}
              </button>
            </form>

            {latestInvite && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-900 mb-2">
                  Invite created for <strong>{latestInvite.email}</strong>. Copy and share this link via WhatsApp / email:
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={latestInvite.link}
                    className="flex-1 border border-green-300 rounded-md px-3 py-2 text-xs font-mono bg-white"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(latestInvite.link, latestInvite.token)}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                  >
                    {copiedToken === latestInvite.token ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending invites</h2>
            {invites.length === 0 ? (
              <p className="text-sm text-gray-500">No pending invites.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invites.map((inv) => (
                      <tr key={inv._id}>
                        <td className="px-3 py-2 text-sm text-gray-900">{inv.email}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{inv.accountRole}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-sm text-right space-x-3">
                          <button
                            onClick={() => copyLink(inv.link, inv.token)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            {copiedToken === inv.token ? 'Copied!' : 'Copy link'}
                          </button>
                          <button onClick={() => handleRevoke(inv._id)} className="text-red-600 hover:text-red-900 font-medium">
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    {isOwner && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.map((m) => {
                    const isSelf = m._id === user._id;
                    return (
                      <tr key={m._id}>
                        <td className="px-3 py-2 text-sm text-gray-900">{m.fullName}{isSelf ? <span className="text-gray-400 ml-2">(you)</span> : null}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{m.email}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {isOwner && !isSelf && m.accountRole !== 'owner' ? (
                            <select
                              value={m.accountRole}
                              onChange={(e) => handleRoleChange(m, e.target.value as 'admin' | 'member')}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            <span className="capitalize">{m.accountRole}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">{new Date(m.createdAt).toLocaleDateString()}</td>
                        {isOwner && (
                          <td className="px-3 py-2 text-sm text-right">
                            {!isSelf && m.accountRole !== 'owner' && (
                              <button onClick={() => handleRemoveMember(m)} className="text-red-600 hover:text-red-900 font-medium">
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {!isOwnerOrAdmin && (
        <p className="text-sm text-gray-500">
          You're a member of this account. Account management is available to owners and admins only.
        </p>
      )}
    </div>
  );
};

export default AccountPage;
