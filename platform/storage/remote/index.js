/**
 * Multi-Backend Remote Storage Adapter Factory
 * Core: platform/storage/remote/index.js
 */

import {
  RemoteObjectStore,
  MemoryRemoteAdapter,
  RemoteStorageError,
  AuthenticationError,
  NotFoundError,
  PreconditionFailedError,
  NetworkError
} from './remote-adapter.js';
import { WebDavAdapter, mergeSegmentsWithoutOverlap } from './webdav-adapter.js';

export {
  RemoteObjectStore,
  MemoryRemoteAdapter,
  WebDavAdapter,
  mergeSegmentsWithoutOverlap,
  RemoteStorageError,
  AuthenticationError,
  NotFoundError,
  PreconditionFailedError,
  NetworkError
};

/**
 * Adapter Factory
 * Instantiates the appropriate storage adapter based on config.provider
 */
export function createRemoteAdapter(config = {}) {
  const provider = (config.provider || config.providerId || 'webdav').toLowerCase();

  switch (provider) {
    case 'webdav':
      return new WebDavAdapter(config);
    case 'memory':
    case 'mock':
      return new MemoryRemoteAdapter(config);
    default:
      throw new RemoteStorageError(`Unsupported remote storage provider: ${provider}`);
  }
}
