# @chasenocap/sdlc-content

SDLC templates and knowledge base for the metaGOTHIC framework. Provides comprehensive document templates, best practices, and knowledge management for software development lifecycle phases.

## Features

- 📄 **Template System**: Flexible template engine with variable substitution, conditionals, and loops
- 🧬 **Template Inheritance**: Support for template hierarchies and composition
- 📚 **Knowledge Base**: Curated best practices, guidelines, and anti-patterns
- ✅ **Validation**: Schema-based validation for templates and content
- 🔍 **Search**: Full-text search across knowledge entries
- 🎯 **Phase-Specific**: Content organized by SDLC phases
- 📊 **Event Emission**: Track template usage and content access

## Installation

```bash
npm install @chasenocap/sdlc-content
```

## Usage

### Basic Template Rendering

```typescript
import { createContentContainer } from '@chasenocap/sdlc-content';
import { createLogger } from '@chasenocap/logger';
import { EventBus } from '@chasenocap/event-system';
import { NodeFileSystem } from '@chasenocap/file-system';

// Create container with dependencies
const container = createContentContainer({
  logger: createLogger({ service: 'sdlc-content' }),
  eventBus: new EventBus(logger),
  fileSystem: new NodeFileSystem(logger)
});

// Get content manager
const contentManager = container.get(CONTENT_TYPES.IContentManager);

// Initialize with templates and knowledge base
await contentManager.initialize('./templates', './knowledge-base/knowledge.yaml');

// Render a template
const rendered = await contentManager.renderTemplate('requirements-spec', {
  documentTitle: 'System Requirements',
  projectName: 'MetaGOTHIC',
  version: '1.0.0',
  author: 'Development Team',
  date: new Date(),
  systemName: 'MetaGOTHIC Framework',
  stakeholders: [
    { name: 'Product Owner', role: 'Decision Maker', interest: 'Business value' },
    { name: 'Dev Team', role: 'Implementation', interest: 'Technical feasibility' }
  ],
  functionalRequirements: [
    {
      id: 'FR-001',
      title: 'User Authentication',
      priority: 'High',
      description: 'System shall provide secure user authentication',
      criteria: ['Users can log in', 'Sessions are secure', 'Password reset available']
    }
  ],
  nonFunctionalRequirements: [
    {
      category: 'Performance',
      title: 'Response Time',
      description: 'Page load time requirement',
      measure: 'Time to interactive',
      target: '< 3 seconds'
    }
  ]
});
```

### Template Variables and Validation

```typescript
// Extract variables from template
const renderer = container.get(CONTENT_TYPES.ITemplateRenderer);
const variables = renderer.extractVariables(templateContent);

// Validate variables before rendering
const validation = renderer.validateVariables(template, {
  projectName: 'My Project',
  // Missing required 'author' variable
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Knowledge Base Search

```typescript
// Search for best practices
const entries = await contentManager.searchKnowledge({
  text: 'requirements',
  category: 'best-practice',
  phase: 'requirements',
  limit: 10
});

// Get related knowledge
const related = await contentManager.getRelatedKnowledge('req-elicitation-techniques');
```

### Template Inheritance

```typescript
// Create a child template that extends document-base
const childTemplate = {
  id: 'technical-spec',
  name: 'Technical Specification',
  parent: 'document-base', // Inherits from base template
  category: 'document',
  version: '1.0.0',
  variables: [
    // Inherits all parent variables
    // Add new ones specific to technical specs
    { name: 'architecture', type: 'object', required: true },
    { name: 'technologies', type: 'array', required: true }
  ],
  content: `
{{> parent}} <!-- Include parent content -->

## Technical Architecture

### System Architecture
{{architecture.description}}

### Technology Stack
{{#each technologies as tech}}
- **{{tech.name}}**: {{tech.purpose}}
{{/each}}
  `
};
```

## Template Syntax

### Variables
```handlebars
{{variableName}}
{{user.name}}
{{config.settings.timeout}}
```

### Conditionals
```handlebars
{{#if isEnabled}}
  Feature is enabled
{{/if}}

{{#if user.role}}
  Welcome, {{user.name}}!
{{/if}}
```

### Loops
```handlebars
{{#each items as item}}
  - {{item.name}}: {{item.value}}
{{/each}}
```

## Content Structure

### Templates Directory
```
templates/
├── base/              # Base templates for inheritance
│   └── document-base.yaml
├── phases/            # Phase-specific templates
│   ├── requirements-spec.yaml
│   ├── design-doc.yaml
│   ├── test-plan.yaml
│   └── deployment-guide.yaml
├── deliverables/      # Deliverable templates
│   ├── user-manual.yaml
│   └── api-docs.yaml
└── checklists/        # Checklist templates
    ├── code-review.yaml
    └── release-checklist.yaml
```

### Knowledge Base Structure
```yaml
version: 1.0.0
categories:
  - id: requirements
    name: Requirements Engineering
    description: Best practices for requirements
entries:
  - id: unique-id
    category: best-practice
    phase: requirements
    title: Entry Title
    content: |
      Markdown content with best practices
    tags:
      - requirements
      - elicitation
    relatedEntries:
      - other-entry-id
```

## API Reference

### IContentManager
- `getTemplate(templateId)`: Get a specific template
- `getAllTemplates(filter)`: Get filtered templates
- `renderTemplate(templateId, variables)`: Render template with variables
- `validateTemplate(template)`: Validate template structure
- `searchKnowledge(query)`: Search knowledge base
- `getRelatedKnowledge(entryId)`: Get related entries

### ITemplateRenderer
- `render(template, variables)`: Render template string
- `validateVariables(template, variables)`: Validate variables
- `extractVariables(template)`: Extract variable definitions

### IContentValidator
- `validateTemplate(template)`: Validate template schema
- `validateKnowledgeEntry(entry)`: Validate knowledge entry
- `validateVariables(variables, values)`: Validate variable values

## Events

The package emits events for monitoring and debugging:

- `template.loaded`: Templates loaded from disk
- `template.rendered`: Template successfully rendered
- `template.validation.failed`: Template validation errors
- `knowledge.searched`: Knowledge base searched
- `content.changed`: Content files changed on disk

## Contributing

1. Follow the established patterns
2. Add tests for new features
3. Update documentation
4. Ensure validation passes

## License

MIT