import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Plus, X, AlertTriangle } from 'lucide-react';

interface OutputField {
  jsonField: string;
  csvColumn: string;
}

interface OutputMappingInterfaceProps {
  csvColumns: string[];
  onMappingChange: (mapping: Record<string, string>) => void;
  initialMapping?: Record<string, string>;
  className?: string;
}

export function OutputMappingInterface({
  csvColumns,
  onMappingChange,
  initialMapping = {},
  className = ''
}: OutputMappingInterfaceProps) {
  const [outputFields, setOutputFields] = useState<OutputField[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize with existing mapping
  useEffect(() => {
    if (Object.keys(initialMapping).length > 0) {
      const fields = Object.entries(initialMapping).map(([jsonField, csvColumn]) => ({
        jsonField,
        csvColumn
      }));
      setOutputFields(fields);
    } else {
      // Start with one empty field
      setOutputFields([{ jsonField: '', csvColumn: '' }]);
    }
  }, [initialMapping]);

  // Update parent when mapping changes
  useEffect(() => {
    const mapping: Record<string, string> = {};
    const newErrors: string[] = [];
    const usedJsonFields = new Set<string>();
    const usedCsvColumns = new Set<string>();

    outputFields.forEach((field, index) => {
      if (field.jsonField && field.csvColumn) {
        // Check for duplicate JSON field names
        if (usedJsonFields.has(field.jsonField)) {
          newErrors.push(`Duplicate JSON field name: "${field.jsonField}"`);
        } else {
          usedJsonFields.add(field.jsonField);
        }

        // Check for duplicate CSV column mappings
        if (usedCsvColumns.has(field.csvColumn)) {
          newErrors.push(`CSV column "${field.csvColumn}" is mapped to multiple JSON fields`);
        } else {
          usedCsvColumns.add(field.csvColumn);
        }

        mapping[field.jsonField] = field.csvColumn;
      } else if (field.jsonField || field.csvColumn) {
        newErrors.push(`Row ${index + 1}: Both JSON field name and CSV column must be specified`);
      }
    });

    setErrors(newErrors);
    onMappingChange(mapping);
  }, [outputFields, onMappingChange]);

  const addOutputField = () => {
    setOutputFields([...outputFields, { jsonField: '', csvColumn: '' }]);
  };

  const removeOutputField = (index: number) => {
    if (outputFields.length > 1) {
      setOutputFields(outputFields.filter((_, i) => i !== index));
    }
  };

  const updateField = (index: number, key: keyof OutputField, value: string) => {
    const updated = [...outputFields];
    updated[index] = { ...updated[index], [key]: value };
    setOutputFields(updated);
  };

  const getAvailableCsvColumns = (currentIndex: number) => {
    const usedColumns = outputFields
      .map((field, index) => index !== currentIndex ? field.csvColumn : '')
      .filter(Boolean);
    
    return csvColumns.filter(col => !usedColumns.includes(col));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Output Field Mapping</span>
          <span className="text-sm font-normal text-gray-500">
            Map CSV columns to expected JSON fields
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Instructions */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Define which CSV columns contain the expected values for each JSON field that your model should extract.
              For example: map "invoice_number" JSON field to "inv_num" CSV column.
            </p>
          </div>

          {/* Error display */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Mapping Issues:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 mt-1 list-disc pl-4">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Mapping fields */}
          <div className="space-y-3">
            {outputFields.map((field, index) => (
              <div key={index} className="flex gap-3 items-center p-3 border rounded-lg">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    JSON Field Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., invoice_number"
                    value={field.jsonField}
                    onChange={(e) => updateField(index, 'jsonField', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CSV Column
                  </label>
                  <select
                    value={field.csvColumn}
                    onChange={(e) => updateField(index, 'csvColumn', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select CSV column</option>
                    {getAvailableCsvColumns(index).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    {field.csvColumn && !getAvailableCsvColumns(index).includes(field.csvColumn) && (
                      <option value={field.csvColumn}>{field.csvColumn} (current)</option>
                    )}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeOutputField(index)}
                  disabled={outputFields.length === 1}
                  className="mt-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add field button */}
          <Button
            variant="outline"
            onClick={addOutputField}
            className="w-full"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Output Field
          </Button>

          {/* Summary */}
          {outputFields.some(f => f.jsonField && f.csvColumn) && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mapping Summary:
              </p>
              <div className="space-y-1">
                {outputFields
                  .filter(f => f.jsonField && f.csvColumn)
                  .map((field, index) => (
                    <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                      <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                        {field.jsonField}
                      </code>
                      {' ← '}
                      <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                        {field.csvColumn}
                      </code>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default OutputMappingInterface;
