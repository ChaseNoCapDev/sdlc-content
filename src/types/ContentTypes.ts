/**
 * Core types for SDLC content management
 */

// Template types
export interface ISDLCTemplate {
  id: string;
  name: string;
  category: 'phase' | 'document' | 'deliverable' | 'checklist';
  phase?: string;
  version: string;
  description: string;
  variables: ITemplateVariable[];
  content: string;
  parent?: string; // For template inheritance
  tags?: string[];
}

export interface ITemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  validation?: IVariableValidation;
}

export interface IVariableValidation {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
  custom?: string; // Custom validation function name
}

// Knowledge base types
export interface IKnowledgeEntry {
  id: string;
  category: 'best-practice' | 'anti-pattern' | 'guideline' | 'example' | 'reference';
  phase?: string;
  title: string;
  content: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  relatedEntries?: string[];
}

export interface IKnowledgeBase {
  version: string;
  entries: IKnowledgeEntry[];
  categories: ICategoryDefinition[];
  tags: ITagDefinition[];
}

export interface ICategoryDefinition {
  id: string;
  name: string;
  description: string;
  parent?: string;
}

export interface ITagDefinition {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// Content management types
export interface IContentManager {
  getTemplate(templateId: string): Promise<ISDLCTemplate | undefined>;
  getAllTemplates(filter?: ITemplateFilter): Promise<ISDLCTemplate[]>;
  renderTemplate(templateId: string, variables: Record<string, unknown>): Promise<string>;
  validateTemplate(template: ISDLCTemplate): IContentValidationResult;
  
  getKnowledgeEntry(entryId: string): Promise<IKnowledgeEntry | undefined>;
  searchKnowledge(query: IKnowledgeQuery): Promise<IKnowledgeEntry[]>;
  getRelatedKnowledge(entryId: string): Promise<IKnowledgeEntry[]>;
}

export interface ITemplateFilter {
  category?: string;
  phase?: string;
  tags?: string[];
  parent?: string;
}

export interface IKnowledgeQuery {
  text?: string;
  category?: string;
  phase?: string;
  tags?: string[];
  limit?: number;
}

// Template rendering
export interface ITemplateRenderer {
  render(template: string, variables: Record<string, unknown>): string;
  validateVariables(template: ISDLCTemplate, variables: Record<string, unknown>): IContentValidationResult;
  extractVariables(template: string): ITemplateVariable[];
}

// Content validation
export interface IContentValidator {
  validateTemplate(template: ISDLCTemplate): IContentValidationResult;
  validateKnowledgeEntry(entry: IKnowledgeEntry): IContentValidationResult;
  validateVariables(variables: ITemplateVariable[], values: Record<string, unknown>): IContentValidationResult;
}

export interface IContentValidationResult {
  valid: boolean;
  errors: IValidationError[];
  warnings: IValidationWarning[];
}

export interface IValidationError {
  path: string;
  message: string;
  type: 'missing' | 'invalid' | 'conflict' | 'syntax';
}

export interface IValidationWarning {
  path: string;
  message: string;
  type: 'deprecated' | 'unused' | 'style' | 'best-practice';
}

// Content loader
export interface IContentLoader {
  loadTemplates(directory: string): Promise<ISDLCTemplate[]>;
  loadKnowledgeBase(file: string): Promise<IKnowledgeBase>;
  watchForChanges(callback: (change: IContentChange) => void): void;
}

export interface IContentChange {
  type: 'template' | 'knowledge';
  action: 'added' | 'modified' | 'removed';
  id: string;
  path?: string;
}

// Template inheritance
export interface ITemplateInheritance {
  resolveTemplate(templateId: string): Promise<ISDLCTemplate>;
  mergeTemplates(parent: ISDLCTemplate, child: ISDLCTemplate): ISDLCTemplate;
  getInheritanceChain(templateId: string): Promise<string[]>;
}

// Events
export type ContentEventType = 
  | 'template.loaded'
  | 'template.rendered'
  | 'template.validation.failed'
  | 'knowledge.loaded'
  | 'knowledge.searched'
  | 'content.changed';

export interface ContentEventData {
  'template.loaded': { templateId: string; count?: number };
  'template.rendered': { templateId: string; duration: number };
  'template.validation.failed': { templateId: string; errors: IValidationError[] };
  'knowledge.loaded': { count: number };
  'knowledge.searched': { query: IKnowledgeQuery; results: number };
  'content.changed': IContentChange;
}