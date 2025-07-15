import { cn } from '../../utils/cn';

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  formatValue?: (value: number, max: number) => string;
}

export function Progress({
  className,
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showValue = false,
  formatValue = (value, max) => `${Math.round((value / max) * 100)}%`,
  ...props
}: ProgressProps) {
  const percentage = (value / max) * 100;

  // Define color classes based on variant
  const getProgressColor = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-600';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-600';
      case 'secondary':
        return 'bg-blue-600';
      case 'primary':
        return 'bg-purple-600';
      default:
        return 'bg-gray-500';
    }
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full" {...props}>
      <div className={cn(
        'w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
        sizes[size],
        className
      )}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-in-out',
            getProgressColor()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showValue && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
          {formatValue(value, max)}
        </div>
      )}
    </div>
  );
}