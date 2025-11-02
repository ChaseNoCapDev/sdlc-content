# CLAUDE.md - @chasenocap/sdlc-content

This file provides guidance to Claude when working with the sdlc-content package.

## Package Overview

The sdlc-content package provides a comprehensive content management system for SDLC templates and knowledge base. It enables document generation, best practice sharing, and knowledge management throughout the software development lifecycle.

## Key Components

### 1. **TemplateRenderer** (`src/implementations/TemplateRenderer.ts`)
- Renders templates with variable substitution
- Supports conditionals (`{{#if}}`) and loops (`{{#each}}`)
- Validates template variables
- Extracts variable definitions from templates

### 2. **ContentLoader** (`src/implementations/ContentLoader.ts`)
- Loads templates from YAML files
- Loads knowledge base entries
- Watches for file changes
- Supports recursive directory loading

### 3. **ContentValidator** (`src/implementations/ContentValidator.ts`)
- Schema-based validation using AJV
- Validates templates and knowledge entries
- Checks template syntax
- Validates variable values against definitions

### 4. **ContentManager** (`src/implementations/ContentManager.ts`)
- Central API for all content operations
- Manages template rendering
- Provides knowledge search
- Emits events for monitoring

### 5. **TemplateInheritance** (`src/implementations/TemplateInheritance.ts`)
- Resolves template inheritance chains
- Merges parent and child templates
- Detects circular inheritance
- Caches resolved templates

## Template System

### Variable Types
- `string`: Text values
- `number`: Numeric values
- `boolean`: True/false
- `date`: Date values (parsed from strings)
- `array`: Lists of items
- `object`: Complex nested structures

### Template Syntax
```handlebars
{{variableName}}                    # Simple substitution
{{user.name}}                       # Nested properties
{{#if condition}}...{{/if}}         # Conditionals
{{#each items as item}}...{{/each}} # Loops
```

### Variable Validation
```typescript
{
  name: 'email',
  type: 'string',
  required: true,
  validation: {
    pattern: '^[^@]+@[^@]+\.[^@]+$',
    custom: 'validateEmail'
  }
}
```

## Knowledge Base

### Entry Categories
- `best-practice`: Recommended approaches
- `anti-pattern`: Things to avoid
- `guideline`: General guidance
- `example`: Code examples
- `reference`: External references

### Search Capabilities
- Full-text search in title and content
- Filter by category, phase, tags
- Find related entries
- Limit result count

## Usage Patterns

### Loading Content
```typescript
const contentManager = container.get(CONTENT_TYPES.IContentManager);
await contentManager.initialize('./templates', './knowledge-base/knowledge.yaml');
```

### Rendering Templates
```typescript
// Simple rendering
const output = await contentManager.renderTemplate('requirements-spec', {
  projectName: 'My Project',
  author: 'John Doe',
  date: new Date()
});

// With validation
const validation = renderer.validateVariables(template, variables);
if (validation.valid) {
  const output = renderer.render(template.content, variables);
}
```

### Searching Knowledge
```typescript
// Text search
const results = await contentManager.searchKnowledge({
  text: 'testing strategies',
  limit: 10
});

// Filtered search
const practices = await contentManager.searchKnowledge({
  category: 'best-practice',
  phase: 'testing',
  tags: ['automation']
});
```

## File Organization

### Templates
- Place in `templates/` directory
- Use `.yaml` or `.yml` extension
- Organize by category or phase
- Use meaningful IDs

### Knowledge Base
- Single `knowledge.yaml` file
- Define categories and tags
- Each entry needs unique ID
- Use Markdown for content

## Testing Approach

### Unit Tests
- Test each component in isolation
- Mock dependencies
- Cover edge cases
- Test validation logic

### Integration Tests
- Test file loading
- Test template inheritance
- Test knowledge search
- Test event emission

## Common Issues

### 1. **Template Syntax Errors**
- Check for balanced `{{` and `}}`
- Ensure conditionals are closed
- Verify loop syntax

### 2. **Variable Type Mismatches**
- Arrays need array values
- Objects need object values
- Dates can be strings or Date objects

### 3. **Inheritance Cycles**
- Templates cannot inherit from themselves
- Check parent references
- Clear cache after updates

## Integration Points

### With @chasenocap/logger
- All components use child loggers
- Structured logging throughout
- Debug mode for troubleshooting

### With @chasenocap/event-system
- ContentManager emits events
- Track template usage
- Monitor content changes

### With @chasenocap/file-system
- Abstract file operations
- Support for different backends
- Consistent error handling

## Best Practices

1. **Template Design**
   - Keep templates focused
   - Use inheritance for common elements
   - Document all variables
   - Provide sensible defaults

2. **Knowledge Management**
   - Tag entries consistently
   - Link related content
   - Keep entries concise
   - Update regularly

3. **Performance**
   - Cache rendered templates
   - Index knowledge base
   - Lazy load templates
   - Watch for file changes efficiently

## Development Guidelines

1. **Adding Features**
   - Extend interfaces first
   - Maintain backward compatibility
   - Add comprehensive tests
   - Update documentation

2. **Error Handling**
   - Provide clear error messages
   - Include context in errors
   - Log errors appropriately
   - Fail gracefully

3. **Event Design**
   - Emit at significant points
   - Include relevant data
   - Document event types
   - Keep payloads small

## Debugging Tips

1. **Template Issues**
   - Enable debug logging
   - Check extracted variables
   - Validate syntax manually
   - Test with minimal data

2. **Inheritance Problems**
   - Trace inheritance chain
   - Check for cycles
   - Clear cache
   - Log merge operations

3. **Search Problems**
   - Check index building
   - Verify search terms
   - Test filters individually
   - Monitor query performance