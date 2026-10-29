// client/src/components/admin/useAdminTheme.js
import { useState, useCallback } from 'react';

export const useAdminTheme = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('adm_theme') === 'dark' ? 'dark' : 'light');
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('adm_theme', next);
      return next;
    });
  }, []);
  return [theme, toggleTheme];
};
