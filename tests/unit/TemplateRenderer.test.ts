import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRenderer } from '../../src/implementations/TemplateRenderer.js';
import type { ILogger } from '@chasenocap/logger';
import type { ISDLCTemplate } from '../../src/types/ContentTypes.js';

// Mock logger
const createMockLogger = (): ILogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => createMockLogger()
} as any);

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new TemplateRenderer(mockLogger);
  });

  describe('render', () => {
    it('should render simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const variables = {
        name: 'John',
        project: 'MetaGOTHIC'
      };

      const result = renderer.render(template, variables);
      expect(result).toBe('Hello John, welcome to MetaGOTHIC!');
    });

    it('should render nested variables', () => {
      const template = 'User: {{user.name}} ({{user.role}})';
      const variables = {
        user: {
          name: 'Jane Doe',
          role: 'Developer'
        }
      };

      const result = renderer.render(template, variables);
      expect(result).toBe('User: Jane Doe (Developer)');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, your ID is {{id}}';
      const variables = {
        name: 'John'
      };

      const result = renderer.render(template, variables);
      expect(result).toBe('Hello John, your ID is ');
    });

    it('should process conditionals', () => {
      const template = '{{#if premium}}Premium User{{/if}}{{#if regular}}Regular User{{/if}}';
      
      const premiumResult = renderer.render(template, { premium: true, regular: false });
      expect(premiumResult).toBe('Premium User');

      const regularResult = renderer.render(template, { premium: false, regular: true });
      expect(regularResult).toBe('Regular User');
    });

    it('should process loops', () => {
      const template = 'Items:{{#each items as item}} {{item.name}}{{/each}}';
      const variables = {
        items: [
          { name: 'Apple' },
          { name: 'Banana' },
          { name: 'Cherry' }
        ]
      };

      const result = renderer.render(template, variables);
      expect(result).toBe('Items: Apple Banana Cherry');
    });

    it('should handle nested loops and conditionals', () => {
      const template = `
{{#each users as user}}
User: {{user.name}}
{{#if user.tasks}}
Tasks:
{{#each user.tasks as task}}
- {{task}}
{{/each}}
{{/if}}
{{/each}}`;

      const variables = {
        users: [
          {
            name: 'Alice',
            tasks: ['Code', 'Review']
          },
          {
            name: 'Bob',
            tasks: null
          }
        ]
      };

      const result = renderer.render(template, variables);
      
      // Check Alice's section
      expect(result).toContain('User: Alice');
      expect(result).toContain('Tasks:'); // Alice should have tasks section
      expect(result).toContain('- Code');
      expect(result).toContain('- Review');
      
      // Check Bob's section
      expect(result).toContain('User: Bob');
      
      // Bob shouldn't have a tasks section - check that there's no "Tasks:" after "User: Bob"
      const bobIndex = result.indexOf('User: Bob');
      const bobSection = result.slice(bobIndex);
      expect(bobSection).not.toContain('Tasks:');
    });
  });

  describe('validateVariables', () => {
    const template: ISDLCTemplate = {
      id: 'test',
      name: 'Test Template',
      category: 'document',
      version: '1.0.0',
      content: '',
      variables: [
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Document title'
        },
        {
          name: 'version',
          type: 'string',
          required: false,
          description: 'Version',
          default: '1.0.0'
        },
        {
          name: 'count',
          type: 'number',
          required: true,
          description: 'Item count',
          validation: {
            min: 1,
            max: 100
          }
        }
      ]
    };

    it('should validate correct variables', () => {
      const variables = {
        title: 'My Document',
        count: 42
      };

      const result = renderer.validateVariables(template, variables);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const variables = {
        version: '2.0.0'
      };

      const result = renderer.validateVariables(template, variables);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].type).toBe('missing');
    });

    it('should detect type mismatches', () => {
      const variables = {
        title: 'My Document',
        count: 'not a number'
      };

      const result = renderer.validateVariables(template, variables);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalid');
    });

    it('should validate numeric constraints', () => {
      const variables = {
        title: 'My Document',
        count: 150
      };

      const result = renderer.validateVariables(template, variables);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('greater than maximum');
    });

    it('should warn about unused variables', () => {
      const variables = {
        title: 'My Document',
        count: 42,
        extra: 'unused'
      };

      const result = renderer.validateVariables(template, variables);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('unused');
    });
  });

  describe('extractVariables', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      
      const variables = renderer.extractVariables(template);
      expect(variables).toHaveLength(2);
      expect(variables.map(v => v.name)).toContain('name');
      expect(variables.map(v => v.name)).toContain('email');
    });

    it('should extract variables from conditionals', () => {
      const template = '{{#if isAdmin}}Admin: {{adminName}}{{/if}}';
      
      const variables = renderer.extractVariables(template);
      expect(variables.map(v => v.name)).toContain('isAdmin');
      expect(variables.map(v => v.name)).toContain('adminName');
    });

    it('should extract variables from loops', () => {
      const template = '{{#each users as user}}{{user.name}}{{/each}}';
      
      const variables = renderer.extractVariables(template);
      expect(variables.map(v => v.name)).toContain('users');
    });

    it('should extract unique variables only', () => {
      const template = '{{name}} - {{name}} - {{name}}';
      
      const variables = renderer.extractVariables(template);
      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('name');
    });

    it('should handle nested properties', () => {
      const template = '{{config.database.host}}:{{config.database.port}}';
      
      const variables = renderer.extractVariables(template);
      expect(variables.map(v => v.name)).toContain('config.database.host');
      expect(variables.map(v => v.name)).toContain('config.database.port');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const result = renderer.render('', {});
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'This is plain text.';
      const result = renderer.render(template, {});
      expect(result).toBe('This is plain text.');
    });

    it('should handle malformed variable syntax', () => {
      const template = 'Hello {{ name } welcome!';
      const result = renderer.render(template, { name: 'John' });
      expect(result).toBe('Hello {{ name } welcome!');
    });

    it('should handle boolean conditions properly', () => {
      const template = '{{#if enabled}}Enabled{{/if}}';
      
      expect(renderer.render(template, { enabled: true })).toBe('Enabled');
      expect(renderer.render(template, { enabled: false })).toBe('');
      expect(renderer.render(template, { enabled: 1 })).toBe('Enabled');
      expect(renderer.render(template, { enabled: 0 })).toBe('');
      expect(renderer.render(template, { enabled: 'yes' })).toBe('Enabled');
      expect(renderer.render(template, { enabled: '' })).toBe('');
      expect(renderer.render(template, { enabled: [] })).toBe('');
      expect(renderer.render(template, { enabled: ['item'] })).toBe('Enabled');
    });

    it('should handle non-array values in loops gracefully', () => {
      const template = '{{#each items as item}}{{item}}{{/each}}';
      
      const result = renderer.render(template, { items: 'not an array' });
      expect(result).toBe('');
    });
  });
});