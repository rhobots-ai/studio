import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayMs?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayMs = 300,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const childRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number>();

  const showTooltip = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setIsOpen(true), delayMs);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (isOpen && childRef.current && tooltipRef.current) {
      const childRect = childRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (side) {
        case 'top':
          y = childRect.top - tooltipRect.height - 8;
          break;
        case 'right':
          x = childRect.right + 8;
          break;
        case 'bottom':
          y = childRect.bottom + 8;
          break;
        case 'left':
          x = childRect.left - tooltipRect.width - 8;
          break;
      }

      switch (align) {
        case 'start':
          if (side === 'top' || side === 'bottom') {
            x = childRect.left;
          } else {
            y = childRect.top;
          }
          break;
        case 'center':
          if (side === 'top' || side === 'bottom') {
            x = childRect.left + (childRect.width / 2) - (tooltipRect.width / 2);
          } else {
            y = childRect.top + (childRect.height / 2) - (tooltipRect.height / 2);
          }
          break;
        case 'end':
          if (side === 'top' || side === 'bottom') {
            x = childRect.right - tooltipRect.width;
          } else {
            y = childRect.bottom - tooltipRect.height;
          }
          break;
      }

      // Ensure tooltip stays within viewport
      x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));

      setPosition({ x, y });
    }
  }, [isOpen, side, align]);

  const child = React.cloneElement(children, {
    ref: childRef,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  });

  return (
    <>
      {child}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 9999,
                pointerEvents: 'none',
              }}
              className={cn(
                'bg-gray-900 dark:bg-gray-700 text-white px-3 py-1.5 rounded text-sm',
                'shadow-lg max-w-xs'
              )}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}