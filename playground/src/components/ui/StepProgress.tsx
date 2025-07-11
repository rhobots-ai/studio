import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Step {
  id: number;
  title: string;
  description: string;
}


interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (stepId: number) => void;
  canNavigateToStep?: (stepId: number) => boolean;
}

export function StepProgress({ 
  steps, 
  currentStep, 
  completedSteps, 
  onStepClick,
  canNavigateToStep 
}: StepProgressProps) {
  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = currentStep === step.id;
          const canNavigate = canNavigateToStep ? canNavigateToStep(step.id) : true;
          const isClickable = onStepClick && canNavigate;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
                    isCompleted
                      ? "bg-green-500 text-white shadow-lg"
                      : isCurrent
                      ? "bg-primary-500 text-white shadow-lg ring-4 ring-primary-100 dark:ring-primary-900/30"
                      : canNavigate
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600",
                    isClickable && "cursor-pointer",
                    !canNavigate && "cursor-not-allowed"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </button>
                
                {/* Step Label */}
                <div className="mt-3 text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    isCurrent 
                      ? "text-primary-600 dark:text-primary-400" 
                      : isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-400"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-24">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4 mt-[-2rem]">
                  <div className={cn(
                    "h-0.5 transition-colors duration-200",
                    completedSteps.has(step.id) && completedSteps.has(steps[index + 1].id)
                      ? "bg-green-500"
                      : completedSteps.has(step.id) || currentStep > step.id
                      ? "bg-primary-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  )} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Step Info */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {steps.find(s => s.id === currentStep)?.title}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Step {currentStep} of {steps.length}
        </p>
      </div>
    </div>
  );
}

// Navigation component for step-by-step flow
interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  canProceed?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  completeLabel?: string;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onComplete,
  canProceed = true,
  isLoading = false,
  nextLabel = "Next",
  completeLabel = "Complete"
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
      <div>
        {!isFirstStep && onPrevious && (
          <button
            onClick={onPrevious}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
            Previous
          </button>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {isLastStep ? (
          onComplete && (
            <button
              onClick={onComplete}
              disabled={!canProceed || isLoading}
              className={cn(
                "inline-flex items-center px-6 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                canProceed && !isLoading
                  ? "text-white bg-primary-600 hover:bg-primary-700 shadow-sm"
                  : "text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                completeLabel
              )}
            </button>
          )
        ) : (
          onNext && (
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={cn(
                "inline-flex items-center px-6 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                canProceed
                  ? "text-white bg-primary-600 hover:bg-primary-700 shadow-sm"
                  : "text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed"
              )}
            >
              {nextLabel}
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
