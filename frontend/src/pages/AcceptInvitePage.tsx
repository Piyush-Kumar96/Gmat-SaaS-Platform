import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { acceptInvite, InvitePreview, previewInvite } from '../services/account';

type State = 'loading' | 'invalid' | 'ready' | 'submitting' | 'done' | 'error';

const AcceptInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [state, setState] = useState<State>('loading');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMsg('No invite token in the URL.');
      return;
    }
    void (async () => {
      try {
        const p = await previewInvite(token);
        setPreview(p);
        setState('ready');
      } catch (e: any) {
        setState('invalid');
        setErrorMsg(e?.response?.data?.message || 'This invite link is no longer valid.');
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setErrorMsg('Full name is required.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setState('submitting');
    setErrorMsg('');
    try {
      const { token: jwt } = await acceptInvite(token, { fullName: fullName.trim(), password });
      localStorage.setItem('token', jwt);
      setState('done');
      // Hard reload so AuthContext picks up the new token + user.
      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (e: any) {
      setState('error');
      setErrorMsg(e?.response?.data?.message || 'Failed to accept invite. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Accept invite</h1>

        {state === 'loading' && (
          <div className="text-center text-gray-500 py-8">Checking invite…</div>
        )}

        {state === 'invalid' && (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-red-600 mb-4">{errorMsg || 'Invite is not valid.'}</p>
            <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Go to sign in
            </Link>
          </div>
        )}

        {(state === 'ready' || state === 'submitting' || state === 'error') && preview && (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-4">
              You&apos;ve been invited to join{' '}
              <strong className="text-gray-900">{preview.account?.name || 'a workspace'}</strong>
              {' '}as a <strong>{preview.accountRole}</strong>.
            </p>
            <p className="text-xs text-gray-500 mb-6">Email: {preview.email}</p>

            {errorMsg && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-4">{errorMsg}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="At least 6 characters"
                />
              </div>
              <button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {state === 'submitting' ? 'Joining…' : 'Join workspace'}
              </button>
            </form>
          </div>
        )}

        {state === 'done' && (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-gray-700">Welcome aboard. Loading your workspace…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitePage;
