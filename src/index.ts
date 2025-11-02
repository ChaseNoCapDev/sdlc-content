/**
 * @chasenocap/sdlc-content - SDLC templates and knowledge base
 */

import 'reflect-metadata';

// Export types
export * from './types/ContentTypes.js';

// Export implementations
export { TemplateRenderer } from './implementations/TemplateRenderer.js';
export { ContentLoader } from './implementations/ContentLoader.js';
export { ContentValidator } from './implementations/ContentValidator.js';
export { ContentManager } from './implementations/ContentManager.js';
export { TemplateInheritance } from './implementations/TemplateInheritance.js';

// Export injection tokens
export const CONTENT_TYPES = {
  ITemplateRenderer: Symbol.for('ITemplateRenderer'),
  IContentLoader: Symbol.for('IContentLoader'),
  IContentValidator: Symbol.for('IContentValidator'),
  IContentManager: Symbol.for('IContentManager'),
  ITemplateInheritance: Symbol.for('ITemplateInheritance')
};

// Export helper functions
export { createContentContainer } from './utils/ContentContainer.js';

// Export template schemas
export { TEMPLATE_SCHEMAS } from './schemas/index.js';