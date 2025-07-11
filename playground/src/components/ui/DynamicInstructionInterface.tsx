import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';
import { Upload, FileText, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../utils/cn';
import { evaluationService } from '../../services/evaluationService';

interface DynamicInstructionInterfaceProps {
  availableColumns: string[];
  instructionSource: 'static' | 'column' | 'file';
  instructionColumn?: string;
  instructionFile?: File;
  staticInstruction?: string;
  instructionFileMapping?: Record<string, string>;
  onInstructionConfigChange: (config: {
    instruction_source: 'static' | 'column' | 'file';
    instruction_column?: string;
    instruction_file_content?: string;
    instruction_file_type?: 'json' | 'csv' | 'jsonl';
    instruction_file_mapping?: Record<string, string>;
    static_instruction?: string;
  }) => void;
}

export default function DynamicInstructionInterface({
  availableColumns,
  instructionSource,
  instructionColumn,
  instructionFile,
  staticInstruction,
  instructionFileMapping,
  onInstructionConfigChange
}: DynamicInstructionInterfaceProps) {
  const [selectedSource, setSelectedSource] = useState<'static' | 'column' | 'file'>(instructionSource);
  const [selectedColumn, setSelectedColumn] = useState(instructionColumn || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(instructionFile || null);
  const [staticInstructionText, setStaticInstructionText] = useState(staticInstruction || '');
  const [fileMapping, setFileMapping] = useState<Record<string, string>>(instructionFileMapping || {});
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // File upload handling
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/jsonl': ['.jsonl']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setUploadedFile(file);
        setError(null);
        await analyzeInstructionFile(file);
      }
    }
  });

  const analyzeInstructionFile = async (file: File) => {
    try {
      setIsAnalyzingFile(true);
      const fileType = evaluationService.getFileType(file.name);
      if (!fileType || !['json', 'csv', 'jsonl'].includes(fileType)) {
        throw new Error('Unsupported file type. Please upload JSON, CSV, or JSONL files.');
      }

      const base64Content = await evaluationService.fileToBase64(file);
      const analysis = await evaluationService.analyzeFileColumns(base64Content, fileType as any);
      
      setFileAnalysis({
        ...analysis,
        fileType,
        base64Content
      });

      // Update configuration
      updateConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze instruction file');
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  const updateConfiguration = () => {
    const config: any = {
      instruction_source: selectedSource
    };

    if (selectedSource === 'column') {
      config.instruction_column = selectedColumn;
    } else if (selectedSource === 'file' && uploadedFile && fileAnalysis) {
      config.instruction_file_content = fileAnalysis.base64Content;
      config.instruction_file_type = fileAnalysis.fileType;
      config.instruction_file_mapping = fileMapping;
    } else if (selectedSource === 'static') {
      config.static_instruction = staticInstructionText;
    }

    onInstructionConfigChange(config);
  };

  useEffect(() => {
    updateConfiguration();
  }, [selectedSource, selectedColumn, staticInstructionText, fileMapping, uploadedFile, fileAnalysis]);

  const renderSourceSelection = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Instruction Source</label>
        <div className="grid grid-cols-1 gap-3">
          {/* Static Instruction Option */}
          <div
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-all",
              selectedSource === 'static'
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
            onClick={() => setSelectedSource('static')}
          >
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                checked={selectedSource === 'static'}
                onChange={() => setSelectedSource('static')}
                className="h-4 w-4 text-primary-600"
              />
              <div>
                <div className="font-medium">Static Instruction</div>
                <div className="text-sm text-gray-500">Use the same instruction for all rows</div>
              </div>
            </div>
          </div>

          {/* Column-based Instruction Option */}
          <div
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-all",
              selectedSource === 'column'
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
            onClick={() => setSelectedSource('column')}
          >
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                checked={selectedSource === 'column'}
                onChange={() => setSelectedSource('column')}
                className="h-4 w-4 text-primary-600"
              />
              <div>
                <div className="font-medium">Column-based Instructions</div>
                <div className="text-sm text-gray-500">Each row has its own instruction in a column</div>
              </div>
            </div>
          </div>

          {/* File-based Instruction Option */}
          <div
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-all",
              selectedSource === 'file'
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
            onClick={() => setSelectedSource('file')}
          >
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                checked={selectedSource === 'file'}
                onChange={() => setSelectedSource('file')}
                className="h-4 w-4 text-primary-600"
              />
              <div>
                <div className="font-medium">External Instruction File</div>
                <div className="text-sm text-gray-500">Load instructions from a separate file</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaticInstructionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Static Instruction</label>
        <textarea
          value={staticInstructionText}
          onChange={(e) => setStaticInstructionText(e.target.value)}
          placeholder="Enter the instruction that will be used for all rows..."
          className="w-full h-32 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-vertical"
        />
        <div className="mt-2 text-xs text-gray-500">
          This instruction will be applied to every row in your dataset.
        </div>
      </div>
    </div>
  );

  const renderColumnInstructionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Instruction Column</label>
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Select column containing instructions...</option>
          {availableColumns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-gray-500">
          Select the column that contains different instructions for each row.
        </div>
      </div>

      {selectedColumn && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <div className="font-medium">Column-based Instructions</div>
              <div className="mt-1">
                Each row will use the instruction from the "{selectedColumn}" column. 
                If a row has an empty instruction, it will fall back to the default static instruction.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFileInstructionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Upload Instruction File</label>
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
              : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <div className="text-sm">
              {isDragActive ? (
                "Drop the instruction file here"
              ) : (
                "Drag & drop instruction file or click to browse"
              )}
            </div>
            <div className="text-xs text-gray-500">
              Supports JSON, CSV, and JSONL files
            </div>
          </div>
        </div>
      </div>

      {uploadedFile && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <div className="text-sm font-medium">{uploadedFile.name}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUploadedFile(null);
                setFileAnalysis(null);
                setFileMapping({});
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {isAnalyzingFile && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
          <span>Analyzing instruction file...</span>
        </div>
      )}

      {fileAnalysis && (
        <div className="space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <div className="text-sm text-green-700 dark:text-green-300">
                <div className="font-medium">File analyzed successfully</div>
                <div className="mt-1">
                  Found {fileAnalysis.totalRows} instruction entries with columns: {fileAnalysis.columns.join(', ')}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instruction File Mapping</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Key Field (maps to dataset)</label>
                <select
                  value={fileMapping.key || ''}
                  onChange={(e) => setFileMapping({ ...fileMapping, key: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select key field...</option>
                  {availableColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Instruction Field (from file)</label>
                <select
                  value={fileMapping.instruction || ''}
                  onChange={(e) => setFileMapping({ ...fileMapping, instruction: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select instruction field...</option>
                  {fileAnalysis.columns.map((column: string) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Map how the instruction file connects to your dataset rows.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <div className="font-medium">Error</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderSourceSelection()}
      
      {selectedSource === 'static' && renderStaticInstructionConfig()}
      {selectedSource === 'column' && renderColumnInstructionConfig()}
      {selectedSource === 'file' && renderFileInstructionConfig()}

      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h4 className="text-xs font-medium mb-2">💡 Dynamic Instructions</h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>• <strong>Static:</strong> Same instruction for all rows</li>
          <li>• <strong>Column:</strong> Each row has its own instruction</li>
          <li>• <strong>File:</strong> External instruction file mapped to dataset</li>
        </ul>
      </div>
    </div>
  );
}
