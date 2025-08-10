import { useTheme } from '../../components/theme/ThemeProvider';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
      <div className="h-16 px-4 flex items-center justify-between lg:px-6">
        <h2 className="text-lg font-semibold md:hidden">LLM Studio</h2>
        <button
          aria-label="Toggle theme"
          className="ml-auto inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/70"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </button>
      </div>
    </header>
  );
}

