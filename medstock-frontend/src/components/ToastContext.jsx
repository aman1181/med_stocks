import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', duration: 4000 });

  const showToast = useCallback((message, duration = 4000) => {
    setToast({ message, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ message: '', duration: 4000 });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// Toast component that uses context
export function Toast() {
  const { toast, hideToast } = useToast();
  React.useEffect(() => {
    if (!toast.message) return;
    const timer = setTimeout(() => {
      hideToast();
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);
  if (!toast.message) return null;
  return (
    <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
      <span className="font-semibold">Success:</span>
      <span>{toast.message}</span>
      <button onClick={hideToast} className="ml-2 text-white hover:text-gray-200 font-bold">×</button>
    </div>
  );
}
