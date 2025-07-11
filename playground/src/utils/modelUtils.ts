/**
 * Utility functions for model analysis and validation
 */

/**
 * Check if a model is instruction-tuned based on its name and metadata
 */
export function isInstructionModel(modelName: string, modelId?: string): boolean {
  if (!modelName && !modelId) return false;
  
  const textToCheck = `${modelName || ''} ${modelId || ''}`.toLowerCase();
  
  // Common instruction-tuning indicators
  const instructKeywords = [
    'instruct',
    'instruction',
    'chat',
    'sft', // Supervised Fine-Tuning
    'dpo', // Direct Preference Optimization
    'rlhf', // Reinforcement Learning from Human Feedback
    'assistant',
    'helpful',
    'conversational'
  ];
  
  // Common instruction model suffixes/patterns
  const instructPatterns = [
    '-it', // Common suffix for instruction-tuned models
    '-instruct',
    '-chat',
    '-assistant',
    'instruct-',
    'chat-',
    'it-', // At beginning
    'it_', // With underscore
    '_it', // At end with underscore
    'instruction-tuned',
    'instruction_tuned'
  ];
  
  // Check for direct keyword matches
  for (const keyword of instructKeywords) {
    if (textToCheck.includes(keyword)) {
      return true;
    }
  }
  
  // Check for pattern matches
  for (const pattern of instructPatterns) {
    if (textToCheck.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get warning message for non-instruction models
 */
export function getNonInstructWarningMessage(modelName: string): string {
  return `The selected model "${modelName}" appears to be a base model without instruction tuning. Instruction-tuned models are specifically trained to follow instructions and typically perform better for fine-tuning tasks. Consider selecting a model with "instruct", "chat", or "it" in its name for better results.`;
}

/**
 * Get recommendations for instruction models
 */
export function getInstructModelRecommendations(): string[] {
  return [
    'Look for models with "instruct", "chat", or "it" in the name',
    'Microsoft Phi models with "instruct" suffix are good choices',
    'Meta Llama models ending in "Instruct" are recommended',
    'Mistral models with "Instruct" in the name work well',
    'Google Gemma models ending in "it" are instruction-tuned'
  ];
}
