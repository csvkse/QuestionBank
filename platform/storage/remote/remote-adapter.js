/**
 * Remote Storage Adapter Interface and Base Errors
 * Core: platform/storage/remote/remote-adapter.js
 */

export class RemoteStorageError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RemoteStorageError';
    this.statusCode = options.statusCode || 0;
    this.cause = options.cause || null;
    this.recoverable = options.recoverable ?? true;
  }
}

export class AuthenticationError extends RemoteStorageError {
  constructor(message = '认证失败或凭据无效', options = {}) {
    super(message, { ...options, recoverable: false });
    this.name = 'AuthenticationError';
    this.statusCode = options.statusCode || 401;
  }
}

export class NotFoundError extends RemoteStorageError {
  constructor(message = '目标对象不存在', options = {}) {
    super(message, options);
    this.name = 'NotFoundError';
    this.statusCode = options.statusCode || 404;
  }
}

export class PreconditionFailedError extends RemoteStorageError {
  constructor(message = '条件冲突：远端资源已被修改 (412 Precondition Failed)', options = {}) {
    super(message, { ...options, recoverable: true });
    this.name = 'PreconditionFailedError';
    this.statusCode = 412;
    this.serverEtag = options.serverEtag || null;
  }
}

export class NetworkError extends RemoteStorageError {
  constructor(message = '网络不可达或跨域 (CORS) 受限', options = {}) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export class RemoteObjectStore {
  constructor(config = {}) {
    this.config = config;
  }

  async probe(signal) {
    throw new Error('probe() must be implemented by subclass');
  }

  async get(path, signal) {
    throw new Error('get() must be implemented by subclass');
  }

  async put(path, bytes, options = {}) {
    throw new Error('put() must be implemented by subclass');
  }

  async list(prefix, signal) {
    throw new Error('list() must be implemented by subclass');
  }

  async remove(path, options = {}, signal) {
    throw new Error('remove() must be implemented by subclass');
  }
}

/**
 * Memory Remote Adapter for testing & isolated environments
 */
export class MemoryRemoteAdapter extends RemoteObjectStore {
  constructor(config = {}) {
    super(config);
    this.objects = new Map(); // path -> { bytes, etag, modifiedAt, contentType }
    this.versionCounter = 1;
  }

  _generateEtag() {
    return `"mem-${this.versionCounter++}-${Date.now()}"`;
  }

  async probe(signal) {
    return {
      ok: true,
      read: true,
      write: true,
      conditionalCreate: true,
      conditionalReplace: true,
      list: true,
      provider: 'memory'
    };
  }

  async get(path, signal) {
    const item = this.objects.get(path);
    if (!item) {
      throw new NotFoundError(`Object not found: ${path}`);
    }
    return {
      bytes: item.bytes,
      etag: item.etag,
      contentType: item.contentType,
      modifiedAt: item.modifiedAt
    };
  }

  async put(path, bytes, options = {}) {
    const existing = this.objects.get(path);

    if (options.ifNoneMatch === '*' && existing) {
      throw new PreconditionFailedError(`Target already exists: ${path}`, { serverEtag: existing.etag });
    }

    if (options.ifMatch && (!existing || existing.etag !== options.ifMatch)) {
      throw new PreconditionFailedError(`ETag mismatch: ${path}`, { serverEtag: existing?.etag });
    }

    let serialized;
    if (typeof bytes === 'string') {
      serialized = bytes;
    } else if (bytes instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && bytes instanceof ArrayBuffer)) {
      serialized = new TextDecoder().decode(bytes);
    } else {
      serialized = JSON.stringify(bytes);
    }

    const etag = this._generateEtag();
    const modifiedAt = new Date().toISOString();
    this.objects.set(path, {
      bytes: serialized,
      etag,
      contentType: options.contentType || 'application/json; charset=utf-8',
      modifiedAt
    });

    return { etag };
  }

  async list(prefix = '', signal) {
    const results = [];
    for (const [path, item] of this.objects.entries()) {
      if (!prefix || path.startsWith(prefix)) {
        results.push({
          path,
          size: item.bytes.length,
          etag: item.etag,
          modifiedAt: item.modifiedAt,
          isDirectory: false
        });
      }
    }
    return results;
  }

  async remove(path, options = {}, signal) {
    const existing = this.objects.get(path);
    if (!existing) return { success: true };

    if (options.ifMatch && existing.etag !== options.ifMatch) {
      throw new PreconditionFailedError(`ETag mismatch on delete: ${path}`);
    }

    this.objects.delete(path);
    return { success: true };
  }
}
