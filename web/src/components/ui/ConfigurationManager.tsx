import { useState, useEffect } from 'react';
import { Button } from './Button';
import { SaveConfigModal } from './SaveConfigModal';
import { configService, ConfigMetadata } from '../../services/configService';
import { Save, FolderOpen, Trash2, ChevronDown, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfigurationManagerProps {
  currentConfig: {
    basic_parameters: Record<string, any>;
    advanced_parameters: Record<string, any>;
  };
  onLoadConfig: (config: any) => void;
  currentConfigName?: string;
}

export function ConfigurationManager({ 
  currentConfig, 
  onLoadConfig, 
  currentConfigName = "Default Settings" 
}: ConfigurationManagerProps) {
  const [savedConfigs, setSavedConfigs] = useState<ConfigMetadata[]>([]);
  const [isLoadDropdownOpen, setIsLoadDropdownOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load saved configurations on component mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await configService.listConfigurations();
      setSavedConfigs(response.configs);
    } catch (err) {
      setError('Failed to load configurations');
      console.error('Error loading configurations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (name: string, description: string) => {
    try {
      setIsSaving(true);
      setError(null);
      
      await configService.saveConfiguration({
        name,
        description,
        basic_parameters: currentConfig.basic_parameters,
        advanced_parameters: currentConfig.advanced_parameters,
      });

      setSuccessMessage(`Configuration "${name}" saved successfully!`);
      setIsSaveModalOpen(false);
      
      // Reload configurations list
      await loadConfigurations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadConfig = async (configName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await configService.loadConfiguration(configName);
      onLoadConfig(response.config);
      
      setSuccessMessage(`Configuration "${configName}" loaded successfully!`);
      setIsLoadDropdownOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfig = async (configName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete the configuration "${configName}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await configService.deleteConfiguration(configName);
      setSuccessMessage(`Configuration "${configName}" deleted successfully!`);
      
      // Reload configurations list
      await loadConfigurations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Configuration Management
      </h3>

      {/* Current Configuration */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
          <FileText className="h-4 w-4 mr-1" />
          Current Config:
        </div>
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {currentConfigName}
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 p-2 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md text-sm text-green-800 dark:text-green-200"
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 p-2 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md text-sm text-red-800 dark:text-red-200"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="space-y-2">
        {/* Load Configuration Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setIsLoadDropdownOpen(!isLoadDropdownOpen)}
            disabled={isLoading}
            className="w-full justify-between"
          >
            <div className="flex items-center">
              <FolderOpen className="h-4 w-4 mr-2" />
              Load Saved Config
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isLoadDropdownOpen ? 'rotate-180' : ''}`} />
          </Button>

          <AnimatePresence>
            {isLoadDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto"
              >
                {savedConfigs.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No saved configurations
                  </div>
                ) : (
                  savedConfigs.map((config) => (
                    <div
                      key={config.name}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                      onClick={() => handleLoadConfig(config.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {config.name}
                          </div>
                          {config.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                              {config.description}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(config.created_at)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteConfig(config.name, e)}
                          className="ml-2 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save Current Configuration */}
        <Button
          variant="primary"
          onClick={() => setIsSaveModalOpen(true)}
          disabled={isLoading}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Current Config
        </Button>
      </div>

      {/* Save Configuration Modal */}
      <SaveConfigModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveConfig}
        isLoading={isSaving}
      />
    </div>
  );
}
