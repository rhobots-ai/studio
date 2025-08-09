import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '../../utils/cn';

export type UploadStep = 'uploaded' | 'extracting' | 'processing' | 'ready' | 'error';

interface FileUploadStepperProps {
  currentStep: UploadStep;
  fileName: string;
  fileSize: string;
  error?: string;
  className?: string;
  onRetry?: () => void;
  extractedFields?: any;
  ocrText?: string;
}

interface StepConfig {
  id: UploadStep;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  estimatedTime?: string;
}

const steps: StepConfig[] = [
  {
    id: 'uploaded',
    title: 'Uploaded',
    description: 'File received successfully',
    icon: Upload,
    estimatedTime: '< 1s'
  },
  {
    id: 'extracting',
    title: 'Extracting',
    description: 'Reading document content',
    icon: FileText,
    estimatedTime: '2-5s'
  },
  {
    id: 'processing',
    title: 'Processing',
    description: 'AI analyzing content',
    icon: Brain,
    estimatedTime: '3-8s'
  },
  {
    id: 'ready',
    title: 'Ready',
    description: '',
    icon: CheckCircle,
  }
];

export const FileUploadStepper: React.FC<FileUploadStepperProps> = ({
  currentStep,
  fileName,
  fileSize,
  error,
  className = '',
  onRetry,
  extractedFields,
  ocrText
}) => {
  const getCurrentStepIndex = () => {
    if (currentStep === 'error') return -1;
    return steps.findIndex(step => step.id === currentStep);
  };

  const currentStepIndex = getCurrentStepIndex();
  const isError = currentStep === 'error';

  const getStepStatus = (stepIndex: number) => {
    if (isError) return 'error';
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const getStepIcon = (step: StepConfig, status: string) => {
    const IconComponent = step.icon;
    
    if (status === 'completed') {
      return <CheckCircle className="h-5 w-5" />;
    }
    
    if (status === 'active') {
      return (
        <motion.div
          animate={{ rotate: step.id === 'extracting' || step.id === 'processing' ? 360 : 0 }}
          transition={{ 
            duration: 2, 
            repeat: step.id === 'extracting' || step.id === 'processing' ? Infinity : 0,
            ease: "linear" 
          }}
        >
          <IconComponent className="h-5 w-5" />
        </motion.div>
      );
    }
    
    return <IconComponent className="h-5 w-5" />;
  };

  const getProgressWidth = () => {
    if (isError) return '0%';
    if (currentStepIndex === -1) return '0%';
    if (currentStepIndex === steps.length - 1) return '100%';
    return `${((currentStepIndex + 1) / steps.length) * 100}%`;
  };

  return (
    <div className={cn("bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4", className)}>
      {/* File Info Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0">
          <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {fileName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {fileSize}
          </p>
        </div>
        {!isError && currentStep !== 'ready' && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>
              {steps[currentStepIndex]?.estimatedTime || 'Processing...'}
            </span>
          </div>
        )}
      </div>

      {/* Error State */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Upload Failed
              </p>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mb-3">
              {error || 'An error occurred during upload'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <Zap className="h-3 w-3" />
                Retry Upload
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {isError ? 'Failed' : currentStep === 'ready' ? 'Complete' : 'Processing...'}
          </span>
          <span className="text-xs text-gray-500">
            {isError ? '0%' : currentStep === 'ready' ? '100%' : `${Math.round(((currentStepIndex + 1) / steps.length) * 100)}%`}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors duration-300",
              isError 
                ? "bg-red-500" 
                : currentStep === 'ready' 
                ? "bg-green-500" 
                : "bg-primary-500"
            )}
            initial={{ width: '0%' }}
            animate={{ width: getProgressWidth() }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                status === 'active' && "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800",
                status === 'completed' && "bg-green-50 dark:bg-green-900/20",
                status === 'pending' && "opacity-60"
              )}
            >
              {/* Step Icon */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                status === 'completed' && "bg-green-500 text-white",
                status === 'active' && "bg-primary-500 text-white animate-pulse",
                status === 'pending' && "bg-gray-200 dark:bg-gray-700 text-gray-400",
                status === 'error' && "bg-red-500 text-white"
              )}>
                {status === 'active' && (step.id === 'extracting' || step.id === 'processing') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getStepIcon(step, status)
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    status === 'completed' && "text-green-700 dark:text-green-300",
                    status === 'active' && "text-primary-700 dark:text-primary-300",
                    status === 'pending' && "text-gray-500 dark:text-gray-400"
                  )}>
                    {step.title}
                  </p>
                  {status === 'active' && step.estimatedTime && (
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {step.estimatedTime}
                    </span>
                  )}
                </div>
                <p className={cn(
                  "text-xs transition-colors",
                  status === 'completed' && "text-green-600 dark:text-green-400",
                  status === 'active' && "text-primary-600 dark:text-primary-400",
                  status === 'pending' && "text-gray-400 dark:text-gray-500"
                )}>
                  {step.description}
                </p>
              </div>

              {/* Status Indicator */}
              {status === 'active' && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* OCR Text Preview */}
      <AnimatePresence>
        {currentStep === 'ready' && ocrText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Extracted text preview:</p>
            <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3">
              {ocrText.length > 200 ? `${ocrText.substring(0, 200)}...` : ocrText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracted Invoice Fields */}
      <AnimatePresence>
        {currentStep === 'ready' && extractedFields && !extractedFields.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            {/* Second file header with extracted status */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {fileName}
                  </p>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle className="h-3 w-3" />
                    Extracted
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {fileSize} • 5/5 fields extracted
                </p>
              </div>
            </div>

            {/* Invoice fields container */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Extracted Invoice Fields
                </p>
                <div className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                  AI Model
                </div>
              </div>

              <div className="space-y-4">
                {/* Invoice Number */}
                {extractedFields.invoice_number && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">#</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Invoice Number</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {extractedFields.invoice_number}
                      </p>
                    </div>
                  </div>
                )}

                {/* Invoice Date */}
                {extractedFields.invoice_date && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Invoice Date</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(extractedFields.invoice_date).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Invoice Amount */}
                {(extractedFields.invoice_amount || extractedFields.total || extractedFields.amount) && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">₹</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Invoice Amount</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        ₹{(extractedFields.invoice_amount || extractedFields.total || extractedFields.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Seller GSTIN */}
                {extractedFields.seller_gstin && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Seller GSTIN</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                        {extractedFields.seller_gstin}
                      </p>
                    </div>
                  </div>
                )}

                {/* Buyer GSTIN */}
                {extractedFields.buyer_gstin && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Buyer GSTIN</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                        {extractedFields.buyer_gstin}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Extraction completed using AI model
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  5 of 5 fields found
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {currentStep === 'ready' && !extractedFields && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Document Ready!
              </p>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              You can now ask questions about your document in the chat.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploadStepper;
