"""
Dataset management service for processed training datasets.
"""

import os
import json
import uuid
import shutil
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from models.dataset_models import (
    ProcessedDataset, DatasetCreateRequest, ProcessingStats,
    DatasetTemplate
)
from models.file_models import ColumnMapping, TrainingExample
from services.column_mapping_service import column_mapping_service
from file_manager import file_manager


class DatasetService:
    """Service for managing processed datasets"""
    
    def __init__(self, datasets_dir: str = "datasets"):
        self.datasets_dir = Path(datasets_dir)
        self.datasets_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        (self.datasets_dir / "data").mkdir(exist_ok=True)
        (self.datasets_dir / "metadata").mkdir(exist_ok=True)
        (self.datasets_dir / "templates").mkdir(exist_ok=True)
        
        self.metadata_file = self.datasets_dir / "datasets_index.json"
        self.templates_file = self.datasets_dir / "templates_index.json"
        
        # Initialize index files if they don't exist
        if not self.metadata_file.exists():
            self._save_datasets_index({})
        if not self.templates_file.exists():
            self._save_templates_index({})
    
    def create_dataset(self, request: DatasetCreateRequest) -> Dict[str, Any]:
        """Create a new processed dataset"""
        try:
            # Generate unique dataset ID
            dataset_id = f"dataset_{uuid.uuid4().hex[:12]}"
            
            # Get source file information
            file_info = file_manager.get_file_info(request.source_file_id)
            if not file_info:
                return {
                    'success': False,
                    'error': 'Source file not found'
                }
            
            # Load and process the source data
            file_path = file_manager.get_file_path(request.source_file_id)
            if not file_path or not os.path.exists(file_path):
                return {
                    'success': False,
                    'error': 'Source file not accessible'
                }
            
            # Load data using the file service's method
            data = self._load_data_file(file_path)
            
            # Apply column mapping to generate training examples
            training_examples = column_mapping_service.apply_mapping(data, request.column_mapping)
            
            if not training_examples:
                return {
                    'success': False,
                    'error': 'No valid training examples generated from the mapping'
                }
            
            # Get processing statistics
            processing_stats = column_mapping_service.get_processing_stats(data, request.column_mapping)
            
            # Save dataset to file
            dataset_file_path = self.datasets_dir / "data" / f"{dataset_id}.json"
            training_data = [example.dict() for example in training_examples]
            
            with open(dataset_file_path, 'w', encoding='utf-8') as f:
                json.dump(training_data, f, indent=2, ensure_ascii=False, default=str)
            
            # Get file size
            file_size = os.path.getsize(dataset_file_path)
            
            # Create dataset metadata
            now = datetime.now().isoformat()
            dataset = ProcessedDataset(
                dataset_id=dataset_id,
                name=request.name,
                description=request.description or "",
                source_file_id=request.source_file_id,
                source_filename=file_info.get('original_filename', 'unknown'),
                column_mapping=request.column_mapping,
                total_examples=len(training_examples),
                processing_stats=ProcessingStats(**processing_stats),
                file_path=str(dataset_file_path),
                file_size=file_size,
                created_at=now,
                last_modified=now,
                tags=request.tags or [],
                usage_count=0,
                last_used=None
            )
            
            # Save metadata
            self._save_dataset_metadata(dataset)
            
            return {
                'success': True,
                'dataset_id': dataset_id,
                'dataset': dataset
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create dataset: {str(e)}'
            }
    
    def list_datasets(
        self, 
        sort_by: str = 'created_at', 
        sort_desc: bool = True,
        filter_tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """List all datasets with optional filtering and sorting"""
        try:
            datasets_index = self._load_datasets_index()
            datasets = []
            
            for dataset_id, metadata in datasets_index.items():
                try:
                    dataset = ProcessedDataset(**metadata)
                    
                    # Apply tag filtering
                    if filter_tags:
                        if not any(tag in dataset.tags for tag in filter_tags):
                            continue
                    
                    datasets.append(dataset)
                except Exception as e:
                    print(f"Warning: Could not load dataset {dataset_id}: {e}")
                    continue
            
            # Sort datasets
            reverse = sort_desc
            if sort_by == 'name':
                datasets.sort(key=lambda x: x.name.lower(), reverse=reverse)
            elif sort_by == 'created_at':
                datasets.sort(key=lambda x: x.created_at, reverse=reverse)
            elif sort_by == 'last_modified':
                datasets.sort(key=lambda x: x.last_modified, reverse=reverse)
            elif sort_by == 'usage_count':
                datasets.sort(key=lambda x: x.usage_count, reverse=reverse)
            elif sort_by == 'total_examples':
                datasets.sort(key=lambda x: x.total_examples, reverse=reverse)
            
            # Calculate storage statistics
            total_datasets = len(datasets)
            total_examples = sum(d.total_examples for d in datasets)
            total_size = sum(d.file_size for d in datasets)
            
            storage_stats = {
                'total_datasets': total_datasets,
                'total_examples': total_examples,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'avg_examples_per_dataset': round(total_examples / total_datasets, 1) if total_datasets > 0 else 0
            }
            
            return {
                'success': True,
                'datasets': datasets,
                'total': total_datasets,
                'storage_stats': storage_stats
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to list datasets: {str(e)}',
                'datasets': [],
                'total': 0,
                'storage_stats': {}
            }
    
    def get_dataset(self, dataset_id: str) -> Optional[ProcessedDataset]:
        """Get a specific dataset by ID"""
        try:
            datasets_index = self._load_datasets_index()
            if dataset_id not in datasets_index:
                return None
            
            return ProcessedDataset(**datasets_index[dataset_id])
        except Exception as e:
            print(f"Error loading dataset {dataset_id}: {e}")
            return None
    
    def get_dataset_data(self, dataset_id: str) -> Optional[List[TrainingExample]]:
        """Load the actual training data for a dataset"""
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return None
            
            if not os.path.exists(dataset.file_path):
                return None
            
            with open(dataset.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return [TrainingExample(**example) for example in data]
        except Exception as e:
            print(f"Error loading dataset data {dataset_id}: {e}")
            return None
    
    def preview_dataset(self, dataset_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get a preview of dataset examples"""
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return {
                    'success': False,
                    'error': 'Dataset not found'
                }
            
            training_data = self.get_dataset_data(dataset_id)
            if training_data is None:
                return {
                    'success': False,
                    'error': 'Dataset data not accessible'
                }
            
            preview_data = training_data[:limit]
            
            return {
                'success': True,
                'dataset_id': dataset_id,
                'preview_data': preview_data,
                'total_examples': len(training_data),
                'showing_examples': len(preview_data)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to preview dataset: {str(e)}'
            }
    
    def update_dataset(self, dataset_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update dataset metadata"""
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return {
                    'success': False,
                    'error': 'Dataset not found'
                }
            
            # Update allowed fields
            if 'name' in updates:
                dataset.name = updates['name']
            if 'description' in updates:
                dataset.description = updates['description']
            if 'tags' in updates:
                dataset.tags = updates['tags']
            
            dataset.last_modified = datetime.now().isoformat()
            
            # Save updated metadata
            self._save_dataset_metadata(dataset)
            
            return {
                'success': True,
                'dataset': dataset
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to update dataset: {str(e)}'
            }
    
    def delete_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Delete a dataset and its data"""
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return {
                    'success': False,
                    'error': 'Dataset not found'
                }
            
            # Delete data file
            if os.path.exists(dataset.file_path):
                os.remove(dataset.file_path)
            
            # Remove from index
            datasets_index = self._load_datasets_index()
            if dataset_id in datasets_index:
                del datasets_index[dataset_id]
                self._save_datasets_index(datasets_index)
            
            return {
                'success': True,
                'message': f'Dataset "{dataset.name}" deleted successfully'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to delete dataset: {str(e)}'
            }
    
    def track_usage(self, dataset_id: str) -> Dict[str, Any]:
        """Track dataset usage for analytics"""
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return {
                    'success': False,
                    'error': 'Dataset not found'
                }
            
            dataset.usage_count += 1
            dataset.last_used = datetime.now().isoformat()
            
            self._save_dataset_metadata(dataset)
            
            return {
                'success': True,
                'dataset_id': dataset_id,
                'usage_count': dataset.usage_count,
                'last_used': dataset.last_used
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to track usage: {str(e)}'
            }
    
    def _load_data_file(self, file_path: str):
        """Load data from file - reuse logic from file_routes"""
        import pandas as pd
        import json
        
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension == '.csv':
            return pd.read_csv(file_path)
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
                return pd.DataFrame(processed_data)
            elif isinstance(data, dict):
                # Check if it's a dict with list values (columnar format)
                if data and all(isinstance(v, list) for v in data.values()):
                    return pd.DataFrame(data)
                else:
                    # Single object, wrap in list and process
                    processed_data = [serialize_complex_objects(data)]
                    return pd.DataFrame(processed_data)
            else:
                raise ValueError("Invalid JSON format")
        elif file_extension == '.jsonl':
            data = []
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
            return pd.DataFrame(data)
        elif file_extension in ['.xlsx', '.xls']:
            # Read Excel file, using first sheet by default
            return pd.read_excel(file_path, sheet_name=0)
        elif file_extension in ['.pkl', '.pickle']:
            # Read pickle file using pandas
            df = pd.read_pickle(file_path)
            # Ensure it's a DataFrame
            if not isinstance(df, pd.DataFrame):
                raise ValueError("Pickle file must contain a pandas DataFrame")
            return df
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
    
    def _load_datasets_index(self) -> Dict[str, Any]:
        """Load datasets index from file"""
        try:
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _save_datasets_index(self, index: Dict[str, Any]):
        """Save datasets index to file"""
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
    
    def _save_dataset_metadata(self, dataset: ProcessedDataset):
        """Save dataset metadata to index"""
        datasets_index = self._load_datasets_index()
        datasets_index[dataset.dataset_id] = dataset.dict()
        self._save_datasets_index(datasets_index)
    
    def _load_templates_index(self) -> Dict[str, Any]:
        """Load templates index from file"""
        try:
            with open(self.templates_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _save_templates_index(self, index: Dict[str, Any]):
        """Save templates index to file"""
        with open(self.templates_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, ensure_ascii=False)


# Global instance
dataset_service = DatasetService()
