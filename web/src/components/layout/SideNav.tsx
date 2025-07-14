import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Layers, MessageSquare, Settings, Menu, X, Brain, ChevronDown, LineChart, Activity, BarChart3, Database, Target, Rocket } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserProfile from './UserProfile';

const trainSteps = [
  { path: '/configure/model', label: 'Select Model' },
  { path: '/configure/data', label: 'Upload Data' },
  { path: '/configure/parameters', label: 'Configure Training' },
  { path: '/progress', label: 'Training Progress' },
];


const evaluateSteps = [
  { path: '/evaluate/test-data', label: 'Evaluate Model' },
  { path: '/evaluate/metrics', label: 'Evaluation Progress' },
  // { path: '/evaluate/compare', label: 'Compare Models' },
];

const predictionSteps = [
  { path: '/prediction/model-selection', label: 'Model Selection' },
  { path: '/prediction/progress', label: 'Prediction Progress' },
];

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Database, label: 'Data Preparation', path: '/data-preparation' },
  { icon: Brain, label: 'Train', path: '/configure', subItems: trainSteps },
  { icon: LineChart, label: 'Evaluate', path: '/evaluate/test-data', subItems: evaluateSteps },
  { icon: Target, label: 'Prediction', path: '/prediction/model-selection', subItems: predictionSteps },
  { icon: MessageSquare, label: 'Chat', path: '/query' },
  { icon: Rocket, label: 'Deploy', path: '/deploy' },
  { icon: Activity, label: 'System Monitor', path: '/monitoring' },
  { icon: Settings, label: 'Settings', path: '/settings' }, 
];

export function SideNav() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Check if current path is a training, evaluation, or prediction step
  const isTrainingPath = trainSteps.some(step => step.path === pathname);
  const isEvaluationPath = evaluateSteps.some(step => step.path === pathname);
  const isPredictionPath = predictionSteps.some(step => step.path === pathname);
  
  // Expand appropriate section based on current path
  useEffect(() => {
    if (isTrainingPath) {
      setExpandedItem('/configure');
    } else if (isEvaluationPath) {
      setExpandedItem('/evaluate/test-data');
    } else if (isPredictionPath) {
      setExpandedItem('/prediction/model-selection');
    }
  }, [pathname, isTrainingPath, isEvaluationPath, isPredictionPath]);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-20 p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      
      <AnimatePresence>
        {(isOpen || true) && (
          <motion.aside
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700",
              "w-60 shrink-0 overflow-y-auto",
              "fixed md:sticky top-0 bottom-0 left-0 z-10 md:z-0",
              isOpen ? "block" : "hidden md:block",
              "md:h-screen"
            )}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">LaaP Studio</h1>
                </div>
                
                <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.path;
                  const isExpanded = expandedItem === item.path;
                  const hasSubItems = !!item.subItems;
                  const isSubItemActive = hasSubItems && item.subItems.some(subItem => subItem.path === pathname);
                  const Icon = item.icon;
                  
                  return (
                    <div key={item.path}>
                      <div
                        onClick={() => {
                          if (hasSubItems) {
                            setExpandedItem(isExpanded ? null : item.path);
                          } else {
                            setIsOpen(false);
                            navigate(item.path);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                          (isActive || isSubItemActive)
                            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 transition-colors",
                          (isActive || isSubItemActive) 
                            ? "text-primary-500" 
                            : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                        )} />
                        <span className="flex-1">{item.label}</span>
                        {hasSubItems && (
                          <ChevronDown 
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "transform rotate-180"
                            )} 
                          />
                        )}
                      </div>
                      
                      {hasSubItems && isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="ml-4 mt-1 space-y-1"
                        >
                          {item.subItems.map((subItem, index) => {
                            const isSubActive = pathname === subItem.path;
                            return (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                  "flex items-center pl-6 py-2 text-sm rounded-lg relative transition-all duration-200 group",
                                  isSubActive
                                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                )}
                              >
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full mr-3 transition-colors",
                                  isSubActive 
                                    ? "bg-primary-500" 
                                    : "bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400"
                                )} />
                                {subItem.label}
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
                </nav>
              </div>
              
              {/* User Profile at bottom */}
              <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700">
                <UserProfile />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
