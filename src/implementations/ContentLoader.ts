import { injectable, inject } from 'inversify';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import type {
  IContentLoader,
  ISDLCTemplate,
  IKnowledgeBase,
  IContentChange
} from '../types/ContentTypes.js';

@injectable()
export class ContentLoader implements IContentLoader {
  private watchers: Map<string, any> = new Map();

  constructor(
    @inject('ILogger') private logger: ILogger,
    @inject('IFileSystem') private fileSystem: IFileSystem
  ) {}

  async loadTemplates(directory: string): Promise<ISDLCTemplate[]> {
    const childLogger = this.logger.child({
      component: 'ContentLoader',
      directory
    });
    childLogger.info('Loading templates from directory');

    try {
      const templates: ISDLCTemplate[] = [];
      const files = await this.fileSystem.listDirectory(directory);

      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(directory, file);
          const content = await this.fileSystem.readFile(filePath);
          
          try {
            const template = yaml.load(content) as ISDLCTemplate;
            
            // Add file-based ID if not present
            if (!template.id) {
              template.id = path.basename(file, path.extname(file));
            }
            
            templates.push(template);
            childLogger.debug('Template loaded', { templateId: template.id });
          } catch (error) {
            childLogger.error('Failed to parse template file', error as Error, {
              file: filePath
            });
          }
        }
      }

      // Load subdirectories recursively
      for (const file of files) {
        const filePath = path.join(directory, file);
        if (await this.isDirectory(filePath)) {
          const subTemplates = await this.loadTemplates(filePath);
          templates.push(...subTemplates);
        }
      }

      childLogger.info('Templates loaded successfully', { count: templates.length });
      return templates;
    } catch (error) {
      childLogger.error('Failed to load templates', error as Error);
      throw error;
    }
  }

  async loadKnowledgeBase(file: string): Promise<IKnowledgeBase> {
    const childLogger = this.logger.child({
      component: 'ContentLoader',
      file
    });
    childLogger.info('Loading knowledge base');

    try {
      const content = await this.fileSystem.readFile(file);
      const knowledgeBase = yaml.load(content) as IKnowledgeBase;

      // Validate structure
      if (!knowledgeBase.version || !Array.isArray(knowledgeBase.entries)) {
        throw new Error('Invalid knowledge base format');
      }

      // Set default values
      knowledgeBase.categories = knowledgeBase.categories || [];
      knowledgeBase.tags = knowledgeBase.tags || [];

      childLogger.info('Knowledge base loaded successfully', {
        version: knowledgeBase.version,
        entries: knowledgeBase.entries.length,
        categories: knowledgeBase.categories.length,
        tags: knowledgeBase.tags.length
      });

      return knowledgeBase;
    } catch (error) {
      childLogger.error('Failed to load knowledge base', error as Error);
      throw error;
    }
  }

  watchForChanges(callback: (change: IContentChange) => void): void {
    const childLogger = this.logger.child({ component: 'ContentLoader' });
    childLogger.info('Setting up file watchers');

    // Implementation would watch template and knowledge base directories
    // This is a simplified version
    const handleChange = (type: 'template' | 'knowledge', filePath: string, eventType: string) => {
      const id = path.basename(filePath, path.extname(filePath));
      const action = eventType === 'rename' ? 'added' : 'modified';

      const change: IContentChange = {
        type,
        action,
        id,
        path: filePath
      };

      childLogger.debug('Content change detected', { change });
      callback(change);
    };

    // Watch template directories
    const templateDirs = ['templates', 'templates/phases', 'templates/documents'];
    for (const dir of templateDirs) {
      this.fileSystem.exists(dir).then(exists => {
        if (exists) {
          const watcher = fs.watch(dir, (eventType: string, filename: string | null) => {
            if (filename && (filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
              handleChange('template', path.join(dir, filename), eventType);
            }
          });
          this.watchers.set(dir, watcher);
        }
      });
    }

    // Watch knowledge base
    const knowledgeFile = 'knowledge-base/knowledge.yaml';
    this.fileSystem.exists(knowledgeFile).then(exists => {
      if (exists) {
        const watcher = fs.watch(knowledgeFile, (eventType: string) => {
          handleChange('knowledge', knowledgeFile, eventType);
        });
        this.watchers.set(knowledgeFile, watcher);
      }
    });

    childLogger.info('File watchers set up', { count: this.watchers.size });
  }

  async dispose(): Promise<void> {
    const childLogger = this.logger.child({ component: 'ContentLoader' });
    childLogger.debug('Disposing file watchers');

    for (const [path, watcher] of this.watchers) {
      watcher.close();
      childLogger.debug('Watcher closed', { path });
    }

    this.watchers.clear();
  }

  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fsPromises.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}