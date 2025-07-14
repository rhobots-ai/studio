import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface AnimatedLoaderProps {
  variant?: 'dots' | 'pulse' | 'brain' | 'typing' | 'wave' | 'orbit' | 'neural';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function AnimatedLoader({ 
  variant = 'dots', 
  size = 'md', 
  className,
  text 
}: AnimatedLoaderProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn('bg-primary-500 rounded-full', dotSizes[size])}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        {text && <span className="text-sm text-gray-500 ml-2">{text}</span>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <motion.div
          className={cn('bg-primary-500 rounded-full', sizes[size])}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 0.4, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'brain') {
    return (
      <div className={cn('flex items-center space-x-3', className)}>
        <div className="relative">
          <motion.div
            className={cn('border-2 border-primary-500 rounded-full', sizes[size])}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-1 bg-primary-500 rounded-full"
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'typing') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn('bg-primary-500 rounded-full', dotSizes[size])}
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <div className="flex space-x-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className={cn('bg-primary-500 rounded-sm', 'w-1', size === 'sm' ? 'h-3' : size === 'md' ? 'h-4' : 'h-6')}
              animate={{
                scaleY: [1, 2, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'orbit') {
    return (
      <div className={cn('flex items-center space-x-3', className)}>
        <div className="relative">
          <div className={cn('border border-gray-300 rounded-full', sizes[size])} />
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className={cn('absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary-500 rounded-full', dotSizes[size])} />
          </motion.div>
        </div>
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'neural') {
    return (
      <div className={cn('flex items-center space-x-3', className)}>
        <div className="relative">
          <motion.div
            className={cn('border-2 border-primary-500 rounded-full', sizes[size])}
            animate={{
              borderColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#3b82f6'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute inset-2 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full"
            animate={{
              scale: [0.8, 1.1, 0.8],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        {text && <span className="text-sm text-gray-500">{text}</span>}
      </div>
    );
  }

  // Default fallback
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <motion.div
        className={cn('border-2 border-primary-500 border-t-transparent rounded-full', sizes[size])}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      {text && <span className="text-sm text-gray-500">{text}</span>}
    </div>
  );
}
