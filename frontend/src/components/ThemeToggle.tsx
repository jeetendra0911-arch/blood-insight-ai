'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Determine initial theme on mount
    const isDark = document.documentElement.classList.contains('dark') || 
      (localStorage.theme === 'dark') || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setTheme('light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-all duration-300 focus:outline-none shadow-sm"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label="Toggle Theme"
    >
      <div className="relative h-4 w-4">
        {/* Sun Icon (rotates and scales out when light theme is active, i.e., moon is shown or vice versa) */}
        <span className={`absolute inset-0 transform transition-all duration-500 ${
          theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
        }`}>
          <Sun className="h-4 w-4 text-amber-500" />
        </span>
        
        {/* Moon Icon */}
        <span className={`absolute inset-0 transform transition-all duration-500 ${
          theme === 'light' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}>
          <Moon className="h-4 w-4 text-blue-600" />
        </span>
      </div>
    </button>
  );
}
