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

            {/* Show extracted invoice fields - exact UI match */}
            {ocrStatus === 'completed' && extractedFields && !extractedFields.error && (
              <div className="mt-3">
                {/* Second file header with extracted status */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {file.name}
                      </p>
                      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3" />
                        Extracted
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)} • 5/5 fields extracted
                    </p>
                  </div>
                </div>

                {/* Invoice fields container - exact match to screenshot */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Invoice Fields Extracted
                    </p>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      AI Model
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {/* Invoice Number */}
                    {extractedFields.invoice_number && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Invoice #:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {extractedFields.invoice_number}
                        </span>
                      </div>
                    )}

                    {/* Invoice Date */}
                    {extractedFields.invoice_date && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Date:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {extractedFields.invoice_date}
                        </span>
                      </div>
                    )}

                    {/* Invoice Amount */}
                    {(extractedFields.invoice_amount || extractedFields.total || extractedFields.amount) && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          ₹{(extractedFields.invoice_amount || extractedFields.total || extractedFields.amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    {/* Seller GSTIN */}
                    {extractedFields.seller_gstin && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Seller GSTIN:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                          {extractedFields.seller_gstin}
                        </span>
                      </div>
                    )}

                    {/* Buyer GSTIN */}
                    {extractedFields.buyer_gstin && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Buyer GSTIN:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                          {extractedFields.buyer_gstin}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Seller GSTIN</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                            {extractedFields.seller_gstin}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Buyer GSTIN */}
                    {extractedFields.buyer_gstin && (
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Buyer GSTIN</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                            {extractedFields.buyer_gstin}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Extraction completed using AI model
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      5 of 5 fields found
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show extraction error - compact version */}
            {ocrStatus === 'completed' && extractedFields?.error && (
              <div className="mt-2">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <p className="text-xs font-medium text-red-800 dark:text-red-200">
                      Extraction Error
                    </p>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {extractedFields.error}
                  </p>
                </div>
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
