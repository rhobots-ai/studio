import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { ArrowRight, Upload, FileText, AlertTriangle, Check, X, Info } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Tooltip } from '../components/ui/Tooltip';
import { ModelsGrid } from '../components/models/ModelsGrid';
import { ModelInfo } from '../components/models/ModelCard';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';

// Mock data - in a real app this would come from an API
const baseModels: ModelInfo[] = [
  {
    id: 'mistral-7b-v0.1',
    name: 'Mistral-7B-v0.1',
    description: 'A strong 7B language model that demonstrates strong performance across a range of tasks.',
    size: '7B',
    architecture: 'Mistral',
    isBase: true
  },
  {
    id: 'mistral-7b-instruct-v0.2',
    name: 'Mistral-7B-Instruct-v0.2',
    description: 'Instruction-tuned version of Mistral-7B with improved reasoning capabilities.',
    size: '7B',
    architecture: 'Mistral',
    isBase: true
  },
  {
    id: 'tinyllama-1.1b',
    name: 'TinyLlama-1.1B',
    description: 'Lightweight 1.1B parameters language model trained on diverse internet text corpus.',
    size: '1.1B',
    architecture: 'TinyLlama',
    isBase: true
  },
  {
    id: 'phi-2',
    name: 'Phi-2',
    description: 'Microsoft\'s 2.7B parameter model trained on synthetic and filtered web datasets.',
    size: '2.7B',
    architecture: 'Phi',
    isBase: true
  },
  {
    id: 'llama3-1b',
    name: 'Llama3-1B',
    description: 'Meta\'s 1B parameter model optimized for deployment on resource-constrained devices.',
    size: '1B',
    architecture: 'Llama',
    isBase: true
  },
  {
    id: 'llama3-8b',
    name: 'Llama3-8B',
    description: 'Meta\'s general-purpose 8B parameter model with strong reasoning capabilities.',
    size: '8B',
    architecture: 'Llama',
    isBase: true
  }
];

export default function SelectModel() {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [prompt, setPrompt] = useState('Explain the concept of fine-tuning a language model in simple terms.');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);

  useEffect(() => {
    // Simulate loading models
    const timer = setTimeout(() => {
      setIsLoadingModels(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model);
    setResponse(''); // Clear previous response
  };

  const handleTestModel = () => {
    if (!selectedModel || !prompt.trim()) return;
    
    setIsLoading(true);
    setResponse('');
    
    // Simulate API call with typing effect
    const fullResponse = "Fine-tuning a language model is like teaching an already educated student to specialize in a particular subject. The base model already knows the fundamentals of language and various topics (that's the pre-training), but through fine-tuning, you're giving it additional specialized training on specific data relevant to your needs. This process helps the model better understand your specific domain, style, or requirements without having to train a new model from scratch, which would be much more resource-intensive. It's a way to customize an existing model for your particular use case.";
    
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < fullResponse.length) {
        setResponse(prev => prev + fullResponse.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        setIsLoading(false);
      }
    }, 15);
    
    return () => clearInterval(typingInterval);
  };

  const handleContinue = () => {
    if (selectedModel) {
      // In a real app, store the selected model in state management or context
      setShowTestModal(true);
    }
  };

  const handleSkipTest = () => {
    setShowTestModal(false);
    navigate('/upload-data');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Select Base Model</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Choose a base model to fine-tune or upload your own model
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoadingModels ? (
            <Card className="w-full h-64 flex items-center justify-center">
              <AnimatedLoader variant="orbit" size="lg" text="Loading models..." />
            </Card>
          ) : (
            <ModelsGrid 
              models={baseModels}
              onSelectModel={handleModelSelect}
              selectedModelId={selectedModel?.id}
              filterType="base"
            />
          )}
          
          <div className="mt-6">
            <Card variant="outline">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20">
                    <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Upload Custom Base Model</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Import your own pre-trained models in GGUF or GGML format
                    </p>
                  </div>
                  <Button variant="outline">Upload</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Test Model</CardTitle>
                <Tooltip content="Try the base model before fine-tuning">
                  <Info className="h-4 w-4 text-gray-500 cursor-help" />
                </Tooltip>
              </div>
              <CardDescription>
                Enter a prompt to see how the model responds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt
                  </label>
                  <textarea
                    id="prompt"
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your prompt here..."
                  />
                </div>
                
                {(response || isLoading) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model Response
                    </label>
                    <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 h-32 overflow-auto">
                      {isLoading ? (
                        <AnimatedLoader variant="wave" size="sm" text="Generating response..." />
                      ) : (
                        <p className="text-sm whitespace-pre-line">{response}</p>
                      )}
                    </div>
                  </div>
                )}

                <Button 
                  variant="secondary" 
                  className="w-full"
                  disabled={!selectedModel || isLoading}
                  onClick={handleTestModel}
                  isLoading={isLoading}
                >
                  Test {selectedModel ? selectedModel.name : 'Selected Model'}
                </Button>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button
                variant="primary"
                disabled={!selectedModel}
                onClick={handleContinue}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Continue to Upload Data
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">Test Base Model</h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Try out the base model before fine-tuning to understand its current capabilities.
                This will help you better evaluate the improvements after fine-tuning.
              </p>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Test Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your test prompt here..."
                />
              </div>
              
              {response && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Model Response</label>
                  <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
                    {response}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleSkipTest}
              >
                Skip & Continue
              </Button>
              <Button
                variant="primary"
                onClick={handleTestModel}
                isLoading={isLoading}
              >
                Test Model
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/upload-data')}
                disabled={!response}
              >
                Continue to Upload
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
