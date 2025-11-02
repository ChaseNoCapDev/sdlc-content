import { injectable, inject } from 'inversify';
import AjvModule from 'ajv';
const Ajv = AjvModule.default || AjvModule;
import type { ILogger } from '@chasenocap/logger';
import type {
  IContentValidator,
  ISDLCTemplate,
  IKnowledgeEntry,
  ITemplateVariable,
  IContentValidationResult,
  IValidationError,
  IValidationWarning
} from '../types/ContentTypes.js';

@injectable()
export class ContentValidator implements IContentValidator {
  private ajv: any;

  constructor(@inject('ILogger') private logger: ILogger) {
    this.ajv = new Ajv({ allErrors: true });
    this.setupSchemas();
  }

  validateTemplate(template: ISDLCTemplate): IContentValidationResult {
    const childLogger = this.logger.child({
      component: 'ContentValidator',
      templateId: template.id
    });
    childLogger.debug('Validating template');

    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];

    // Schema validation
    const valid = this.ajv.validate('template', template);
    if (!valid && this.ajv.errors) {
      for (const error of this.ajv.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath,
          message: error.message || 'Schema validation failed',
          type: 'invalid'
        });
      }
    }

    // Custom validation
    if (!template.id || template.id.length === 0) {
      errors.push({
        path: 'id',
        message: 'Template ID is required',
        type: 'missing'
      });
    }

    if (!template.content || template.content.length === 0) {
      errors.push({
        path: 'content',
        message: 'Template content is required',
        type: 'missing'
      });
    }

    // Check for valid category
    const validCategories = ['phase', 'document', 'deliverable', 'checklist'];
    if (!validCategories.includes(template.category)) {
      errors.push({
        path: 'category',
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        type: 'invalid'
      });
    }

    // Validate variables
    if (template.variables) {
      for (let i = 0; i < template.variables.length; i++) {
        const variable = template.variables[i];
        if (variable) {
          const varErrors = this.validateVariable(variable, `variables[${i}]`);
          errors.push(...varErrors);
        }
      }
    }

    // Check for template syntax errors
    const syntaxErrors = this.checkTemplateSyntax(template.content);
    errors.push(...syntaxErrors);

    // Warnings
    if (!template.description) {
      warnings.push({
        path: 'description',
        message: 'Template should have a description',
        type: 'best-practice'
      });
    }

    if (!template.tags || template.tags.length === 0) {
      warnings.push({
        path: 'tags',
        message: 'Template should have tags for better discoverability',
        type: 'best-practice'
      });
    }

    childLogger.debug('Template validation complete', {
      errors: errors.length,
      warnings: warnings.length
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateKnowledgeEntry(entry: IKnowledgeEntry): IContentValidationResult {
    const childLogger = this.logger.child({
      component: 'ContentValidator',
      entryId: entry.id
    });
    childLogger.debug('Validating knowledge entry');

    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];

    // Schema validation
    const valid = this.ajv.validate('knowledgeEntry', entry);
    if (!valid && this.ajv.errors) {
      for (const error of this.ajv.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath,
          message: error.message || 'Schema validation failed',
          type: 'invalid'
        });
      }
    }

    // Custom validation
    if (!entry.id || entry.id.length === 0) {
      errors.push({
        path: 'id',
        message: 'Knowledge entry ID is required',
        type: 'missing'
      });
    }

    if (!entry.content || entry.content.length === 0) {
      errors.push({
        path: 'content',
        message: 'Knowledge entry content is required',
        type: 'missing'
      });
    }

    // Check for valid category
    const validCategories = ['best-practice', 'anti-pattern', 'guideline', 'example', 'reference'];
    if (!validCategories.includes(entry.category)) {
      errors.push({
        path: 'category',
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        type: 'invalid'
      });
    }

    // Warnings
    if (!entry.tags || entry.tags.length === 0) {
      warnings.push({
        path: 'tags',
        message: 'Knowledge entry should have tags',
        type: 'best-practice'
      });
    }

    if (entry.content.length < 50) {
      warnings.push({
        path: 'content',
        message: 'Knowledge entry content seems too short to be useful',
        type: 'best-practice'
      });
    }

    childLogger.debug('Knowledge entry validation complete', {
      errors: errors.length,
      warnings: warnings.length
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateVariables(
    variables: ITemplateVariable[],
    values: Record<string, unknown>
  ): IContentValidationResult {
    const childLogger = this.logger.child({ component: 'ContentValidator' });
    childLogger.debug('Validating variables', { count: variables.length });

    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];

    for (const variable of variables) {
      const value = values[variable.name];

      // Check required
      if (variable.required && value === undefined) {
        errors.push({
          path: variable.name,
          message: `Required variable '${variable.name}' is missing`,
          type: 'missing'
        });
        continue;
      }

      if (value !== undefined) {
        // Type validation
        if (!this.validateVariableType(value, variable.type)) {
          errors.push({
            path: variable.name,
            message: `Variable '${variable.name}' has incorrect type. Expected ${variable.type}`,
            type: 'invalid'
          });
        }

        // Custom validation
        if (variable.validation) {
          const varErrors = this.validateVariableValue(variable, value);
          errors.push(...varErrors);
        }
      }
    }

    // Check for extra variables
    const definedVars = new Set(variables.map(v => v.name));
    for (const key of Object.keys(values)) {
      if (!definedVars.has(key)) {
        warnings.push({
          path: key,
          message: `Variable '${key}' is not defined`,
          type: 'unused'
        });
      }
    }

    childLogger.debug('Variable validation complete', {
      errors: errors.length,
      warnings: warnings.length
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private setupSchemas(): void {
    // Template schema
    this.ajv.addSchema({
      $id: 'template',
      type: 'object',
      required: ['id', 'name', 'category', 'version', 'content'],
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        category: { type: 'string', enum: ['phase', 'document', 'deliverable', 'checklist'] },
        phase: { type: 'string' },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        description: { type: 'string' },
        variables: { type: 'array' },
        content: { type: 'string', minLength: 1 },
        parent: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      }
    });

    // Knowledge entry schema
    this.ajv.addSchema({
      $id: 'knowledgeEntry',
      type: 'object',
      required: ['id', 'category', 'title', 'content', 'tags'],
      properties: {
        id: { type: 'string', minLength: 1 },
        category: {
          type: 'string',
          enum: ['best-practice', 'anti-pattern', 'guideline', 'example', 'reference']
        },
        phase: { type: 'string' },
        title: { type: 'string', minLength: 1 },
        content: { type: 'string', minLength: 1 },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object' },
        relatedEntries: { type: 'array', items: { type: 'string' } }
      }
    });
  }

  private validateVariable(variable: ITemplateVariable, path: string): IValidationError[] {
    const errors: IValidationError[] = [];

    if (!variable.name || variable.name.length === 0) {
      errors.push({
        path: `${path}.name`,
        message: 'Variable name is required',
        type: 'missing'
      });
    }

    const validTypes = ['string', 'number', 'boolean', 'date', 'array', 'object'];
    if (!validTypes.includes(variable.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid variable type. Must be one of: ${validTypes.join(', ')}`,
        type: 'invalid'
      });
    }

    return errors;
  }

  private checkTemplateSyntax(content: string): IValidationError[] {
    const errors: IValidationError[] = [];
    
    if (!content) {
      return errors;
    }
    
    const lines = content.split('\n');

    // Check for unmatched brackets
    let openBrackets = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) {
        openBrackets += (line.match(/\{\{/g) || []).length;
        openBrackets -= (line.match(/\}\}/g) || []).length;
      }

      if (openBrackets < 0) {
        errors.push({
          path: `line ${i + 1}`,
          message: 'Unmatched closing brackets }}',
          type: 'syntax'
        });
        openBrackets = 0;
      }
    }

    if (openBrackets > 0) {
      errors.push({
        path: 'content',
        message: 'Unmatched opening brackets {{',
        type: 'syntax'
      });
    }

    // Check for unclosed conditionals
    const ifCount = (content.match(/\{\{#if/g) || []).length;
    const endIfCount = (content.match(/\{\{\/if\}\}/g) || []).length;
    if (ifCount !== endIfCount) {
      errors.push({
        path: 'content',
        message: 'Unmatched conditional blocks',
        type: 'syntax'
      });
    }

    // Check for unclosed loops
    const eachCount = (content.match(/\{\{#each/g) || []).length;
    const endEachCount = (content.match(/\{\{\/each\}\}/g) || []).length;
    if (eachCount !== endEachCount) {
      errors.push({
        path: 'content',
        message: 'Unmatched loop blocks',
        type: 'syntax'
      });
    }

    return errors;
  }

  private validateVariableType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  private validateVariableValue(
    variable: ITemplateVariable,
    value: unknown
  ): IValidationError[] {
    const errors: IValidationError[] = [];
    const validation = variable.validation;

    if (!validation) return errors;

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          path: variable.name,
          message: `Value does not match required pattern: ${validation.pattern}`,
          type: 'invalid'
        });
      }
    }

    // Numeric validation
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          path: variable.name,
          message: `Value ${value} is below minimum ${validation.min}`,
          type: 'invalid'
        });
      }
      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          path: variable.name,
          message: `Value ${value} exceeds maximum ${validation.max}`,
          type: 'invalid'
        });
      }
    }

    // Enum validation
    if (validation.enum && validation.enum.length > 0) {
      if (!validation.enum.includes(value)) {
        errors.push({
          path: variable.name,
          message: `Value must be one of: ${validation.enum.join(', ')}`,
          type: 'invalid'
        });
      }
    }

    return errors;
  }
}