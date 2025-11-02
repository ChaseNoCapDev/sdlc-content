import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IEventBus } from '@chasenocap/event-system';
import { setEventBus, Emits } from '@chasenocap/event-system';
import type {
  IContentManager,
  ISDLCTemplate,
  IKnowledgeEntry,
  IKnowledgeBase,
  ITemplateFilter,
  IKnowledgeQuery,
  IContentValidationResult,
  ITemplateRenderer,
  IContentValidator,
  IContentLoader,
  ITemplateInheritance
} from '../types/ContentTypes.js';

@injectable()
export class ContentManager implements IContentManager {
  private templates: Map<string, ISDLCTemplate> = new Map();
  private knowledgeBase: IKnowledgeBase | null = null;
  private knowledgeIndex: Map<string, IKnowledgeEntry> = new Map();

  constructor(
    @inject('ILogger') private logger: ILogger,
    @inject('IEventBus') eventBus: IEventBus,
    @inject('ITemplateRenderer') private renderer: ITemplateRenderer,
    @inject('IContentValidator') private validator: IContentValidator,
    @inject('IContentLoader') private loader: IContentLoader,
    @inject('ITemplateInheritance') private inheritance: ITemplateInheritance
  ) {
    setEventBus(this, eventBus);
    
    // Set up the template getter to break circular dependency
    if ('setTemplateGetter' in this.inheritance) {
      (this.inheritance as any).setTemplateGetter(async (id: string) => {
        return this.templates.get(id);
      });
    }
  }

  async initialize(templateDir: string, knowledgeFile: string): Promise<void> {
    const childLogger = this.logger.child({ component: 'ContentManager' });
    childLogger.info('Initializing content manager');

    // Load templates
    const templates = await this.loader.loadTemplates(templateDir);
    for (const template of templates) {
      this.templates.set(template.id, template);
    }

    // Load knowledge base
    this.knowledgeBase = await this.loader.loadKnowledgeBase(knowledgeFile);
    
    // Index knowledge entries
    for (const entry of this.knowledgeBase.entries) {
      this.knowledgeIndex.set(entry.id, entry);
    }

    // Set up change watchers
    this.loader.watchForChanges(async (change) => {
      childLogger.info('Content change detected', { change });
      
      if (change.type === 'template' && change.path) {
        // Reload specific template
        const templates = await this.loader.loadTemplates(change.path);
        for (const template of templates) {
          this.templates.set(template.id, template);
        }
      } else if (change.type === 'knowledge' && change.path) {
        // Reload knowledge base
        this.knowledgeBase = await this.loader.loadKnowledgeBase(change.path);
        this.rebuildKnowledgeIndex();
      }
    });

    childLogger.info('Content manager initialized', {
      templates: this.templates.size,
      knowledgeEntries: this.knowledgeIndex.size
    });
  }

  async getTemplate(templateId: string): Promise<ISDLCTemplate | undefined> {
    const childLogger = this.logger.child({
      component: 'ContentManager',
      templateId
    });
    childLogger.debug('Getting template');

    const template = this.templates.get(templateId);
    if (!template) {
      childLogger.warn('Template not found');
      return undefined;
    }

    // Resolve inheritance
    if (template.parent) {
      return await this.inheritance.resolveTemplate(templateId);
    }

    return template;
  }

  @Emits('template.loaded', {
    payloadMapper: (_filter?: ITemplateFilter) => ({ count: 0 })
  })
  async getAllTemplates(filter?: ITemplateFilter): Promise<ISDLCTemplate[]> {
    const childLogger = this.logger.child({ component: 'ContentManager' });
    childLogger.debug('Getting all templates', { filter });

    let templates = Array.from(this.templates.values());

    if (filter) {
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }
      if (filter.phase) {
        templates = templates.filter(t => t.phase === filter.phase);
      }
      if (filter.tags && filter.tags.length > 0) {
        templates = templates.filter(t => 
          t.tags && filter.tags!.some(tag => t.tags!.includes(tag))
        );
      }
      if (filter.parent !== undefined) {
        templates = templates.filter(t => t.parent === filter.parent);
      }
    }

    childLogger.debug('Templates filtered', { count: templates.length });
    return templates;
  }

  @Emits('template.rendered', {
    payloadMapper: (templateId: string, variables: Record<string, unknown>) => ({ 
      templateId, 
      variableCount: Object.keys(variables).length
    })
  })
  async renderTemplate(
    templateId: string,
    variables: Record<string, unknown>
  ): Promise<string> {
    const childLogger = this.logger.child({
      component: 'ContentManager',
      templateId
    });
    childLogger.info('Rendering template');

    const startTime = Date.now();

    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate variables
    const validation = this.renderer.validateVariables(template, variables);
    if (!validation.valid) {
      childLogger.error('Template variable validation failed', new Error('Validation failed'), {
        errors: validation.errors
      });
      const error = new Error(`Invalid template variables: ${validation.errors.map(e => e.message).join(', ')}`);
      throw error;
    }

    // Render template
    const rendered = this.renderer.render(template.content, variables);
    
    const duration = Date.now() - startTime;
    childLogger.info('Template rendered successfully', { duration });

    // The @Emits decorator will automatically emit the event with these return values
    return rendered;
  }

  @Emits('template.validation.failed', {
    payloadMapper: (templateId: string, errors: unknown[]) => ({ templateId, errors })
  })
  validateTemplate(template: ISDLCTemplate): IContentValidationResult {
    const childLogger = this.logger.child({
      component: 'ContentManager',
      templateId: template.id
    });
    childLogger.debug('Validating template');

    const result = this.validator.validateTemplate(template);

    if (!result.valid) {
      childLogger.warn('Template validation failed', {
        errors: result.errors.length,
        warnings: result.warnings.length
      });
    }

    return result;
  }

  async getKnowledgeEntry(entryId: string): Promise<IKnowledgeEntry | undefined> {
    const childLogger = this.logger.child({
      component: 'ContentManager',
      entryId
    });
    childLogger.debug('Getting knowledge entry');

    const entry = this.knowledgeIndex.get(entryId);
    if (!entry) {
      childLogger.warn('Knowledge entry not found');
    }

    return entry;
  }

  @Emits('knowledge.searched', {
    payloadMapper: (query: IKnowledgeQuery) => ({ query })
  })
  async searchKnowledge(query: IKnowledgeQuery): Promise<IKnowledgeEntry[]> {
    const childLogger = this.logger.child({ component: 'ContentManager' });
    childLogger.debug('Searching knowledge base', { query });

    let entries = Array.from(this.knowledgeIndex.values());

    // Apply filters
    if (query.category) {
      entries = entries.filter(e => e.category === query.category);
    }

    if (query.phase) {
      entries = entries.filter(e => e.phase === query.phase);
    }

    if (query.tags && query.tags.length > 0) {
      entries = entries.filter(e =>
        query.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // Text search (simple implementation)
    if (query.text) {
      const searchText = query.text.toLowerCase();
      entries = entries.filter(e =>
        e.title.toLowerCase().includes(searchText) ||
        e.content.toLowerCase().includes(searchText) ||
        e.tags.some(tag => tag.toLowerCase().includes(searchText))
      );
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      entries = entries.slice(0, query.limit);
    }

    childLogger.debug('Knowledge search complete', { results: entries.length });
    return entries;
  }

  async getRelatedKnowledge(entryId: string): Promise<IKnowledgeEntry[]> {
    const childLogger = this.logger.child({
      component: 'ContentManager',
      entryId
    });
    childLogger.debug('Getting related knowledge');

    const entry = await this.getKnowledgeEntry(entryId);
    if (!entry) {
      return [];
    }

    const related: IKnowledgeEntry[] = [];

    // Get directly related entries
    if (entry.relatedEntries) {
      for (const relatedId of entry.relatedEntries) {
        const relatedEntry = await this.getKnowledgeEntry(relatedId);
        if (relatedEntry) {
          related.push(relatedEntry);
        }
      }
    }

    // Find entries with matching tags
    const taggedEntries = await this.searchKnowledge({
      tags: entry.tags,
      limit: 10
    });

    // Add unique entries
    for (const tagged of taggedEntries) {
      if (tagged.id !== entryId && !related.some(r => r.id === tagged.id)) {
        related.push(tagged);
      }
    }

    childLogger.debug('Related knowledge found', { count: related.length });
    return related;
  }

  private rebuildKnowledgeIndex(): void {
    this.knowledgeIndex.clear();
    
    if (this.knowledgeBase) {
      for (const entry of this.knowledgeBase.entries) {
        this.knowledgeIndex.set(entry.id, entry);
      }
    }

    this.logger.debug('Knowledge index rebuilt', {
      component: 'ContentManager',
      entries: this.knowledgeIndex.size
    });
  }
}