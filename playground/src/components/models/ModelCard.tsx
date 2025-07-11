import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: string;
  architecture: string;
  creationDate?: string;
  isBase?: boolean;
  baseModelId?: string;
}

interface ModelCardProps {
  model: ModelInfo;
  onClick?: () => void;
  isSelected?: boolean;
}

export function ModelCard({ model, onClick, isSelected }: ModelCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      whileTap={{ y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={cn(
          "h-full cursor-pointer transition-colors",
          isSelected ? "ring-2 ring-primary-500 dark:ring-primary-400" : "",
        )}
        onClick={onClick}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold line-clamp-1">{model.name}</CardTitle>
            {model.isBase ? (
              <Badge variant="primary" size="sm">Base Model</Badge>
            ) : (
              <Badge variant="secondary" size="sm">Fine-tuned</Badge>
            )}
          </div>
          <CardDescription className="line-clamp-2">{model.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs mb-4">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Size</p>
              <p className="font-medium">{model.size}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Architecture</p>
              <p className="font-medium">{model.architecture}</p>
            </div>
            {model.creationDate && (
              <div className="col-span-2">
                <p className="text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium">{model.creationDate}</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <Button 
              variant="ghost" 
              size="sm"
              rightIcon={<ArrowUpRight className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                // View details action
              }}
            >
              Details
            </Button>
            
            <Button 
              variant="primary" 
              size="sm"
            >
              {model.isBase ? "Use Base" : "Use Model"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { cn } from '../../utils/cn';