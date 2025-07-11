import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedLoader } from '../ui/AnimatedLoader';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    isGood?: boolean;
  };
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'secondary';
  isLoading?: boolean;
  subtitle?: string;
}

const colorClasses = {
  primary: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    icon: 'text-primary-600 dark:text-primary-400',
    border: 'border-primary-200 dark:border-primary-800',
  },
  success: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    icon: 'text-success-600 dark:text-success-400',
    border: 'border-success-200 dark:border-success-800',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    icon: 'text-warning-600 dark:text-warning-400',
    border: 'border-warning-200 dark:border-warning-800',
  },
  error: {
    bg: 'bg-error-50 dark:bg-error-900/20',
    icon: 'text-error-600 dark:text-error-400',
    border: 'border-error-200 dark:border-error-800',
  },
  secondary: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    icon: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
};

export default function MetricCard({
  title,
  value,
  unit,
  trend,
  icon,
  color = 'secondary',
  isLoading = false,
  subtitle,
}: MetricCardProps) {
  const colors = colorClasses[color];

  const getTrendIcon = () => {
    if (!trend) return null;
    
    const iconClass = trend.isGood 
      ? 'text-success-500' 
      : trend.direction === 'up' 
        ? 'text-error-500' 
        : trend.direction === 'down'
          ? 'text-success-500'
          : 'text-gray-400';

    switch (trend.direction) {
      case 'up':
        return <TrendingUp className={`h-3 w-3 ${iconClass}`} />;
      case 'down':
        return <TrendingDown className={`h-3 w-3 ${iconClass}`} />;
      default:
        return <Minus className={`h-3 w-3 ${iconClass}`} />;
    }
  };

  const getTrendText = () => {
    if (!trend) return null;
    
    const textClass = trend.isGood 
      ? 'text-success-600 dark:text-success-400' 
      : trend.direction === 'up' 
        ? 'text-error-600 dark:text-error-400' 
        : trend.direction === 'down'
          ? 'text-success-600 dark:text-success-400'
          : 'text-gray-500 dark:text-gray-400';

    return (
      <div className={`flex items-center gap-1 text-xs font-medium ${textClass}`}>
        {getTrendIcon()}
        <span>{trend.percentage}%</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-xl border bg-white dark:bg-gray-900 p-6 
        shadow-soft hover:shadow-medium transition-all duration-200
        ${colors.border}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {icon && (
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <div className={`h-5 w-5 ${colors.icon}`}>
                  {icon}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {title}
              </p>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <div>
              {isLoading ? (
                <AnimatedLoader variant="pulse" size="sm" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {value}
                  </span>
                  {unit && (
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {unit}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {trend && !isLoading && (
              <div className="flex flex-col items-end">
                {getTrendText()}
                <span className="text-xs text-gray-400 mt-0.5">vs last hour</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-5 pointer-events-none`} />
    </motion.div>
  );
}
