import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type {
  ITemplateRenderer,
  ISDLCTemplate,
  ITemplateVariable,
  IContentValidationResult,
  IValidationError,
  IValidationWarning
} from '../types/ContentTypes.js';

@injectable()
export class TemplateRenderer implements ITemplateRenderer {
  private readonly variablePattern = /\{\{(\s*[\w.]+\s*)\}\}/g;
  private readonly conditionalPattern = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  private readonly loopPattern = /\{\{#each\s+([\w.]+)\s+as\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  constructor(@inject('ILogger') private logger: ILogger) {}

  render(template: string, variables: Record<string, unknown>): string {
    const childLogger = this.logger.child({ component: 'TemplateRenderer' });
    childLogger.debug('Rendering template', { variableCount: Object.keys(variables).length });

    let result = template;
    let previousResult = '';
    
    // Keep processing until no more changes occur (handles nested structures)
    while (result !== previousResult) {
      previousResult = result;
      
      // Process all template constructs
      result = this.processLoops(result, variables);
      result = this.processConditionals(result, variables);
      result = this.processVariables(result, variables);
    }

    // Clean up any remaining unmatched variables
    result = result.replace(this.variablePattern, '');

    childLogger.debug('Template rendered successfully');
    return result;
  }

  validateVariables(
    template: ISDLCTemplate,
    variables: Record<string, unknown>
  ): IContentValidationResult {
    const childLogger = this.logger.child({ 
      component: 'TemplateRenderer',
      templateId: template.id 
    });
    childLogger.debug('Validating template variables');

    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];

    // Check required variables
    for (const varDef of template.variables) {
      const value = this.getNestedValue(variables, varDef.name);

      if (varDef.required && value === undefined) {
        errors.push({
          path: varDef.name,
          message: `Required variable '${varDef.name}' is missing`,
          type: 'missing'
        });
        continue;
      }

      if (value !== undefined) {
        // Type validation
        if (!this.validateType(value, varDef.type)) {
          errors.push({
            path: varDef.name,
            message: `Variable '${varDef.name}' has invalid type. Expected ${varDef.type}`,
            type: 'invalid'
          });
        }

        // Custom validation
        if (varDef.validation) {
          const validationErrors = this.validateValue(value, varDef);
          errors.push(...validationErrors);
        }
      }
    }

    // Check for unused variables
    const definedVars = new Set(template.variables.map(v => v.name));
    const providedVars = this.flattenKeys(variables);
    
    for (const key of providedVars) {
      if (!definedVars.has(key)) {
        warnings.push({
          path: key,
          message: `Variable '${key}' is not defined in template`,
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

  extractVariables(template: string): ITemplateVariable[] {
    const childLogger = this.logger.child({ component: 'TemplateRenderer' });
    childLogger.debug('Extracting variables from template');

    const variables = new Map<string, ITemplateVariable>();
    const matches = new Set<string>();

    // Extract from simple variables
    let match;
    while ((match = this.variablePattern.exec(template)) !== null) {
      matches.add(match[1]!.trim());
    }

    // Reset regex
    this.variablePattern.lastIndex = 0;

    // Extract from conditionals
    const conditionalRegex = new RegExp(this.conditionalPattern);
    while ((match = conditionalRegex.exec(template)) !== null) {
      matches.add(match[1]!.trim());
    }

    // Extract from loops
    const loopRegex = new RegExp(this.loopPattern);
    while ((match = loopRegex.exec(template)) !== null) {
      matches.add(match[1]!.trim());
    }

    // Create variable definitions
    for (const varName of matches) {
      if (!variables.has(varName)) {
        variables.set(varName, {
          name: varName,
          description: `Variable ${varName} used in template`,
          type: 'string', // Default type
          required: true // Assume required by default
        });
      }
    }

    const result = Array.from(variables.values());
    childLogger.debug('Variables extracted', { count: result.length });
    return result;
  }

  private processConditionals(template: string, variables: Record<string, unknown>): string {
    // Create a new regex to avoid state issues
    const conditionalRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (_, condition, content) => {
      const value = this.getNestedValue(variables, condition.trim());
      if (this.isTruthy(value)) {
        // Return the content as-is, let the main render method handle processing order
        return content;
      }
      return '';
    });
  }

  private processLoops(template: string, variables: Record<string, unknown>): string {
    // Function to find matching end tag for a given start position
    const findMatchingEnd = (text: string, startPos: number): number => {
      let depth = 1;
      let pos = startPos;
      
      while (depth > 0 && pos < text.length) {
        const nextStart = text.indexOf('{{#each', pos);
        const nextEnd = text.indexOf('{{/each}}', pos);
        
        if (nextEnd === -1) return -1;
        
        if (nextStart !== -1 && nextStart < nextEnd) {
          depth++;
          pos = nextStart + 7;
        } else {
          depth--;
          if (depth === 0) return nextEnd + 9; // Length of {{/each}}
          pos = nextEnd + 9;
        }
      }
      
      return -1;
    };
    
    // Process template
    let result = '';
    let lastPos = 0;
    
    while (true) {
      const startMatch = template.indexOf('{{#each', lastPos);
      if (startMatch === -1) {
        result += template.slice(lastPos);
        break;
      }
      
      // Add content before the loop
      result += template.slice(lastPos, startMatch);
      
      // Parse the loop header
      const headerEnd = template.indexOf('}}', startMatch);
      if (headerEnd === -1) {
        result += template.slice(startMatch);
        break;
      }
      
      const header = template.slice(startMatch + 7, headerEnd); // Skip '{{#each'
      const headerMatch = header.match(/\s+([\w.]+)\s+as\s+(\w+)/);
      if (!headerMatch) {
        result += template.slice(startMatch, headerEnd + 2);
        lastPos = headerEnd + 2;
        continue;
      }
      
      const [, arrayVar, itemName] = headerMatch;
      const contentStart = headerEnd + 2;
      const endPos = findMatchingEnd(template, contentStart);
      
      if (endPos === -1) {
        result += template.slice(startMatch);
        break;
      }
      
      const content = template.slice(contentStart, endPos - 9); // Exclude {{/each}}
      const array = this.getNestedValue(variables, arrayVar!.trim());
      
      if (Array.isArray(array)) {
        for (const item of array) {
          const itemVars = { ...variables, [itemName!]: item };
          result += this.render(content, itemVars);
        }
      }
      
      lastPos = endPos;
    }
    
    return result;
  }

  private processVariables(template: string, variables: Record<string, unknown>): string {
    return template.replace(this.variablePattern, (_, varName) => {
      const value = this.getNestedValue(variables, varName.trim());
      return value !== undefined ? String(value) : '';
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part]!;
      } else {
        return undefined;
      }
    }

    return current;
  }

  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private validateValue(value: unknown, varDef: ITemplateVariable): IValidationError[] {
    const errors: IValidationError[] = [];
    const validation = varDef.validation;

    if (!validation) return errors;

    // Pattern validation for strings
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          path: varDef.name,
          message: `Value does not match pattern: ${validation.pattern}`,
          type: 'invalid'
        });
      }
    }

    // Min/max validation for numbers
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          path: varDef.name,
          message: `Value ${value} is less than minimum ${validation.min}`,
          type: 'invalid'
        });
      }
      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          path: varDef.name,
          message: `Value ${value} is greater than maximum ${validation.max}`,
          type: 'invalid'
        });
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      errors.push({
        path: varDef.name,
        message: `Value must be one of: ${validation.enum.join(', ')}`,
        type: 'invalid'
      });
    }

    return errors;
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this.flattenKeys(value as Record<string, unknown>, fullKey));
      }
    }

    return keys;
  }
}