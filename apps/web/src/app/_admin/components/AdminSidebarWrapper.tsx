'use client';

import { useEffect, useState } from 'react';

import AdminSidebar from './AdminSidebar';

const COOKIE_NAME = 'admin-sidebar-collapsed';

/**
 * Wrapper component that manages sidebar collapse state
 * Persists state to cookies for consistency across page loads
 */
const AdminSidebarWrapper = () => {
  // Default to expanded (false = not collapsed)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load initial state from cookie on mount - default to expanded if no cookie
  useEffect(() => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (cookie) {
      setIsCollapsed(cookie.split('=')[1] === 'true');
    }
    // If no cookie, stay expanded (default)
    setMounted(true);
  }, []);

  const handleToggleCollapse = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    // Persist to cookie (1 year expiry)
    document.cookie = `${COOKIE_NAME}=${newValue}; path=/; max-age=${60 * 60 * 24 * 365}`;
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <div className="hidden w-56 flex-shrink-0 md:block" />;
  }

  return <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={handleToggleCollapse} />;
};

export default AdminSidebarWrapper;
