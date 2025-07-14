import { useState } from 'react';
import { ModelCard, ModelInfo } from './ModelCard';
import { Badge } from '../ui/Badge';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

interface ModelsGridProps {
  models: ModelInfo[];
  onSelectModel: (model: ModelInfo) => void;
  selectedModelId?: string;
  filterType?: 'all' | 'base' | 'fine-tuned';
}

export function ModelsGrid({ 
  models, 
  onSelectModel, 
  selectedModelId,
  filterType = 'all'
}: ModelsGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          model.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'base') return matchesSearch && model.isBase;
    if (filterType === 'fine-tuned') return matchesSearch && !model.isBase;
    
    return matchesSearch;
  });
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex space-x-2">
          <Badge 
            variant={filterType === 'all' ? 'primary' : 'outline'} 
            className="cursor-pointer"
            onClick={() => {/* Set filter to 'all' */}}
          >
            All Models
          </Badge>
          <Badge 
            variant={filterType === 'base' ? 'primary' : 'outline'} 
            className="cursor-pointer"
            onClick={() => {/* Set filter to 'base' */}}
          >
            Base Models
          </Badge>
          <Badge 
            variant={filterType === 'fine-tuned' ? 'primary' : 'outline'} 
            className="cursor-pointer"
            onClick={() => {/* Set filter to 'fine-tuned' */}}
          >
            Fine-tuned
          </Badge>
        </div>
      </div>
      
      {filteredModels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 0a2 2 0 102 2h.01M3 16l3-3m0 0 3 3m-3-3v7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No models found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filters to find what you're looking for.
          </p>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredModels.map((model) => (
            <motion.div key={model.id} variants={item}>
              <ModelCard 
                model={model} 
                onClick={() => onSelectModel(model)}
                isSelected={selectedModelId === model.id}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}