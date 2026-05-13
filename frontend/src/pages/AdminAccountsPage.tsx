import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AdminAccountListItem,
  CreateBusinessAccountResult,
  createBusinessAccount,
  listAdminAccounts,
} from '../services/adminAccounts';

const AdminAccountsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<AdminAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [maxMembers, setMaxMembers] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateBusinessAccountResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminAccounts();
      setAccounts(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    try {
      const result = await createBusinessAccount({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : undefined,
      });
      setCreateResult(result);
      setName('');
      setOwnerEmail('');
      setMaxMembers('');
      void load();
    } catch (e: any) {
      setCreateError(e?.response?.data?.message || 'Failed to create.');
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }

  if (!user || user.role !== 'admin') return null;

  const businessAccounts = accounts.filter((a) => a.type === 'business');
  const individualAccounts = accounts.filter((a) => a.type === 'individual');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts CRM</h1>
          <p className="text-sm text-gray-600 mt-1">
            All tenants on the platform. {businessAccounts.length} business · {individualAccounts.length} individual.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate((s) => !s); setCreateResult(null); setCreateError(null); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          {showCreate ? 'Close' : '+ New business account'}
        </button>
      </div>

      {showCreate && (
        <section className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create business account</h2>
          {createError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-3">{createError}</div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Account name (e.g., Acme Prep)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Owner email"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="Seat cap (optional)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create + generate invite'}
              </button>
            </div>
          </form>

          {createResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-900 mb-2">
                <strong>{createResult.account.name}</strong> created. Send this invite link to{' '}
                <strong>{createResult.invite.email}</strong>:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={createResult.invite.link}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 border border-green-300 rounded-md px-3 py-2 text-xs font-mono bg-white"
                />
                <button
                  type="button"
                  onClick={() => copyLink(createResult.invite.link)}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-green-800 mt-2">
                Expires {new Date(createResult.invite.expiresAt).toLocaleDateString()}. The recipient becomes the account owner on accept.
              </p>
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 text-gray-600">
          No accounts yet.
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Members</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Questions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.map((a) => (
                <tr key={a._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        a.type === 'business' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{a.businessStatus || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {a.memberCount}
                    {a.maxMembers ? <span className="text-gray-400"> / {a.maxMembers}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{a.questionCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPage;
