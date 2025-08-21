import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserInfo = () => {
      try {
        // Try to get user from localStorage
        const userStr = localStorage.getItem('user');
        
        if (userStr && userStr !== 'undefined' && userStr !== 'null') {
          const user = JSON.parse(userStr);
          
          if (user && user.role) {
            setCurrentUser(user);
            setCurrentUserRole(user.role);
            console.log('👤 Current user loaded:', user.username, 'Role:', user.role);
            return user;
          }
        }

        // If no user found, clear states
        setCurrentUser(null);
        setCurrentUserRole('');
        console.log('👤 No user found in localStorage');
        
      } catch (err) {
        console.error('❌ Error parsing user data:', err);
        setCurrentUser(null);
        setCurrentUserRole('');
      } finally {
        setLoading(false);
      }
    };

    getUserInfo();

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        getUserInfo();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup listener
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Helper functions
  const isAudit = currentUserRole === 'audit';
  const isAdmin = currentUserRole === 'admin';
  const isPharmacist = currentUserRole === 'pharmacist';
  const isLoggedIn = !!currentUser;

  // Permission checks
  const canCreate = isAdmin || isPharmacist;
  const canUpdate = isAdmin || isPharmacist;
  const canDelete = isAdmin || isPharmacist;
  const canRead = true; // All roles can read

  const hasPermission = (action) => {
    switch (action) {
      case 'create':
        return canCreate;
      case 'update':
        return canUpdate;
      case 'delete':
        return canDelete;
      case 'read':
        return canRead;
      default:
        return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    setCurrentUserRole('');
    console.log('👤 User logged out');
  };

  return {
    // User info
    currentUser,
    currentUserRole,
    loading,
    isLoggedIn,
    
    // Role checks
    isAudit,
    isAdmin,
    isPharmacist,
    
    // Permission checks
    canCreate,
    canUpdate,
    canDelete,
    canRead,
    hasPermission,
    
    // Actions
    logout
  };
};