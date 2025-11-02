/**
 * JSON schemas for SDLC content validation
 */

export const TEMPLATE_SCHEMAS = {
  template: {
    $id: 'https://metagothic.com/schemas/sdlc-template.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'SDLC Template',
    description: 'Schema for SDLC document templates',
    type: 'object',
    required: ['id', 'name', 'category', 'version', 'content'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        pattern: '^[a-zA-Z0-9-_]+$',
        description: 'Unique template identifier'
      },
      name: {
        type: 'string',
        minLength: 1,
        description: 'Human-readable template name'
      },
      category: {
        type: 'string',
        enum: ['phase', 'document', 'deliverable', 'checklist'],
        description: 'Template category'
      },
      phase: {
        type: 'string',
        description: 'Associated SDLC phase'
      },
      version: {
        type: 'string',
        pattern: '^\\d+\\.\\d+\\.\\d+$',
        description: 'Semantic version'
      },
      description: {
        type: 'string',
        description: 'Template description'
      },
      variables: {
        type: 'array',
        items: {
          $ref: '#/definitions/templateVariable'
        },
        description: 'Template variables'
      },
      content: {
        type: 'string',
        minLength: 1,
        description: 'Template content with variable placeholders'
      },
      parent: {
        type: 'string',
        description: 'Parent template ID for inheritance'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Template tags for categorization'
      }
    },
    definitions: {
      templateVariable: {
        type: 'object',
        required: ['name', 'type', 'required'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            pattern: '^[a-zA-Z0-9_.]+$'
          },
          description: {
            type: 'string'
          },
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'date', 'array', 'object']
          },
          required: {
            type: 'boolean'
          },
          default: {},
          validation: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string'
              },
              min: {
                type: 'number'
              },
              max: {
                type: 'number'
              },
              enum: {
                type: 'array'
              },
              custom: {
                type: 'string'
              }
            }
          }
        }
      }
    }
  },

  knowledgeBase: {
    $id: 'https://metagothic.com/schemas/knowledge-base.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'SDLC Knowledge Base',
    description: 'Schema for SDLC knowledge base',
    type: 'object',
    required: ['version', 'entries'],
    properties: {
      version: {
        type: 'string',
        pattern: '^\\d+\\.\\d+\\.\\d+$'
      },
      entries: {
        type: 'array',
        items: {
          $ref: '#/definitions/knowledgeEntry'
        }
      },
      categories: {
        type: 'array',
        items: {
          $ref: '#/definitions/categoryDefinition'
        }
      },
      tags: {
        type: 'array',
        items: {
          $ref: '#/definitions/tagDefinition'
        }
      }
    },
    definitions: {
      knowledgeEntry: {
        type: 'object',
        required: ['id', 'category', 'title', 'content', 'tags'],
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            pattern: '^[a-zA-Z0-9-_]+$'
          },
          category: {
            type: 'string',
            enum: ['best-practice', 'anti-pattern', 'guideline', 'example', 'reference']
          },
          phase: {
            type: 'string'
          },
          title: {
            type: 'string',
            minLength: 1
          },
          content: {
            type: 'string',
            minLength: 1
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          metadata: {
            type: 'object'
          },
          relatedEntries: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        }
      },
      categoryDefinition: {
        type: 'object',
        required: ['id', 'name', 'description'],
        properties: {
          id: {
            type: 'string',
            minLength: 1
          },
          name: {
            type: 'string',
            minLength: 1
          },
          description: {
            type: 'string'
          },
          parent: {
            type: 'string'
          }
        }
      },
      tagDefinition: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'string',
            minLength: 1
          },
          name: {
            type: 'string',
            minLength: 1
          },
          description: {
            type: 'string'
          },
          color: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$'
          }
        }
      }
    }
  }
};