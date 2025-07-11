import { useState } from 'react';
import { ChevronUp, Settings, CreditCard, LogOut, User, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeProvider';

interface UserProfileProps {
  user?: {
    name: string;
    email: string;
    plan: string;
    avatar?: string;
  };
}

export default function UserProfile({ 
  user = {
    name: 'Gulshan Yadav',
    email: 'gulshan@example.com',
    plan: 'Free'
  }
}: UserProfileProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro':
      case 'premium':
        return 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400';
      case 'free':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const getThemeIcon = () => {
    return theme === 'dark' ? Sun : Moon;
  };

  const getThemeLabel = () => {
    return theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  };

  const menuItems = [
    { icon: User, label: 'Profile', action: () => console.log('Profile clicked') },
    { icon: Settings, label: 'Settings', action: () => console.log('Settings clicked') },
    { icon: getThemeIcon(), label: getThemeLabel(), action: toggleTheme },
    { icon: CreditCard, label: 'Billing', action: () => console.log('Billing clicked') },
    { icon: LogOut, label: 'Sign Out', action: () => console.log('Sign out clicked'), danger: true },
  ];

  return (
    <div className="relative">
      {/* Dropdown Menu */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-2 z-20"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-large border border-gray-200 dark:border-gray-700 py-2">
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      item.action();
                      setIsDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${item.danger 
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center text-white font-medium text-sm">
          {user.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name}
              className="w-full h-full rounded-lg object-cover"
            />
          ) : (
            getInitials(user.name)
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
            {user.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getPlanColor(user.plan)}`}>
              {user.plan}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <ChevronUp 
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>
    </div>
  );
}
