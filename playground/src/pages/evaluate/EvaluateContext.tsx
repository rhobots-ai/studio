import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { EvaluationMapping } from '../../services/evaluationService';

// Define Model type for evaluation
interface Model {
  id: string;
  name: string;
  description?: string;
  size?: string;
  family?: string;
  isBase?: boolean;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  accuracy?: number;
  status?: string;
  training_session_id?: string;
  model_type?: string;
  version?: string;
  model_path?: string;
  base_model?: string;
}

interface EvaluateState {
  currentStep: number;
  
  // Step 1: Model Selection
  selectedModel: Model | null;
  compareModel: Model | null;
  activeTab: 'finetuned' | 'huggingface';
  
  // Step 2: Data Upload & Mapping
  uploadedFile: File | null;
  fileContent: string;
  fileType: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle' | null;
  availableColumns: string[];
  columnInfo: Record<string, any>;
  mapping: EvaluationMapping | null;
  
  // Step 3: Parameters
  batchSize: number;
  maxTokens: number;
  temperature: number;
  
  // Step 4: Progress
  evaluationJobId: string | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
}

type EvaluateAction =
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'SET_SELECTED_MODEL'; payload: Model | null }
  | { type: 'SET_COMPARE_MODEL'; payload: Model | null }
  | { type: 'SET_ACTIVE_TAB'; payload: 'finetuned' | 'huggingface' }
  | { type: 'SET_UPLOADED_FILE'; payload: File | null }
  | { type: 'SET_FILE_CONTENT'; payload: string }
  | { type: 'SET_FILE_TYPE'; payload: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle' | null }
  | { type: 'SET_AVAILABLE_COLUMNS'; payload: string[] }
  | { type: 'SET_COLUMN_INFO'; payload: Record<string, any> }
  | { type: 'SET_MAPPING'; payload: EvaluationMapping | null }
  | { type: 'SET_BATCH_SIZE'; payload: number }
  | { type: 'SET_MAX_TOKENS'; payload: number }
  | { type: 'SET_TEMPERATURE'; payload: number }
  | { type: 'SET_EVALUATION_JOB_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

const initialState: EvaluateState = {
  currentStep: 1,
  
  // Step 1: Model Selection
  selectedModel: null,
  compareModel: null,
  activeTab: 'finetuned',
  
  // Step 2: Data Upload & Mapping
  uploadedFile: null,
  fileContent: '',
  fileType: null,
  availableColumns: [],
  columnInfo: {},
  mapping: null,
  
  // Step 3: Parameters
  batchSize: 50,
  maxTokens: 150,
  temperature: 0.7,
  
  // Step 4: Progress
  evaluationJobId: null,
  
  // UI State
  isLoading: false,
  error: null,
};

function evaluateReducer(state: EvaluateState, action: EvaluateAction): EvaluateState {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.payload };
    case 'SET_COMPARE_MODEL':
      return { ...state, compareModel: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFile: action.payload };
    case 'SET_FILE_CONTENT':
      return { ...state, fileContent: action.payload };
    case 'SET_FILE_TYPE':
      return { ...state, fileType: action.payload };
    case 'SET_AVAILABLE_COLUMNS':
      return { ...state, availableColumns: action.payload };
    case 'SET_COLUMN_INFO':
      return { ...state, columnInfo: action.payload };
    case 'SET_MAPPING':
      return { ...state, mapping: action.payload };
    case 'SET_BATCH_SIZE':
      return { ...state, batchSize: action.payload };
    case 'SET_MAX_TOKENS':
      return { ...state, maxTokens: action.payload };
    case 'SET_TEMPERATURE':
      return { ...state, temperature: action.payload };
    case 'SET_EVALUATION_JOB_ID':
      return { ...state, evaluationJobId: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

interface EvaluateContextType {
  state: EvaluateState;
  dispatch: React.Dispatch<EvaluateAction>;
}

const EvaluateContext = createContext<EvaluateContextType | undefined>(undefined);

export function EvaluateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(evaluateReducer, initialState);

  return (
    <EvaluateContext.Provider value={{ state, dispatch }}>
      {children}
    </EvaluateContext.Provider>
  );
}

export function useEvaluateContext() {
  const context = useContext(EvaluateContext);
  if (context === undefined) {
    throw new Error('useEvaluateContext must be used within a EvaluateProvider');
  }
  return context;
}
