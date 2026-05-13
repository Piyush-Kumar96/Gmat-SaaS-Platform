import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { analytics } from '../services/analytics';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isAdmin } = useRoleAccess();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Function to check if a path is active
  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    
    // Special case for Quiz section - highlight for both /quiz and /config paths
    if (path === '/quiz') {
      return location.pathname.startsWith('/quiz') || location.pathname.startsWith('/config');
    }
    
    return location.pathname.startsWith(path);
  };
  
  // Get the CSS classes for a nav link based on active state
  const getLinkClasses = (path: string): string => {
    // whitespace-nowrap: keeps multi-word labels ("My Quizzes", "DI Bank")
    // on a single line as the row tightens.
    const baseClasses = "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap";
    
    // Special case for Import page - use green color scheme
    if (path === '/import' && isActive(path)) {
      return `${baseClasses} border-green-500 text-green-700 font-semibold`;
    }
    
    // Special case for Quiz page - use blue color scheme from homepage
    if (path === '/quiz' && isActive(path)) {
      return `${baseClasses} border-blue-500 text-blue-700 font-semibold`;
    }
    
    // Special case for Admin page - use red color scheme
    if (path === '/admin' && isActive(path)) {
      return `${baseClasses} border-red-500 text-red-700 font-semibold`;
    }

    // Special case for DI Question Bank - use purple color scheme
    if (path === '/review-di' && isActive(path)) {
      return `${baseClasses} border-purple-500 text-purple-700 font-semibold`;
    }

    // Special case for Question Forge - use amber/orange color scheme
    if (path === '/forge' && isActive(path)) {
      return `${baseClasses} border-orange-500 text-orange-700 font-semibold`;
    }

    const activeClasses = "border-indigo-500 text-indigo-600 font-semibold";
    const inactiveClasses = "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700";

    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  // Get the CSS classes for a mobile nav link based on active state
  const getMobileLinkClasses = (path: string): string => {
    const baseClasses = "block pl-3 pr-4 py-2 border-l-4 text-base font-medium";
    
    // Special case for Import page - use green color scheme
    if (path === '/import' && isActive(path)) {
      return `${baseClasses} bg-green-50 border-green-500 text-green-700`;
    }
    
    // Special case for Quiz page - use blue color scheme from homepage
    if (path === '/quiz' && isActive(path)) {
      return `${baseClasses} bg-blue-50 border-blue-500 text-blue-700`;
    }
    
    // Special case for Admin page - use red color scheme
    if (path === '/admin' && isActive(path)) {
      return `${baseClasses} bg-red-50 border-red-500 text-red-700`;
    }

    // Special case for DI Question Bank - use purple color scheme
    if (path === '/review-di' && isActive(path)) {
      return `${baseClasses} bg-purple-50 border-purple-500 text-purple-700`;
    }

    // Special case for Question Forge - use amber/orange color scheme
    if (path === '/forge' && isActive(path)) {
      return `${baseClasses} bg-orange-50 border-orange-500 text-orange-700`;
    }

    const activeClasses = "bg-indigo-50 border-indigo-500 text-indigo-700";
    const inactiveClasses = "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  const handleLogout = () => { 
    analytics.trackUserLoggedOut();
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50">
      {/* Wider container + tighter inter-link spacing — admin sees ~11 nav
          links and the old max-w-7xl + space-x-8 pushed the right edge off
          screen. The desktop nav also moves up to the lg: breakpoint so
          tablet widths fall back to the mobile menu instead of squeezing. */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between h-16">
          <div className="flex min-w-0">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600 whitespace-nowrap">
                GMAT Quiz
              </Link>
            </div>
            <div className="hidden lg:ml-5 lg:flex lg:items-center lg:gap-x-4 xl:gap-x-5">
              <Link
                to="/"
                className={getLinkClasses('/')}
              >
                Home
              </Link>
              <Link
                to="/quiz"
                className={getLinkClasses('/quiz')}
              >
                Quiz
              </Link>
              {user && (
                <Link
                  to="/quizzes"
                  className={getLinkClasses('/quizzes')}
                >
                  My Quizzes
                </Link>
              )}
              {user && (
                <Link
                  to="/my-questions"
                  className={getLinkClasses('/my-questions')}
                >
                  My Questions
                </Link>
              )}
              {user && (user.accountRole === 'owner' || user.accountRole === 'admin') && (
                <Link
                  to="/account"
                  className={getLinkClasses('/account')}
                >
                  Account
                </Link>
              )}
              <Link
                to="/review"
                className={getLinkClasses('/review')}
              >
                Question Bank
              </Link>
              <Link
                to="/review-di"
                className={getLinkClasses('/review-di')}
              >
                DI Bank
              </Link>
              {/* Show Question Forge only for admin users */}
              {isAdmin && (
                <Link
                  to="/forge"
                  className={getLinkClasses('/forge')}
                >
                  Forge
                </Link>
              )}
              <Link
                to="/import"
                className={getLinkClasses('/import')}
              >
                Import
              </Link>
              {/* Show Admin link only for admin users */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={getLinkClasses('/admin')}
                >
                  Admin
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin/accounts"
                  className={getLinkClasses('/admin/accounts')}
                >
                  CRM
                </Link>
              )}
            </div>
          </div>
          <div className="hidden lg:ml-4 lg:flex lg:items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/profile"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/profile') ? 'bg-gray-100 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/login') ? 'bg-gray-100 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/register') ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Request Access
                </Link>
              </div>
            )}
          </div>
          <div className="-mr-2 flex items-center lg:hidden">
            {/* Mobile menu button */}
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="lg:hidden" id="mobile-menu" style={{ display: 'none' }}>
        <div className="pt-2 pb-3 space-y-1">
          <Link
            to="/"
            className={getMobileLinkClasses('/')}
          >
            Home
          </Link>
          <Link
            to="/quiz"
            className={getMobileLinkClasses('/quiz')}
          >
            Quiz
          </Link>
          {user && (
            <Link
              to="/quizzes"
              className={getMobileLinkClasses('/quizzes')}
            >
              My Quizzes
            </Link>
          )}
          {user && (
            <Link
              to="/my-questions"
              className={getMobileLinkClasses('/my-questions')}
            >
              My Questions
            </Link>
          )}
          {user && (user.accountRole === 'owner' || user.accountRole === 'admin') && (
            <Link
              to="/account"
              className={getMobileLinkClasses('/account')}
            >
              Account
            </Link>
          )}
          <Link
            to="/review"
            className={getMobileLinkClasses('/review')}
          >
            Question Bank
          </Link>
          <Link
            to="/review-di"
            className={getMobileLinkClasses('/review-di')}
          >
            Question Bank DI
          </Link>
          {isAdmin && (
            <Link
              to="/forge"
              className={getMobileLinkClasses('/forge')}
            >
              Question Forge
            </Link>
          )}
          <Link
            to="/import"
            className={getMobileLinkClasses('/import')}
          >
            Import
          </Link>
          {/* Show Admin link only for admin users in mobile menu */}
          {isAdmin && (
            <Link
              to="/admin"
              className={getMobileLinkClasses('/admin')}
            >
              Admin Panel
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/accounts"
              className={getMobileLinkClasses('/admin/accounts')}
            >
              Accounts CRM
            </Link>
          )}
        </div>
        {user ? (
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="space-y-1">
              <Link
                to="/profile"
                className={getMobileLinkClasses('/profile')}
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="space-y-1">
              <Link
                to="/login"
                className={getMobileLinkClasses('/login')}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={getMobileLinkClasses('/register')}
              >
                Request Access
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}; 