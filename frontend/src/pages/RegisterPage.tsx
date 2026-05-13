import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { analytics } from '../services/analytics';

// Phase 1b: public signup is disabled. This page is now an access-request
// form — visitors leave their name + email (+ optional phone) and the
// super-admin provisions a real account from the CRM.
//
// The community links below are placeholders; replace the URLs with the
// real WhatsApp / Telegram / Discord invites when you have them.
const COMMUNITY_LINKS = [
  {
    label: 'Join us on WhatsApp',
    href: 'https://chat.whatsapp.com/REPLACE_WITH_REAL_INVITE',
    icon: '💬',
  },
  {
    label: 'Join us on Telegram',
    href: 'https://t.me/REPLACE_WITH_REAL_INVITE',
    icon: '✈️',
  },
  {
    label: 'Join us on Discord',
    href: 'https://discord.gg/REPLACE_WITH_REAL_INVITE',
    icon: '🎮',
  },
];

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    analytics.trackPageView({ page_name: 'Request Access Page' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('submitting');
    setErrorMessage('');
    try {
      await api.post('/leads', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        source: 'login_page',
      });
      setState('success');
    } catch (err: any) {
      setState('error');
      setErrorMessage(
        err?.response?.data?.message ||
          'Something went wrong. Please try again or reach out via the community links below.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">Request access</h2>
          <p className="mt-2 text-sm text-gray-600">
            We&apos;re running an invite-only beta. Drop your details and we&apos;ll reach out — usually within
            a day. Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            {state === 'success' ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✓</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Request received</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Thanks{name ? `, ${name.split(' ')[0]}` : ''}. We&apos;ll be in touch at <strong>{email}</strong>.
                  Meanwhile, you can join the community below.
                </p>
                <Link
                  to="/login"
                  className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMessage && (
                  <div
                    className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm"
                    role="alert"
                  >
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label htmlFor="req-name" className="block text-sm font-medium text-gray-700">
                    Full name
                  </label>
                  <input
                    id="req-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="req-email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="req-email"
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="req-phone" className="block text-sm font-medium text-gray-700">
                    Phone <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="req-phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {state === 'submitting' ? 'Sending…' : 'Request access'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-center text-sm text-gray-600 mb-4">Or join the community while you wait</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {COMMUNITY_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
              >
                <span aria-hidden>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          GMAT and GMAT Focus are registered trademarks of the Graduate Management Admission Council
          (GMAC). This product is not affiliated with, endorsed by, or sponsored by GMAC.
        </p>
      </div>
    </div>
  );
};
