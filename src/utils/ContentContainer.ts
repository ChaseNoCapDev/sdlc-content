import { Container } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IEventBus } from '@chasenocap/event-system';
import type { IFileSystem } from '@chasenocap/file-system';
import {
  CONTENT_TYPES,
  type ITemplateRenderer,
  type IContentLoader,
  type IContentValidator,
  type IContentManager,
  type ITemplateInheritance
} from '../index.js';
import { TemplateRenderer } from '../implementations/TemplateRenderer.js';
import { ContentLoader } from '../implementations/ContentLoader.js';
import { ContentValidator } from '../implementations/ContentValidator.js';
import { ContentManager } from '../implementations/ContentManager.js';
import { TemplateInheritance } from '../implementations/TemplateInheritance.js';

export interface IContentContainerOptions {
  logger: ILogger;
  eventBus: IEventBus;
  fileSystem: IFileSystem;
}

export function createContentContainer(options: IContentContainerOptions): Container {
  const container = new Container();

  // Bind external dependencies
  container.bind<ILogger>('ILogger').toConstantValue(options.logger);
  container.bind<IEventBus>('IEventBus').toConstantValue(options.eventBus);
  container.bind<IFileSystem>('IFileSystem').toConstantValue(options.fileSystem);

  // Bind content services with string tokens for internal use
  container.bind<ITemplateRenderer>('ITemplateRenderer')
    .to(TemplateRenderer)
    .inSingletonScope();

  container.bind<IContentLoader>('IContentLoader')
    .to(ContentLoader)
    .inSingletonScope();

  container.bind<IContentValidator>('IContentValidator')
    .to(ContentValidator)
    .inSingletonScope();

  container.bind<ITemplateInheritance>('ITemplateInheritance')
    .to(TemplateInheritance)
    .inSingletonScope();

  container.bind<IContentManager>('IContentManager')
    .to(ContentManager)
    .inSingletonScope();

  // Bind with public symbols
  container.bind<ITemplateRenderer>(CONTENT_TYPES.ITemplateRenderer)
    .toService('ITemplateRenderer');

  container.bind<IContentLoader>(CONTENT_TYPES.IContentLoader)
    .toService('IContentLoader');

  container.bind<IContentValidator>(CONTENT_TYPES.IContentValidator)
    .toService('IContentValidator');

  container.bind<IContentManager>(CONTENT_TYPES.IContentManager)
    .toService('IContentManager');

  container.bind<ITemplateInheritance>(CONTENT_TYPES.ITemplateInheritance)
    .toService('ITemplateInheritance');

  return container;
}