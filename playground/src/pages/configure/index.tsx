import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigureProvider, useConfigureContext } from './ConfigureContext';
import SelectModel from './SelectModel';
import UploadData from './UploadData';
import ConfigureParameters from './ConfigureParameters';

function ConfigureContent() {
  const { state, dispatch } = useConfigureContext();
  const location = useLocation();

  // Update current step based on route
  useEffect(() => {
    const path = location.pathname;
    let targetStep = 1;
    
    if (path.includes('/configure/model')) {
      targetStep = 1;
    } else if (path.includes('/configure/data')) {
      targetStep = 2;
    } else if (path.includes('/configure/parameters')) {
      targetStep = 3;
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
          <Route path="/" element={<Navigate to="/configure/model" replace />} />
          <Route path="/model" element={<SelectModel />} />
          <Route path="/data" element={<UploadData />} />
          <Route path="/parameters" element={<ConfigureParameters />} />
        </Routes>
      </div>
    </div>
  );
}

export default function Configure() {
  return (
    <ConfigureProvider>
      <ConfigureContent />
    </ConfigureProvider>
  );
}
