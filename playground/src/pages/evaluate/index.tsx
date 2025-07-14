import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EvaluateProvider, useEvaluateContext } from './EvaluateContext';
import SelectModel from './SelectModel';
import UploadData from './UploadData';
import ConfigureParameters from './ConfigureParameters';
import EvaluationProgress from './EvaluationProgress';

function EvaluateContent() {
  const { state, dispatch } = useEvaluateContext();
  const location = useLocation();

  // Update current step based on route
  useEffect(() => {
    const path = location.pathname;
    let targetStep = 1;
    
    if (path.includes('/evaluate/model')) {
      targetStep = 1;
    } else if (path.includes('/evaluate/data')) {
      targetStep = 2;
    } else if (path.includes('/evaluate/parameters')) {
      targetStep = 3;
    } else if (path.includes('/evaluate/progress')) {
      targetStep = 4;
    }
    
    // Only update if the step is different to prevent infinite loops
    if (state.currentStep !== targetStep) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: targetStep });
    }
  }, [location.pathname, state.currentStep, dispatch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="">
        {/* Step Content */}
        <Routes>
          <Route path="/" element={<Navigate to="/evaluate/model" replace />} />
          <Route path="/model" element={<SelectModel />} />
          <Route path="/data" element={<UploadData />} />
          <Route path="/parameters" element={<ConfigureParameters />} />
          <Route path="/progress" element={<EvaluationProgress />} />
          {/* Legacy routes for backward compatibility */}
          <Route path="/test-data" element={<Navigate to="/evaluate/model" replace />} />
          <Route path="/metrics" element={<Navigate to="/evaluate/progress" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function Evaluate() {
  return (
    <EvaluateProvider>
      <EvaluateContent />
    </EvaluateProvider>
  );
}
