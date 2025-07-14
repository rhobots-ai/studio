import React from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';
import { Button } from './Button';

interface ModelWarningProps {
  modelName: string;
  message: string;
  recommendations?: string[];
  onAcknowledge: () => void;
  onDismiss: () => void;
  isVisible: boolean;
}

export function ModelWarning({
  modelName,
  message,
  recommendations = [],
  onAcknowledge,
  onDismiss,
  isVisible
}: ModelWarningProps) {
  if (!isVisible) return null;

  return (
    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Non-Instruction Model Warning
            </h4>
            <button
              onClick={onDismiss}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            {message}
          </p>
          
          {recommendations.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                💡 Recommendations:
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onAcknowledge}
              className="bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue Anyway
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
              className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              Select Different Model
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
