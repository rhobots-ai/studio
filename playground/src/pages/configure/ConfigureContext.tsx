import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TrainingConfig, createTrainingConfig } from '../../config/training';
import { Model } from '../../services/chatApi';

// Types
interface FileWithPreview extends File {
  preview?: string;
}

interface ConfigureState {
  // Step 1: Model Selection
  selectedBaseModel: Model | null;
  activeModelTab: 'finetuned' | 'huggingface';
  
  // Step 2: Data Upload
  files: FileWithPreview[];
  selectedFile: File | null;
  selectedFileId: string | null; // For backend file management
  validationStatus: 'idle' | 'validating' | 'valid' | 'invalid';
  validationMessages: string[];
  
  // Step 3: Configuration
  parameters: {
    epochs: number;
    learningRate: number;
    batchSize: number;
    maxSequenceLength: number;
    modelName: string;
    cutoff: number;
    loggingSteps: number;
  };
  trainingConfig: TrainingConfig;
  
  // Step completion tracking
  completedSteps: Set<number>;
  currentStep: number;
}

type ConfigureAction =
  | { type: 'SET_SELECTED_MODEL'; payload: Model | null }
  | { type: 'SET_ACTIVE_MODEL_TAB'; payload: 'finetuned' | 'huggingface' }
  | { type: 'SET_FILES'; payload: FileWithPreview[] }
  | { type: 'SET_SELECTED_FILE'; payload: File | null }
  | { type: 'SET_SELECTED_FILE_ID'; payload: string | null }
  | { type: 'SET_VALIDATION_STATUS'; payload: { status: 'idle' | 'validating' | 'valid' | 'invalid'; messages: string[] } }
  | { type: 'SET_PARAMETERS'; payload: Partial<ConfigureState['parameters']> }
  | { type: 'SET_TRAINING_CONFIG'; payload: Partial<TrainingConfig> }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'RESET_STATE' };

const initialState: ConfigureState = {
  selectedBaseModel: null,
  activeModelTab: 'huggingface',
  files: [],
  selectedFile: null,
  selectedFileId: null,
  validationStatus: 'idle',
  validationMessages: [],
  parameters: {
    epochs: 3,
    learningRate: 0.0002,
    batchSize: 8,
    maxSequenceLength: 2048,
    modelName: '',
    cutoff: 0.8,
    loggingSteps: 10,
  },
  trainingConfig: createTrainingConfig({}),
  completedSteps: new Set(),
  currentStep: 1,
};

function configureReducer(state: ConfigureState, action: ConfigureAction): ConfigureState {
  switch (action.type) {
    case 'SET_SELECTED_MODEL':
      return { ...state, selectedBaseModel: action.payload };
    
    case 'SET_ACTIVE_MODEL_TAB':
      return { ...state, activeModelTab: action.payload };
    
    case 'SET_FILES':
      return { ...state, files: action.payload };
    
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    
    case 'SET_SELECTED_FILE_ID':
      return { ...state, selectedFileId: action.payload };
    
    case 'SET_VALIDATION_STATUS':
      return { 
        ...state, 
        validationStatus: action.payload.status,
        validationMessages: action.payload.messages 
      };
    
    case 'SET_PARAMETERS':
      return { 
        ...state, 
        parameters: { ...state.parameters, ...action.payload } 
      };
    
    case 'SET_TRAINING_CONFIG':
      return { 
        ...state, 
        trainingConfig: { ...state.trainingConfig, ...action.payload } 
      };
    
    case 'COMPLETE_STEP':
      return { 
        ...state, 
        completedSteps: new Set([...state.completedSteps, action.payload]) 
      };
    
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

interface ConfigureContextType {
  state: ConfigureState;
  dispatch: React.Dispatch<ConfigureAction>;
  
  // Helper functions
  isStepCompleted: (step: number) => boolean;
  canProceedToStep: (step: number) => boolean;
  completeCurrentStep: () => void;
  goToStep: (step: number) => void;
}

const ConfigureContext = createContext<ConfigureContextType | undefined>(undefined);

export function ConfigureProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(configureReducer, initialState);

  const isStepCompleted = (step: number): boolean => {
    return state.completedSteps.has(step);
  };

  const canProceedToStep = (step: number): boolean => {
    // Can always go to step 1
    if (step === 1) return true;
    
    // Can go to step 2 if step 1 is completed (model selected)
    if (step === 2) return state.selectedBaseModel !== null;
    
    // Can go to step 3 if step 2 is completed (file selected and validated)
    if (step === 3) return (state.selectedFileId !== null || (state.files.length > 0 && state.validationStatus === 'valid'));
    
    return false;
  };

  const completeCurrentStep = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: state.currentStep });
  };

  const goToStep = (step: number) => {
    if (canProceedToStep(step)) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: step });
    }
  };

  const contextValue: ConfigureContextType = {
    state,
    dispatch,
    isStepCompleted,
    canProceedToStep,
    completeCurrentStep,
    goToStep,
  };

  return (
    <ConfigureContext.Provider value={contextValue}>
      {children}
    </ConfigureContext.Provider>
  );
}

export function useConfigureContext() {
  const context = useContext(ConfigureContext);
  if (context === undefined) {
    throw new Error('useConfigureContext must be used within a ConfigureProvider');
  }
  return context;
}
