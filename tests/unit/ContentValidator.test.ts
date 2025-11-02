import { describe, it, expect, beforeEach } from 'vitest';
import { ContentValidator } from '../../src/implementations/ContentValidator.js';
import type { ILogger } from '@chasenocap/logger';
import type { ISDLCTemplate, IKnowledgeEntry, ITemplateVariable } from '../../src/types/ContentTypes.js';

// Mock logger
const createMockLogger = (): ILogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => createMockLogger()
} as any);

describe('ContentValidator', () => {
  let validator: ContentValidator;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    validator = new ContentValidator(mockLogger);
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const template: ISDLCTemplate = {
        id: 'test-template',
        name: 'Test Template',
        category: 'document',
        version: '1.0.0',
        description: 'A test template',
        content: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'User name'
          }
        ],
        tags: ['test', 'example']
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const template = {
        name: 'Test Template',
        category: 'document'
      } as any;

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing')).toBe(true);
    });

    it('should detect invalid category', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'invalid' as any,
        version: '1.0.0',
        content: 'Content'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Invalid category'))).toBe(true);
    });

    it('should detect invalid version format', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'document',
        version: 'v1.0',
        content: 'Content'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('version'))).toBe(true);
    });

    it('should check template syntax', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'document',
        version: '1.0.0',
        content: 'Hello {{name without closing brackets'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'syntax')).toBe(true);
    });

    it('should warn about missing description', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'document',
        version: '1.0.0',
        content: 'Content'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.path === 'description')).toBe(true);
    });

    it('should validate template with conditionals', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'document',
        version: '1.0.0',
        content: '{{#if enabled}}Enabled{{/if}}'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(true);
    });

    it('should detect unclosed conditionals', () => {
      const template: ISDLCTemplate = {
        id: 'test',
        name: 'Test',
        category: 'document',
        version: '1.0.0',
        content: '{{#if enabled}}Enabled'
      };

      const result = validator.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unmatched conditional'))).toBe(true);
    });
  });

  describe('validateKnowledgeEntry', () => {
    it('should validate a correct knowledge entry', () => {
      const entry: IKnowledgeEntry = {
        id: 'best-practice-1',
        category: 'best-practice',
        title: 'Use Version Control',
        content: 'Always use version control for your code. Git is the most popular choice.',
        tags: ['git', 'version-control', 'basics'],
        phase: 'development'
      };

      const result = validator.validateKnowledgeEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid knowledge category', () => {
      const entry: IKnowledgeEntry = {
        id: 'test',
        category: 'invalid-category' as any,
        title: 'Test',
        content: 'Test content',
        tags: []
      };

      const result = validator.validateKnowledgeEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Invalid category'))).toBe(true);
    });

    it('should warn about short content', () => {
      const entry: IKnowledgeEntry = {
        id: 'test',
        category: 'guideline',
        title: 'Test',
        content: 'Too short',
        tags: ['test']
      };

      const result = validator.validateKnowledgeEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('too short'))).toBe(true);
    });

    it('should warn about missing tags', () => {
      const entry: IKnowledgeEntry = {
        id: 'test',
        category: 'example',
        title: 'Test Example',
        content: 'This is a detailed example of how to implement a specific pattern in the codebase.',
        tags: []
      };

      const result = validator.validateKnowledgeEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.path === 'tags')).toBe(true);
    });
  });

  describe('validateVariables', () => {
    const variables: ITemplateVariable[] = [
      {
        name: 'username',
        type: 'string',
        required: true,
        description: 'Username',
        validation: {
          pattern: '^[a-zA-Z0-9_]+$',
          min: 3,
          max: 20
        }
      },
      {
        name: 'age',
        type: 'number',
        required: true,
        description: 'Age',
        validation: {
          min: 18,
          max: 100
        }
      },
      {
        name: 'role',
        type: 'string',
        required: false,
        description: 'User role',
        validation: {
          enum: ['admin', 'user', 'guest']
        }
      }
    ];

    it('should validate correct variable values', () => {
      const values = {
        username: 'john_doe',
        age: 25
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const values = {
        username: 'john_doe'
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'age' && e.type === 'missing')).toBe(true);
    });

    it('should detect type mismatches', () => {
      const values = {
        username: 'john_doe',
        age: 'twenty-five'
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'age' && e.type === 'invalid')).toBe(true);
    });

    it('should validate pattern constraints', () => {
      const values = {
        username: 'john@doe', // Invalid pattern
        age: 25
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('pattern'))).toBe(true);
    });

    it('should validate numeric constraints', () => {
      const values = {
        username: 'john_doe',
        age: 150 // Exceeds max
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('exceeds maximum'))).toBe(true);
    });

    it('should validate enum constraints', () => {
      const values = {
        username: 'john_doe',
        age: 25,
        role: 'superuser' // Not in enum
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('must be one of'))).toBe(true);
    });

    it('should warn about extra variables', () => {
      const values = {
        username: 'john_doe',
        age: 25,
        extra: 'value'
      };

      const result = validator.validateVariables(variables, values);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.path === 'extra' && w.type === 'unused')).toBe(true);
    });

    it('should handle date validation', () => {
      const dateVars: ITemplateVariable[] = [{
        name: 'date',
        type: 'date',
        required: true,
        description: 'Date'
      }];

      expect(validator.validateVariables(dateVars, { date: new Date() }).valid).toBe(true);
      expect(validator.validateVariables(dateVars, { date: '2024-01-01' }).valid).toBe(true);
      expect(validator.validateVariables(dateVars, { date: 'invalid-date' }).valid).toBe(false);
    });

    it('should handle array validation', () => {
      const arrayVars: ITemplateVariable[] = [{
        name: 'items',
        type: 'array',
        required: true,
        description: 'Items'
      }];

      expect(validator.validateVariables(arrayVars, { items: [] }).valid).toBe(true);
      expect(validator.validateVariables(arrayVars, { items: [1, 2, 3] }).valid).toBe(true);
      expect(validator.validateVariables(arrayVars, { items: 'not-array' }).valid).toBe(false);
    });

    it('should handle object validation', () => {
      const objectVars: ITemplateVariable[] = [{
        name: 'config',
        type: 'object',
        required: true,
        description: 'Configuration'
      }];

      expect(validator.validateVariables(objectVars, { config: {} }).valid).toBe(true);
      expect(validator.validateVariables(objectVars, { config: { key: 'value' } }).valid).toBe(true);
      expect(validator.validateVariables(objectVars, { config: [] }).valid).toBe(false);
      expect(validator.validateVariables(objectVars, { config: null }).valid).toBe(false);
    });
  });
});