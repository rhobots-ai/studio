import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { X, Code, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  currentConfig: any;
  onApply: (config: any) => void;
  placeholder?: string;
}

export function JsonEditorModal({
  isOpen,
  onClose,
  title,
  description,
  currentConfig,
  onApply,
  placeholder = "Paste your JSON configuration here..."
}: JsonEditorModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  // Initialize with current config when modal opens
  useEffect(() => {
    if (isOpen && currentConfig) {
      setJsonText(JSON.stringify(currentConfig, null, 2));
      setError(null);
      setIsValid(true);
    }
  }, [isOpen, currentConfig]);

  // Validate JSON as user types
  useEffect(() => {
    if (!jsonText.trim()) {
      setError(null);
      setIsValid(false);
      return;
    }

    try {
      JSON.parse(jsonText);
      setError(null);
      setIsValid(true);
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`);
      setIsValid(false);
    }
  }, [jsonText]);

  const handleApply = () => {
    if (!isValid) return;

    try {
      const config = JSON.parse(jsonText);
      onApply(config);
      onClose();
    } catch (err: any) {
      setError(`Failed to apply configuration: ${err.message}`);
    }
  };

  const handleClose = () => {
    setJsonText('');
    setError(null);
    setIsValid(false);
    onClose();
  };

  const handleExport = () => {
    if (currentConfig) {
      const jsonString = JSON.stringify(currentConfig, null, 2);
      navigator.clipboard.writeText(jsonString);
      // You could add a toast notification here
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Code className="h-5 w-5 text-primary-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="text-xs"
              >
                Copy Current
              </Button>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col space-y-4">
              {/* JSON Editor */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  JSON Configuration
                </label>
                <div className="flex-1 relative">
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full h-full min-h-[400px] px-4 py-3 text-sm font-mono border rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none ${
                      error 
                        ? 'border-red-300 dark:border-red-600' 
                        : isValid && jsonText.trim()
                        ? 'border-green-300 dark:border-green-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    spellCheck={false}
                  />
                  
                  {/* Status indicator */}
                  {jsonText.trim() && (
                    <div className="absolute top-3 right-3">
                      {isValid ? (
                        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" />
                          <span className="text-xs">Valid JSON</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs">Invalid JSON</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              )}

              {/* Help text */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tip:</strong> You can paste JSON configurations from other tools or export your current settings using "Copy Current" button.
                  The configuration will be validated in real-time as you type.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isValid || !jsonText.trim()}
            >
              Apply Configuration
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
