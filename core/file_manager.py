import os
import json
import uuid
import shutil
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

class FileManager:
    """Manages uploaded training data files with metadata tracking"""
    
    def __init__(self, base_dir: str = "uploaded_files"):
        self.base_dir = Path(base_dir)
        self.files_dir = self.base_dir / "files"
        self.metadata_dir = self.base_dir / "metadata"
        self.previews_dir = self.base_dir / "previews"
        self.metadata_file = self.metadata_dir / "files_metadata.json"
        
        # Create directories if they don't exist
        self._ensure_directories()
        
        # Load existing metadata
        self.metadata = self._load_metadata()
    
    def _ensure_directories(self):
        """Create necessary directories"""
        for directory in [self.files_dir, self.metadata_dir, self.previews_dir]:
            directory.mkdir(parents=True, exist_ok=True)
    
    def _load_metadata(self) -> Dict[str, Any]:
        """Load files metadata from JSON file"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load metadata file: {e}")
                return {}
        return {}
    
    def _save_metadata(self):
        """Save files metadata to JSON file"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"Error saving metadata: {e}")
            raise
    
    def _generate_file_id(self) -> str:
        """Generate unique file ID"""
        return str(uuid.uuid4())
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        import re
        # Remove or replace invalid characters
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Remove leading/trailing spaces and dots
        sanitized = sanitized.strip(' .')
        # Limit length
        if len(sanitized) > 100:
            name, ext = os.path.splitext(sanitized)
            sanitized = name[:96] + ext
        return sanitized
    
    def _validate_file_data(self, file_path: str) -> Dict[str, Any]:
        """Validate uploaded file and return validation details"""
        try:
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.csv':
                df = pd.read_csv(file_path)
                file_type = 'csv'
            elif file_extension == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Convert complex nested objects to JSON strings before creating DataFrame
                def serialize_complex_objects(obj):
                    if isinstance(obj, list):
                        return [serialize_complex_objects(item) for item in obj]
                    elif isinstance(obj, dict):
                        return {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in obj.items()}
                    else:
                        return obj
                
                if isinstance(data, list):
                    # Process each record to handle nested objects
                    processed_data = [serialize_complex_objects(record) for record in data]
                    df = pd.DataFrame(processed_data)
                elif isinstance(data, dict):
                    # Check if it's a dict with list values (columnar format)
                    if data and all(isinstance(v, list) for v in data.values()):
                        df = pd.DataFrame(data)
                    else:
                        # Single object, wrap in list and process
                        processed_data = [serialize_complex_objects(data)]
                        df = pd.DataFrame(processed_data)
                else:
                    raise ValueError("Invalid JSON format")
                file_type = 'json'
            elif file_extension == '.jsonl':
                data = []
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            data.append(json.loads(line))
                df = pd.DataFrame(data)
                file_type = 'jsonl'
            elif file_extension in ['.xlsx', '.xls']:
                # Read Excel file, using first sheet by default
                df = pd.read_excel(file_path, sheet_name=0)
                file_type = 'excel'
            elif file_extension in ['.pkl', '.pickle']:
                # Read pickle file using pandas
                df = pd.read_pickle(file_path)
                # Ensure it's a DataFrame
                if not isinstance(df, pd.DataFrame):
                    raise ValueError("Pickle file must contain a pandas DataFrame")
                file_type = 'pickle'
            else:
                raise ValueError(f"Unsupported file format: {file_extension}")
            
            # Check required columns
            required_columns = ['instruction', 'output']
            optional_columns = ['input']
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            issues = []
            
            if missing_columns:
                issues.append(f"Missing required columns: {missing_columns}")
            
            # Check for null values
            null_counts = {}
            for col in required_columns:
                if col in df.columns:
                    null_count = df[col].isnull().sum()
                    if null_count > 0:
                        null_counts[col] = null_count
                        issues.append(f"Column '{col}' has {null_count} null values")
            
            # Generate sample data for preview
            if len(df) > 0:
                # Convert DataFrame to records, handling complex nested data
                sample_data = []
                for _, row in df.head(10).iterrows():
                    record = {}
                    for col, value in row.items():
                        # Handle complex nested objects by converting to string representation
                        if isinstance(value, (dict, list)):
                            record[col] = str(value)
                        elif pd.isna(value):
                            record[col] = None
                        elif isinstance(value, (pd.Timestamp, pd.NaT.__class__)):
                            record[col] = str(value)
                        else:
                            # Convert numpy types to Python native types
                            if hasattr(value, 'item'):  # numpy scalar
                                record[col] = value.item()
                            else:
                                record[col] = value
                    sample_data.append(record)
            else:
                sample_data = []
            
            validation_status = 'valid' if not issues else 'invalid'
            
            return {
                'status': validation_status,
                'total_rows': len(df),
                'columns': list(df.columns),
                'file_type': file_type,
                'sample_data': sample_data,
                'null_counts': null_counts,
                'issues': issues
            }
            
        except Exception as e:
            return {
                'status': 'invalid',
                'total_rows': 0,
                'columns': [],
                'file_type': 'unknown',
                'sample_data': [],
                'null_counts': {},
                'issues': [f"File validation error: {str(e)}"]
            }
    
    def upload_file(self, file_content: bytes, original_filename: str, display_name: str = None) -> Dict[str, Any]:
        """Upload and store a new file"""
        try:
            # Generate file ID and sanitize filename
            file_id = self._generate_file_id()
            sanitized_filename = self._sanitize_filename(original_filename)
            stored_filename = f"{file_id}_{sanitized_filename}"
            file_path = self.files_dir / stored_filename
            
            # Save file content
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Validate file
            validation_details = self._validate_file_data(str(file_path))
            
            # Create metadata entry
            file_metadata = {
                'file_id': file_id,
                'display_name': display_name or original_filename,
                'original_filename': original_filename,
                'stored_filename': stored_filename,
                'file_type': validation_details['file_type'],
                'file_size': len(file_content),
                'upload_date': datetime.now().isoformat(),
                'last_used': None,
                'usage_count': 0,
                'validation_status': validation_details['status'],
                'validation_details': validation_details,
                'tags': [],
                'used_in_sessions': []
            }
            
            # Save preview data
            if validation_details['sample_data']:
                preview_file = self.previews_dir / f"{file_id}_preview.json"
                with open(preview_file, 'w', encoding='utf-8') as f:
                    json.dump(validation_details['sample_data'], f, indent=2, ensure_ascii=False, default=str)
            
            # Update metadata
            self.metadata[file_id] = file_metadata
            self._save_metadata()
            
            return {
                'success': True,
                'file_id': file_id,
                'file_path': str(file_path),
                'metadata': file_metadata
            }
            
        except Exception as e:
            # Clean up file if it was created
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific file"""
        return self.metadata.get(file_id)
    
    def get_file_path(self, file_id: str) -> Optional[str]:
        """Get the file system path for a file"""
        file_info = self.get_file_info(file_id)
        if file_info:
            file_path = self.files_dir / file_info['stored_filename']
            if file_path.exists():
                return str(file_path)
        return None
    
    def list_files(self, filter_by: str = None, sort_by: str = 'upload_date', sort_desc: bool = True) -> List[Dict[str, Any]]:
        """List all files with optional filtering and sorting"""
        files = list(self.metadata.values())
        
        # Apply filters
        if filter_by:
            if filter_by == 'valid':
                files = [f for f in files if f['validation_status'] == 'valid']
            elif filter_by == 'invalid':
                files = [f for f in files if f['validation_status'] == 'invalid']
            elif filter_by in ['json', 'csv', 'jsonl']:
                files = [f for f in files if f['file_type'] == filter_by]
        
        # Sort files
        if sort_by in ['upload_date', 'last_used', 'usage_count', 'file_size']:
            files.sort(key=lambda x: x.get(sort_by, ''), reverse=sort_desc)
        elif sort_by == 'name':
            files.sort(key=lambda x: x.get('display_name', '').lower(), reverse=sort_desc)
        
        return files
    
    def get_file_preview(self, file_id: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
        """Get preview data for a file"""
        preview_file = self.previews_dir / f"{file_id}_preview.json"
        if preview_file.exists():
            try:
                with open(preview_file, 'r', encoding='utf-8') as f:
                    preview_data = json.load(f)
                return preview_data[:limit]
            except Exception as e:
                print(f"Error loading preview for {file_id}: {e}")
        
        # Fallback: generate preview from file
        file_path = self.get_file_path(file_id)
        if file_path:
            validation_details = self._validate_file_data(file_path)
            return validation_details.get('sample_data', [])[:limit]
        
        return None
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file and its metadata"""
        try:
            file_info = self.get_file_info(file_id)
            if not file_info:
                return False
            
            # Remove file
            file_path = self.files_dir / file_info['stored_filename']
            if file_path.exists():
                os.remove(file_path)
            
            # Remove preview
            preview_file = self.previews_dir / f"{file_id}_preview.json"
            if preview_file.exists():
                os.remove(preview_file)
            
            # Remove from metadata
            del self.metadata[file_id]
            self._save_metadata()
            
            return True
            
        except Exception as e:
            print(f"Error deleting file {file_id}: {e}")
            return False
    
    def update_file_usage(self, file_id: str, session_id: str):
        """Update file usage statistics"""
        if file_id in self.metadata:
            self.metadata[file_id]['usage_count'] += 1
            self.metadata[file_id]['last_used'] = datetime.now().isoformat()
            
            if session_id not in self.metadata[file_id]['used_in_sessions']:
                self.metadata[file_id]['used_in_sessions'].append(session_id)
            
            self._save_metadata()
    
    def revalidate_file(self, file_id: str) -> bool:
        """Re-validate a file and update its metadata"""
        try:
            file_path = self.get_file_path(file_id)
            if not file_path:
                return False
            
            # Re-validate file
            validation_details = self._validate_file_data(file_path)
            
            # Update metadata
            self.metadata[file_id]['validation_status'] = validation_details['status']
            self.metadata[file_id]['validation_details'] = validation_details
            
            # Update preview
            if validation_details['sample_data']:
                preview_file = self.previews_dir / f"{file_id}_preview.json"
                with open(preview_file, 'w', encoding='utf-8') as f:
                    json.dump(validation_details['sample_data'], f, indent=2, ensure_ascii=False, default=str)
            
            self._save_metadata()
            return True
            
        except Exception as e:
            print(f"Error revalidating file {file_id}: {e}")
            return False
    
    def update_file_metadata(self, file_id: str, updates: Dict[str, Any]) -> bool:
        """Update file metadata (display_name, tags, etc.)"""
        try:
            if file_id not in self.metadata:
                return False
            
            # Only allow certain fields to be updated
            allowed_fields = [
                'display_name', 'tags', 'validation_details', 'column_mapping', 
                'has_mapping', 'validation_status', 'last_used', 'usage_count'
            ]
            for field, value in updates.items():
                if field in allowed_fields:
                    self.metadata[file_id][field] = value
            
            self._save_metadata()
            return True
            
        except Exception as e:
            print(f"Error updating file metadata {file_id}: {e}")
            return False
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        total_files = len(self.metadata)
        total_size = sum(f.get('file_size', 0) for f in self.metadata.values())
        
        # Count by type
        type_counts = {}
        for file_info in self.metadata.values():
            file_type = file_info.get('file_type', 'unknown')
            type_counts[file_type] = type_counts.get(file_type, 0) + 1
        
        # Count by validation status
        status_counts = {}
        for file_info in self.metadata.values():
            status = file_info.get('validation_status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'total_files': total_files,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'type_counts': type_counts,
            'status_counts': status_counts
        }

# Global file manager instance
file_manager = FileManager()
