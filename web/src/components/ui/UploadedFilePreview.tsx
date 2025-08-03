import React from 'react';
import { X, FileText, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { InvoiceFieldsPreview } from './InvoiceFieldsPreview';

interface UploadedFilePreviewProps {
  file: File;
  ocrStatus: 'uploading' | 'processing' | 'completed' | 'error';
  ocrText?: string;
  error?: string;
  extractedFields?: any;
  extractionMethod?: string;
  onRemove: () => void;
}

export const UploadedFilePreview: React.FC<UploadedFilePreviewProps> = ({
  file,
  ocrStatus,
  ocrText,
  error,
  extractedFields,
  extractionMethod,
  onRemove
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    const fileType = file.type;
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getStatusBadge = () => {
    switch (ocrStatus) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading...
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Extracting text...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3" />
            Ready
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {getFileIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {file.name}
              </p>
              {getStatusBadge()}
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {formatFileSize(file.size)}
            </p>

            {/* Show error message */}
            {ocrStatus === 'error' && error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                {error}
              </p>
            )}

            {/* Show OCR text preview */}
            {ocrStatus === 'completed' && ocrText && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded p-2 mt-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Extracted text preview:</p>
                <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3">
                  {ocrText.length > 200 ? `${ocrText.substring(0, 200)}...` : ocrText}
                </p>
              </div>
            )}

            {/* Show extracted invoice fields */}
            {ocrStatus === 'completed' && extractedFields && !extractedFields.error && (
              <div className="mt-3">
                <InvoiceFieldsPreview
                  extractedFields={extractedFields}
                  fileName={file.name}
                  fileSize={formatFileSize(file.size)}
                  extractionMethod={extractionMethod}
                  hasError={false}
                />
              </div>
            )}

            {/* Show extraction error */}
            {ocrStatus === 'completed' && extractedFields?.error && (
              <div className="mt-3">
                <InvoiceFieldsPreview
                  extractedFields={{}}
                  fileName={file.name}
                  fileSize={formatFileSize(file.size)}
                  extractionMethod={extractionMethod}
                  hasError={true}
                  errorMessage={extractedFields.error}
                />
              </div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="p-1 h-6 w-6 ml-2 flex-shrink-0"
          title="Remove file"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default UploadedFilePreview;
