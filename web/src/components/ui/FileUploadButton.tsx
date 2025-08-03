import React, { useRef } from 'react';
import { Paperclip, Upload } from 'lucide-react';
import { Button } from './Button';

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  className?: string;
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onFileSelect,
  disabled = false,
  acceptedTypes = '.pdf,.jpg,.jpeg,.png',
  maxSize = 10, // 10MB default
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File size must be less than ${maxSize}MB`);
        return;
      }

      // Validate file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const allowedTypes = acceptedTypes.split(',').map(type => type.trim().toLowerCase());
      
      if (!allowedTypes.includes(fileExtension)) {
        alert(`Please select a valid file type: ${acceptedTypes}`);
        return;
      }

      onFileSelect(file);
    }
    
    // Reset input value to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleButtonClick}
        disabled={disabled}
        className={`p-2 h-8 w-8 ${className}`}
        title="Upload document (PDF, JPG, PNG)"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
};

export default FileUploadButton;
