import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';
import { TestEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import {
  createContentContainer,
  CONTENT_TYPES,
  type IContentManager,
  type ISDLCTemplate,
  type IKnowledgeBase
} from '../../src/index.js';

// Mock implementations
const createMockLogger = (): ILogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => createMockLogger()
} as any);

class MockFileSystem implements IFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Map<string, string[]> = new Map();

  constructor() {
    // Set up test data
    this.setupTestData();
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    
    // Update directory listing
    const dir = this.dirname(path);
    const filename = this.basename(path);
    const dirFiles = this.directories.get(dir) || [];
    if (!dirFiles.includes(filename)) {
      dirFiles.push(filename);
      this.directories.set(dir, dirFiles);
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    return this.directories.get(path) || [];
  }

  async createDirectory(path: string): Promise<void> {
    this.directories.set(path, []);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async removeDirectory(path: string): Promise<void> {
    this.directories.delete(path);
  }

  async getStats(path: string): Promise<any> {
    const isFile = this.files.has(path);
    const isDirectory = this.directories.has(path);
    if (!isFile && !isDirectory) {
      throw new Error(`Path not found: ${path}`);
    }
    return {
      size: isFile ? this.files.get(path)!.length : 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
      isFile,
      isDirectory
    };
  }

  async isFile(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    return this.directories.has(path);
  }

  join(...paths: string[]): string {
    return paths.join('/');
  }

  resolve(...paths: string[]): string {
    return '/' + paths.join('/').replace(/\/+/g, '/').replace(/^\//, '');
  }

  dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  basename(path: string, ext?: string): string {
    const base = path.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }

  relative(from: string, to: string): string {
    return to; // Simplified for testing
  }

  normalize(path: string): string {
    return path.replace(/\/+/g, '/');
  }

  private setupTestData() {
    // Template directory structure
    this.directories.set('templates', ['base-template.yaml', 'child-template.yaml']);
    
    // Base template
    this.files.set('templates/base-template.yaml', `
id: base-template
name: Base Template
category: document
version: 1.0.0
description: Base template for inheritance
variables:
  - name: title
    type: string
    required: true
    description: Document title
  - name: author
    type: string
    required: true
    description: Author name
tags:
  - base
  - template
content: |
  # {{title}}
  
  Author: {{author}}
  
  ## Introduction
  
  This is the base template content.
`);

    // Child template
    this.files.set('templates/child-template.yaml', `
id: child-template
name: Child Template
category: document
version: 1.0.0
parent: base-template
description: Child template extending base
variables:
  - name: section
    type: string
    required: true
    description: Additional section
tags:
  - child
  - extended
content: |
  {{> parent}}
  
  ## {{section}}
  
  This is additional content from the child template.
`);

    // Knowledge base
    this.files.set('knowledge.yaml', `
version: 1.0.0
categories:
  - id: testing
    name: Testing
    description: Testing practices
tags:
  - id: unit-test
    name: Unit Testing
    color: "#3498db"
entries:
  - id: test-first
    category: best-practice
    phase: testing
    title: Test First Development
    content: |
      Write tests before implementation.
      
      Benefits:
      - Clear requirements
      - Better design
      - Confidence in refactoring
    tags:
      - unit-test
      - tdd
    relatedEntries:
      - test-pyramid
  - id: test-pyramid
    category: guideline
    phase: testing
    title: Test Pyramid
    content: |
      Structure your tests as a pyramid:
      - Many unit tests (base)
      - Some integration tests (middle)
      - Few E2E tests (top)
    tags:
      - testing
      - architecture
`);
  }
}

describe('Content Management Integration', () => {
  let container: Container;
  let contentManager: IContentManager;
  let logger: ILogger;
  let eventBus: TestEventBus;
  let fileSystem: MockFileSystem;

  beforeEach(async () => {
    logger = createMockLogger();
    eventBus = new TestEventBus();
    fileSystem = new MockFileSystem();

    // No need to track events manually, TestEventBus does it

    container = createContentContainer({
      logger,
      eventBus,
      fileSystem: fileSystem as any
    });

    contentManager = container.get<IContentManager>(CONTENT_TYPES.IContentManager);
    
    // Initialize content manager
    await contentManager.initialize('templates', 'knowledge.yaml');
  });

  afterEach(() => {
    eventBus.clearEvents();
  });

  describe('Template Management', () => {
    it('should load and render a simple template', async () => {
      const rendered = await contentManager.renderTemplate('base-template', {
        title: 'Test Document',
        author: 'Test Author'
      });

      expect(rendered).toContain('# Test Document');
      expect(rendered).toContain('Author: Test Author');
      expect(rendered).toContain('This is the base template content');
    });

    it('should validate template before rendering', async () => {
      await expect(
        contentManager.renderTemplate('base-template', {
          title: 'Test Document'
          // Missing required 'author'
        })
      ).rejects.toThrow('Invalid template variables');
    });

    it('should handle template inheritance', async () => {
      const rendered = await contentManager.renderTemplate('child-template', {
        title: 'Extended Document',
        author: 'Test Author',
        section: 'Advanced Features'
      });

      // Should include base content
      expect(rendered).toContain('# Extended Document');
      expect(rendered).toContain('Author: Test Author');
      
      // Should include child content
      expect(rendered).toContain('## Advanced Features');
      expect(rendered).toContain('additional content from the child template');
    });

    it('should get all templates with filtering', async () => {
      const allTemplates = await contentManager.getAllTemplates();
      expect(allTemplates).toHaveLength(2);

      const baseTemplates = await contentManager.getAllTemplates({
        tags: ['base']
      });
      expect(baseTemplates).toHaveLength(1);
      expect(baseTemplates[0].id).toBe('base-template');
    });

    it('should emit template events', async () => {
      await contentManager.renderTemplate('base-template', {
        title: 'Test',
        author: 'Author'
      });

      const emittedEvents = eventBus.getEmittedEvents();
      const renderEvent = emittedEvents.find(e => e.type === 'template.rendered.started');
      expect(renderEvent).toBeDefined();
      expect(renderEvent?.payload.templateId).toBe('base-template');
      expect(renderEvent?.payload.variableCount).toBe(2);
    });
  });

  describe('Knowledge Base', () => {
    it('should search knowledge entries by text', async () => {
      const results = await contentManager.searchKnowledge({
        text: 'pyramid'
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-pyramid');
    });

    it('should search knowledge entries by category', async () => {
      const results = await contentManager.searchKnowledge({
        category: 'best-practice'
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-first');
    });

    it('should search knowledge entries by tags', async () => {
      const results = await contentManager.searchKnowledge({
        tags: ['unit-test']
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test First Development');
    });

    it('should get related knowledge entries', async () => {
      const related = await contentManager.getRelatedKnowledge('test-first');

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('test-pyramid');
    });

    it('should emit search events', async () => {
      await contentManager.searchKnowledge({
        text: 'testing',
        limit: 5
      });

      const emittedEvents = eventBus.getEmittedEvents();
      const searchEvent = emittedEvents.find(e => e.type === 'knowledge.searched.started');
      expect(searchEvent).toBeDefined();
      expect(searchEvent?.payload.query.text).toBe('testing');
    });
  });

  describe('Content Validation', () => {
    it('should validate template structure', async () => {
      const template = await contentManager.getTemplate('base-template');
      expect(template).toBeDefined();

      const validation = contentManager.validateTemplate(template!);
      expect(validation.valid).toBe(true);
    });

    it('should detect invalid templates', () => {
      const invalidTemplate: ISDLCTemplate = {
        id: '',
        name: 'Invalid',
        category: 'invalid-category' as any,
        version: 'not-semver',
        content: ''
      };

      const validation = contentManager.validateTemplate(invalidTemplate);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should render template with loops and conditionals', async () => {
      // Create a template with complex syntax
      const complexTemplate: ISDLCTemplate = {
        id: 'complex',
        name: 'Complex Template',
        category: 'document',
        version: '1.0.0',
        content: `
# {{title}}

{{#if features}}
## Features
{{#each features as feature}}
- **{{feature.name}}**: {{feature.description}}
{{/each}}
{{/if}}

{{#if requirements}}
## Requirements
{{#each requirements as req}}
### {{req.id}}
{{req.description}}
{{/each}}
{{/if}}
`,
        variables: [
          { name: 'title', type: 'string', required: true, description: 'Title' },
          { name: 'features', type: 'array', required: false, description: 'Features' },
          { name: 'requirements', type: 'array', required: false, description: 'Requirements' }
        ]
      };

      // Add to file system as YAML
      const complexYaml = `
id: complex
name: Complex Template
category: document
version: 1.0.0
description: Complex template with loops and conditionals
content: |
  # {{title}}
  
  {{#if features}}
  ## Features
  
  {{#each features as feature}}
  **{{feature.name}}**: {{feature.description}}
  {{/each}}
  {{/if}}
  
  {{#if requirements}}
  ## Requirements
  
  {{#each requirements as req}}
  ### {{req.id}}
  {{req.description}}
  {{/each}}
  {{/if}}
variables:
  - name: title
    type: string
    required: true
    description: Title
  - name: features
    type: array
    required: false
    description: Features
  - name: requirements
    type: array
    required: false
    description: Requirements
`;
      (fileSystem as any).files.set('templates/complex.yaml', complexYaml);
      // Also update the directory listing
      const currentFiles = (fileSystem as any).directories.get('templates') || [];
      if (!currentFiles.includes('complex.yaml')) {
        currentFiles.push('complex.yaml');
        (fileSystem as any).directories.set('templates', currentFiles);
      }
      
      // Reload templates
      await contentManager.initialize('templates', 'knowledge.yaml');

      const rendered = await contentManager.renderTemplate('complex', {
        title: 'Product Specification',
        features: [
          { name: 'Feature A', description: 'Does something amazing' },
          { name: 'Feature B', description: 'Does something else' }
        ],
        requirements: [
          { id: 'REQ-001', description: 'Must be fast' },
          { id: 'REQ-002', description: 'Must be secure' }
        ]
      });

      expect(rendered).toContain('# Product Specification');
      expect(rendered).toContain('## Features');
      expect(rendered).toContain('**Feature A**: Does something amazing');
      expect(rendered).toContain('### REQ-001');
    });
  });
});