import React from 'react';
import { CheckCircle, AlertCircle, FileText, Calendar, DollarSign, Building2, Hash } from 'lucide-react';
import { Badge } from './Badge';
import { Card } from './Card';

interface InvoiceField {
  label: string;
  value: string | number | null;
  icon: React.ReactNode;
  type?: 'text' | 'date' | 'currency' | 'gstin';
}

interface InvoiceFieldsPreviewProps {
  extractedFields: any;
  fileName: string;
  fileSize: string;
  extractionMethod?: string;
  hasError?: boolean;
  errorMessage?: string;
}

export const InvoiceFieldsPreview: React.FC<InvoiceFieldsPreviewProps> = ({
  extractedFields,
  fileName,
  fileSize,
  extractionMethod = 'trained_model',
  hasError = false,
  errorMessage
}) => {
  const formatValue = (value: any, type?: string): string => {
    if (value === null || value === undefined || value === '') {
      return 'Not found';
    }

    switch (type) {
      case 'currency':
        if (typeof value === 'number') {
          return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
        return `₹${value}`;
      case 'date':
        // Try to format date if it's in YYYY-MM-DD format
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const date = new Date(value);
          return date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        }
        return value.toString();
      case 'gstin':
        // Format GSTIN with proper spacing
        if (typeof value === 'string' && value.length === 15) {
          return `${value.slice(0, 2)} ${value.slice(2, 7)} ${value.slice(7, 11)} ${value.slice(11, 12)} ${value.slice(12, 13)} ${value.slice(13, 14)} ${value.slice(14, 15)}`;
        }
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getFieldColor = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'text-gray-400 dark:text-gray-500';
    }
    return 'text-gray-900 dark:text-gray-100';
  };

  // Define the invoice fields to display
  const invoiceFields: InvoiceField[] = [
    {
      label: 'Invoice Number',
      value: extractedFields?.invoice_number || extractedFields?.invoice_no,
      icon: <Hash className="h-4 w-4" />,
      type: 'text'
    },
    {
      label: 'Invoice Date',
      value: extractedFields?.invoice_date,
      icon: <Calendar className="h-4 w-4" />,
      type: 'date'
    },
    {
      label: 'Invoice Amount',
      value: extractedFields?.invoice_amount || extractedFields?.total || extractedFields?.amount,
      icon: <DollarSign className="h-4 w-4" />,
      type: 'currency'
    },
    {
      label: 'Seller GSTIN',
      value: extractedFields?.seller_gstin,
      icon: <Building2 className="h-4 w-4" />,
      type: 'gstin'
    },
    {
      label: 'Buyer GSTIN',
      value: extractedFields?.buyer_gstin,
      icon: <Building2 className="h-4 w-4" />,
      type: 'gstin'
    }
  ];

  const getStatusBadge = () => {
    if (hasError) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="h-3 w-3" />
        Extracted
      </Badge>
    );
  };

  const extractedCount = invoiceFields.filter(field => 
    field.value !== null && field.value !== undefined && field.value !== ''
  ).length;

  return (
    <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {fileName}
              </p>
              {getStatusBadge()}
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {fileSize} • {extractedCount}/5 fields extracted
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {hasError && errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Invoice Fields */}
      {!hasError && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Extracted Invoice Fields
            </p>
            <Badge variant="outline" className="text-xs">
              {extractionMethod === 'trained_model' ? 'AI Model' : 'OCR'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {invoiceFields.map((field, index) => (
              <div key={index} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                  {field.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {field.label}
                  </p>
                  <p className={`text-sm font-medium ${getFieldColor(field.value)} truncate`}>
                    {formatValue(field.value, field.type)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Extraction completed using {extractionMethod === 'trained_model' ? 'AI model' : 'OCR'}</span>
              <span>{extractedCount} of 5 fields found</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default InvoiceFieldsPreview;
