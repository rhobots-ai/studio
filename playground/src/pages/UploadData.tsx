import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, FileText, AlertTriangle, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface FileWithPreview extends File {
  preview?: string;
}


export default function UploadData() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Convert to base64 and remove data URL prefix
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const storeFile = async (file: File) => {
    try {
      const content = await readFileContent(file);
      
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        content // This is now base64 encoded
      };
      
      localStorage.setItem('trainingFile', JSON.stringify(fileData));
    } catch (error) {
      console.error('Error reading file:', error);
      setValidationMessages(['Error reading file. Please try again.']);
      setValidationStatus('invalid');
    }
  };

  const handleContinue = async () => {
    if (!selectedFile) return;
    
    // The file is already stored by storeFile() during upload
    navigate('/configure');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 5,
    maxSize: 500 * 1024 * 1024, // 500MB
    onDrop: async (acceptedFiles, rejectedFiles) => {
      setFiles([...files, ...acceptedFiles]);

      // Store the first accepted file
      if (acceptedFiles.length > 0) {
        await storeFile(acceptedFiles[0]);
      }
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }

      // Reset validation state
      setValidationStatus('idle');
      setValidationMessages([]);
      
      if (rejectedFiles.length > 0) {
        const errorMessages = rejectedFiles.map(file => {
          if (file.errors[0].code === 'file-too-large') {
            return `${file.file.name} is too large (max 50MB)`;
          }
          if (file.errors[0].code === 'file-invalid-type') {
            return `${file.file.name} has an unsupported file type`;
          }
          return `${file.file.name} could not be uploaded`;
        });
        setValidationMessages(errorMessages);
      }
    },
  });

  const removeFile = (name: string) => {
    setFiles(files.filter(file => file.name !== name));
    if (selectedFile?.name === name) {
      setSelectedFile(null);
    }
    // Reset validation if all files are removed
    if (files.length === 1) {
      setValidationStatus('idle');
      setValidationMessages([]);
    }
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const nextProgress = prev + 5;
        if (nextProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return nextProgress;
      });
    }, 100);
    
    return () => clearInterval(interval);
  };

  const validateFiles = () => {
    if (files.length === 0) {
      setValidationMessages(['Please upload at least one file']);
      setValidationStatus('invalid');
      return;
    }

    setValidationStatus('validating');
    
    // Simulate validation process
    simulateUpload();
    
    setTimeout(() => {
      // For demo purposes, let's say JSON files are valid, others need warnings
      const hasNonJsonFiles = files.some(file => !file.name.endsWith('.json'));
      
      if (hasNonJsonFiles) {
        setValidationStatus('invalid');
        setValidationMessages([
          'Some files may need reformatting to match the required instruction → response format',
          'CSV files should have "instruction" and "response" columns',
          'Text files should have instruction/response pairs separated by delimiters'
        ]);
      } else {
        setValidationStatus('valid');
        setValidationMessages(['All files validated successfully']);
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Training Data</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Provide data to fine-tune your model with
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Data Files</CardTitle>
              <CardDescription>
                Upload JSON, CSV, or text files containing instruction-response pairs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20">
                    <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop the files here' : 'Drag & drop files here or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      JSON, CSV, or TXT files, up to 50MB each
                    </p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Uploaded Files</h4>
                  <ul className="space-y-3">
                    {files.map((file) => (
                      <motion.li 
                        key={file.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md"
                      >
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 mr-3 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(file.name)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          aria-label="Remove file"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {validationStatus === 'validating' && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Validating files...</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300 ease-in-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {validationMessages.length > 0 && validationStatus !== 'validating' && (
                <div className={`mt-6 p-4 rounded-md ${validationStatus === 'valid' ? 'bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200' : 'bg-warning-50 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200'}`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {validationStatus === 'valid' ? (
                        <Check className="h-5 w-5 text-success-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning-500" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium">
                        {validationStatus === 'valid' ? 'Validation Successful' : 'Validation Warnings'}
                      </h3>
                      <div className="mt-2 text-sm">
                        <ul className="list-disc pl-5 space-y-1">
                          {validationMessages.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={validateFiles}
                  disabled={files.length === 0 || validationStatus === 'validating'}
                  isLoading={validationStatus === 'validating'}
                >
                  Validate Files
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example Data Format</CardTitle>
              <CardDescription>
                Your training data should follow these formats for optimal results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">JSON Format (Recommended)</h3>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs overflow-auto">
{`[
  {
    "instruction": "Explain how photosynthesis works.",
    "response": "Photosynthesis is the process where plants convert sunlight, water, and carbon dioxide into oxygen and glucose. The glucose serves as food for the plant, while the oxygen is released into the atmosphere."
  },
  {
    "instruction": "What is the capital of France?",
    "response": "The capital of France is Paris."
  }
]`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">CSV Format</h3>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs overflow-auto">
{`instruction,response
"Explain how photosynthesis works.","Photosynthesis is the process where plants convert sunlight, water, and carbon dioxide into oxygen and glucose. The glucose serves as food for the plant, while the oxygen is released into the atmosphere."
"What is the capital of France?","The capital of France is Paris."`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Plain Text Format</h3>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs overflow-auto">
{`### INSTRUCTION:
Explain how photosynthesis works.

### RESPONSE:
Photosynthesis is the process where plants convert sunlight, water, and carbon dioxide into oxygen and glucose. The glucose serves as food for the plant, while the oxygen is released into the atmosphere.

### INSTRUCTION:
What is the capital of France?

### RESPONSE:
The capital of France is Paris.`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Training Data Guidelines</CardTitle>
              <CardDescription>
                Recommendations for optimal fine-tuning results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 text-primary-600 dark:text-primary-400">✓</span>
                  <span>Aim for <strong>300-1000 examples</strong> for good results</span>
                </li>
                <li className="flex space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 text-primary-600 dark:text-primary-400">✓</span>
                  <span>Use diverse and representative examples</span>
                </li>
                <li className="flex space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 text-primary-600 dark:text-primary-400">✓</span>
                  <span>Ensure clear instructions with specific responses</span>
                </li>
                <li className="flex space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 text-primary-600 dark:text-primary-400">✓</span>
                  <span>Balance instruction length (10-100 words ideal)</span>
                </li>
                <li className="flex space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 text-primary-600 dark:text-primary-400">✓</span>
                  <span>Check for consistent formatting and style</span>
                </li>
              </ul>

              <div className="mt-6 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-md">
                <h4 className="text-sm font-medium text-warning-800 dark:text-warning-200 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Common Issues
                </h4>
                <ul className="mt-2 text-sm text-warning-700 dark:text-warning-300 space-y-2 pl-6 list-disc">
                  <li>Missing or inconsistent format between examples</li>
                  <li>Instructions that are too vague or too complex</li>
                  <li>Too few examples for effective training</li>
                  <li>Low-quality or contradictory examples</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/select-model')}
            >
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              disabled={validationStatus !== 'valid'}
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}