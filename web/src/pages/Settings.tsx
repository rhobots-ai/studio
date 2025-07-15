import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { Key, Shield, Save, HardDrive, Cloud, Globe, Lock, AlertTriangle, Info, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Settings() {
  const [apiKeys, setApiKeys] = useState({
    appKey: 'sk_live_•••••••••••••••••••••••••••',
    secondaryKey: '',
  });
  
  const [modelSettings, setModelSettings] = useState({
    cacheResults: true,
    logPredictions: true,
    defaultDownloadFormat: 'gguf',
    defaultPrecision: 'f16',
  });
  
  const [deploymentSettings, setDeploymentSettings] = useState({
    apiEndpointEnabled: true,
    publicModelAccess: false,
    authRequired: true,
    rateLimit: 100,
  });

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const handleModelSettingChange = (key: string, value: boolean | string) => {
    setModelSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const handleDeploymentSettingChange = (key: string, value: boolean | number) => {
    setDeploymentSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const regenerateKey = () => {
    // In a real app, this would make an API call to regenerate the key
    toast.success('API key has been regenerated');
    setApiKeys(prev => ({
      ...prev,
      appKey: 'sk_live_' + Math.random().toString(36).substring(2, 15) + '•••••••••'
    }));
  };
  
  const handleSaveSettings = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account and fine-tuning preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary-500" />
                <CardTitle>API Keys</CardTitle>
              </div>
              <CardDescription>
                Manage API keys for programmatic access to models and services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="appKey" className="block text-sm font-medium mb-1">
                  Primary API Key
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="appKey"
                    value={apiKeys.appKey}
                    onChange={(e) => handleApiKeyChange('appKey', e.target.value)}
                    className="flex-1 rounded-l-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    readOnly
                  />
                  <Button 
                    variant="primary" 
                    className="rounded-l-none"
                    onClick={regenerateKey}
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This key has full access to your account and models. Keep it secure.
                </p>
              </div>
              
              <div>
                <label htmlFor="secondaryKey" className="block text-sm font-medium mb-1">
                  Secondary API Key (Optional)
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="secondaryKey"
                    value={apiKeys.secondaryKey}
                    onChange={(e) => handleApiKeyChange('secondaryKey', e.target.value)}
                    className="flex-1 rounded-l-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="No secondary key configured"
                  />
                  <Button 
                    variant="outline" 
                    className="rounded-l-none"
                  >
                    Generate
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Use for public endpoints with restricted permissions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary-500" />
                <CardTitle>Security Settings</CardTitle>
              </div>
              <CardDescription>
                Configure security preferences for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="twoFactor"
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="twoFactor" className="block text-sm font-medium">
                      Two-Factor Authentication
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Recommended</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="accessLogs"
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    defaultChecked
                  />
                  <div>
                    <label htmlFor="accessLogs" className="block text-sm font-medium">
                      API Usage Logging
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Log all API requests and model interactions
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="ipRestriction"
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="ipRestriction" className="block text-sm font-medium">
                      IP Address Restrictions
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Limit API access to specific IP addresses
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary-500" />
                <CardTitle>Model Settings</CardTitle>
              </div>
              <CardDescription>
                Configure how your models are stored and accessed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="cacheResults"
                      checked={modelSettings.cacheResults}
                      onChange={(e) => handleModelSettingChange('cacheResults', e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="cacheResults" className="block text-sm font-medium">
                        Cache Model Results
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Store recent inference results to improve performance
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="logPredictions"
                      checked={modelSettings.logPredictions}
                      onChange={(e) => handleModelSettingChange('logPredictions', e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="logPredictions" className="block text-sm font-medium">
                        Log Model Predictions
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Save all model inputs and outputs for analysis
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <label htmlFor="downloadFormat" className="block text-sm font-medium mb-1">
                    Default Download Format
                  </label>
                  <select
                    id="downloadFormat"
                    value={modelSettings.defaultDownloadFormat}
                    onChange={(e) => handleModelSettingChange('defaultDownloadFormat', e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="gguf">GGUF (Recommended)</option>
                    <option value="ggml">GGML (Legacy)</option>
                    <option value="safetensors">SafeTensors</option>
                    <option value="pytorch">PyTorch</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="precision" className="block text-sm font-medium mb-1">
                    Default Quantization Precision
                  </label>
                  <select
                    id="precision"
                    value={modelSettings.defaultPrecision}
                    onChange={(e) => handleModelSettingChange('defaultPrecision', e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="f16">F16 (High accuracy, larger size)</option>
                    <option value="q4_k">Q4_K (Good balance)</option>
                    <option value="q4_0">Q4_0 (Smaller size, lower accuracy)</option>
                    <option value="q8_0">Q8_0 (Medium balance)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary-500" />
                <CardTitle>Deployment Settings</CardTitle>
              </div>
              <CardDescription>
                Configure how your models are served
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="apiEndpointEnabled"
                    checked={deploymentSettings.apiEndpointEnabled}
                    onChange={(e) => handleDeploymentSettingChange('apiEndpointEnabled', e.target.checked)}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <div className="flex items-center">
                      <label htmlFor="apiEndpointEnabled" className="block text-sm font-medium">
                        API Endpoint
                      </label>
                      <Tooltip content="Enable RESTful API access to your models">
                        <Info className="h-4 w-4 ml-1 text-gray-400" />
                      </Tooltip>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enable API access to your fine-tuned models
                    </p>
                  </div>
                </div>
              </div>
              
              {deploymentSettings.apiEndpointEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pl-7 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="authRequired"
                        checked={deploymentSettings.authRequired}
                        onChange={(e) => handleDeploymentSettingChange('authRequired', e.target.checked)}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div>
                        <label htmlFor="authRequired" className="block text-sm font-medium">
                          Require Authentication
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="publicModelAccess"
                        checked={deploymentSettings.publicModelAccess}
                        onChange={(e) => handleDeploymentSettingChange('publicModelAccess', e.target.checked)}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div>
                        <div className="flex items-center">
                          <label htmlFor="publicModelAccess" className="block text-sm font-medium">
                            Public Model Access
                          </label>
                          {deploymentSettings.publicModelAccess && !deploymentSettings.authRequired && (
                            <Badge variant="error" size="sm" className="ml-2">Insecure</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="rateLimit" className="block text-sm font-medium mb-1">
                      Rate Limit (requests/minute)
                    </label>
                    <input
                      type="number"
                      id="rateLimit"
                      value={deploymentSettings.rateLimit}
                      onChange={(e) => handleDeploymentSettingChange('rateLimit', parseInt(e.target.value))}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  
                  {deploymentSettings.publicModelAccess && !deploymentSettings.authRequired && (
                    <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-md flex items-start gap-2 text-xs text-error-800 dark:text-error-300">
                      <AlertTriangle className="h-4 w-4 text-error-500 flex-shrink-0 mt-0.5" />
                      <span>
                        Public access without authentication is insecure. We recommend enabling authentication for all API endpoints.
                      </span>
                    </div>
                  )}
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <h4 className="text-xs font-medium mb-1 flex items-center">
                      <Globe className="h-4 w-4 mr-1 text-gray-500" />
                      API Endpoint URL
                    </h4>
                    <div className="flex items-center">
                      <code className="text-xs bg-white dark:bg-gray-700 p-1.5 rounded border border-gray-200 dark:border-gray-600 flex-1 overflow-x-auto">
                        https://api.llmstudio.dev/models/12345/generate
                      </code>
                      <Button variant="ghost" size="sm" className="ml-2">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="streamingEnabled"
                    defaultChecked
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="streamingEnabled" className="block text-sm font-medium">
                      Streaming Responses
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Stream tokens as they're generated
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t">
              <Button
                variant="primary"
                className="w-full"
                leftIcon={<Save className="h-4 w-4" />}
                onClick={handleSaveSettings}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary-500" />
                <CardTitle>Privacy & Data</CardTitle>
              </div>
              <CardDescription>
                Control how your data is used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="dataSharingOpt"
                      defaultChecked={false}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="dataSharingOpt" className="block text-sm font-medium">
                        Data Usage Opt-In
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow anonymous usage data to improve our service
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="modelDataRetention"
                      defaultChecked
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="modelDataRetention" className="block text-sm font-medium">
                        Model Input Retention
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Store model inputs for debugging and fine-tuning
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
                
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-300 hover:bg-error-50 dark:hover:bg-error-900/20">
                    Delete All Model Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}