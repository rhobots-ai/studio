import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NewDeployment from './NewDeployment';
import ActiveDeployments from './ActiveDeployments';

export default function Deploy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        <Route path="/" element={<Navigate to="/deploy/new" replace />} />
        <Route path="/new" element={<NewDeployment />} />
        <Route path="/active" element={<ActiveDeployments />} />
      </Routes>
    </div>
  );
}
