import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type {
  ITemplateInheritance,
  ISDLCTemplate
} from '../types/ContentTypes.js';

export type TemplateGetter = (templateId: string) => Promise<ISDLCTemplate | undefined>;

@injectable()
export class TemplateInheritance implements ITemplateInheritance {
  private resolvedCache: Map<string, ISDLCTemplate> = new Map();
  private templateGetter: TemplateGetter | null = null;

  constructor(
    @inject('ILogger') private logger: ILogger
  ) {}
  
  setTemplateGetter(getter: TemplateGetter): void {
    this.templateGetter = getter;
  }

  async resolveTemplate(templateId: string): Promise<ISDLCTemplate> {
    const childLogger = this.logger.child({
      component: 'TemplateInheritance',
      templateId
    });
    childLogger.debug('Resolving template inheritance');

    // Check cache
    const cached = this.resolvedCache.get(templateId);
    if (cached) {
      childLogger.debug('Using cached resolved template');
      return cached;
    }

    if (!this.templateGetter) {
      throw new Error('Template getter not set');
    }
    
    // Get the template
    const template = await this.templateGetter(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // If no parent, return as-is
    if (!template.parent) {
      this.resolvedCache.set(templateId, template);
      return template;
    }

    // Get inheritance chain
    const chain = await this.getInheritanceChain(templateId);
    childLogger.debug('Inheritance chain resolved', { chain });

    // Start with the root parent
    let resolved: ISDLCTemplate | null = null;
    
    for (const id of chain.reverse()) {
      const current = await this.templateGetter!(id);
      if (!current) {
        throw new Error(`Template in inheritance chain not found: ${id}`);
      }

      if (!resolved) {
        resolved = { ...current };
      } else {
        resolved = this.mergeTemplates(resolved, current);
      }
    }

    if (!resolved) {
      throw new Error('Failed to resolve template inheritance');
    }

    // Cache the result
    this.resolvedCache.set(templateId, resolved);
    
    childLogger.debug('Template inheritance resolved successfully');
    return resolved;
  }

  mergeTemplates(parent: ISDLCTemplate, child: ISDLCTemplate): ISDLCTemplate {
    const childLogger = this.logger.child({
      component: 'TemplateInheritance',
      parentId: parent.id,
      childId: child.id
    });
    childLogger.debug('Merging templates');

    const merged: ISDLCTemplate = {
      ...parent,
      ...child,
      // Merge arrays
      variables: this.mergeVariables(parent.variables || [], child.variables || []),
      tags: this.mergeTags(parent.tags || [], child.tags || []),
      // Replace {{> parent}} with parent content
      content: this.mergeContent(parent.content, child.content),
      // Preserve child's parent reference
      parent: child.parent
    };

    // Handle metadata merging
    if (parent.phase || child.phase) {
      merged.phase = child.phase || parent.phase;
    }

    childLogger.debug('Templates merged successfully');
    return merged;
  }

  async getInheritanceChain(templateId: string): Promise<string[]> {
    const childLogger = this.logger.child({
      component: 'TemplateInheritance',
      templateId
    });
    childLogger.debug('Building inheritance chain');

    const chain: string[] = [templateId];
    const visited = new Set<string>([templateId]);

    let currentId = templateId;
    while (true) {
      const template = await this.templateGetter!(currentId);
      if (!template || !template.parent) {
        break;
      }

      // Check for circular inheritance
      if (visited.has(template.parent)) {
        throw new Error(`Circular inheritance detected: ${templateId} -> ${template.parent}`);
      }

      chain.push(template.parent);
      visited.add(template.parent);
      currentId = template.parent;
    }

    childLogger.debug('Inheritance chain built', { 
      chain,
      depth: chain.length 
    });

    return chain;
  }

  private mergeVariables(
    parentVars: ISDLCTemplate['variables'],
    childVars: ISDLCTemplate['variables']
  ): ISDLCTemplate['variables'] {
    const merged = [...parentVars];

    // Add or override child variables
    for (const childVar of childVars) {
      const existingIndex = merged.findIndex(v => v.name === childVar.name);
      
      if (existingIndex >= 0) {
        // Override parent variable
        merged[existingIndex] = childVar;
      } else {
        // Add new variable
        merged.push(childVar);
      }
    }

    return merged;
  }

  private mergeTags(parentTags: string[], childTags: string[]): string[] {
    const tagSet = new Set([...parentTags, ...childTags]);
    return Array.from(tagSet);
  }

  private mergeContent(parentContent: string, childContent: string): string {
    // Replace {{> parent}} placeholder with parent content
    return childContent.replace(/\{\{>\s*parent\s*\}\}/g, parentContent);
  }

  clearCache(): void {
    this.resolvedCache.clear();
    this.logger.debug('Template inheritance cache cleared', {
      component: 'TemplateInheritance'
    });
  }
}