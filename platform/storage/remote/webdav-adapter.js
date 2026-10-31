/**
 * WebDAV Remote Storage Adapter
 * Core: platform/storage/remote/webdav-adapter.js
 */

import {
  RemoteObjectStore,
  RemoteStorageError,
  AuthenticationError,
  NotFoundError,
  PreconditionFailedError,
  NetworkError
} from './remote-adapter.js';

export function mergeSegmentsWithoutOverlap(a, b) {
  for (let k = Math.min(a.length, b.length); k > 0; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      if (a[a.length - k + i] !== b[i]) { match = false; break; }
    }
    if (match) return [...a, ...b.slice(k)];
  }
  return [...a, ...b];
}

export class WebDavAdapter extends RemoteObjectStore {
  constructor(config = {}) {
    super(config);
    this.endpoint = (config.endpoint || '').trim().replace(/\/+$/, '');
    if (this.endpoint && !/^https?:\/\//i.test(this.endpoint)) this.endpoint = `https://${this.endpoint}`;
    this.username = config.username || '';
    this.password = config.password || '';
    this.token = config.token || '';
    this.authType = config.authType || (this.token ? 'bearer' : (this.username ? 'basic' : 'none'));
    this.basePath = (config.basePath || '').trim().replace(/^\/+|\/+$/g, '');
    this._ensuredCollections = new Set();
  }

  _encodeBasicAuth() {
    const raw = `${this.username}:${this.password}`;
    if (typeof btoa === 'function') return btoa(raw);
    if (typeof Buffer !== 'undefined') return Buffer.from(raw).toString('base64');
    throw new Error('No base64 encoding available');
  }

  _getAuthHeader() {
    if (this.authType === 'bearer' && this.token) return `Bearer ${this.token}`;
    if (this.authType === 'basic' && (this.username || this.password)) {
      return `Basic ${this._encodeBasicAuth()}`;
    }
    return null;
  }

  _buildUrl(relPath) {
    if (!this.endpoint) throw new RemoteStorageError('WebDAV endpoint not configured');
    let cleanRel = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (cleanRel.includes('..')) throw new RemoteStorageError('Relative path traversal (..) forbidden');

    let endpointObj = null, endpointSegments = [];
    try {
      endpointObj = new URL(this.endpoint);
      endpointSegments = endpointObj.pathname.split('/').filter(Boolean);
    } catch { endpointSegments = []; }

    const baseSegments = (this.basePath || '').split('/').filter(Boolean);
    const relSegments = cleanRel.split('/').filter(Boolean);

    const endPlusBase = mergeSegmentsWithoutOverlap(endpointSegments, baseSegments);
    const allSegments = mergeSegmentsWithoutOverlap(endPlusBase, relSegments);

    const encodedPath = allSegments.map(s => encodeURIComponent(s)).join('/');
    const origin = endpointObj ? endpointObj.origin : this.endpoint.replace(/\/+$/, '');
    return `${origin}/${encodedPath}`;
  }

  async _request(method, relPath, options = {}) {
    const url = this._buildUrl(relPath);
    const headers = new Headers(options.headers || {});
    const auth = this._getAuthHeader();
    if (auth && !headers.has('Authorization')) headers.set('Authorization', auth);

    const fetchOptions = { method, headers, signal: options.signal };
    if (options.body !== undefined && options.body !== null) fetchOptions.body = options.body;

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new NetworkError(`Network / CORS request failed: ${err.message}`, { cause: err });
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(`WebDAV authentication rejected (${response.status})`, { statusCode: response.status });
    }
    if (response.status === 404) {
      throw new NotFoundError(`WebDAV resource not found: ${relPath}`, { statusCode: 404 });
    }
    if (response.status === 412) {
      const serverEtag = response.headers.get('etag') || response.headers.get('ETag');
      throw new PreconditionFailedError(`WebDAV precondition failed for ${relPath}`, { serverEtag });
    }
    if (!response.ok && response.status !== 207) {
      const text = await response.text().catch(() => '');
      throw new RemoteStorageError(`WebDAV HTTP ${response.status}: ${text || response.statusText}`, { statusCode: response.status });
    }
    return response;
  }

  async mkcol(colPath, options = {}) {
    const url = (colPath.startsWith('http://') || colPath.startsWith('https://')) ? colPath : this._buildUrl(colPath);
    const headers = new Headers(options.headers || {});
    const auth = this._getAuthHeader();
    if (auth && !headers.has('Authorization')) headers.set('Authorization', auth);

    let response;
    try {
      response = await fetch(url, { method: 'MKCOL', headers, signal: options.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new NetworkError(`Network / CORS request failed on MKCOL: ${err.message}`, { cause: err });
    }

    if (response.status === 201 || response.status === 405 || response.status === 200 || response.status === 204) {
      return { created: response.status === 201, exists: true };
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(`WebDAV authentication rejected on MKCOL (${response.status})`, { statusCode: response.status });
    }
    const text = await response.text().catch(() => '');
    throw new RemoteStorageError(`WebDAV MKCOL HTTP ${response.status}: ${text || response.statusText}`, { statusCode: response.status });
  }

  async ensureParentCollections(filePath, signal) {
    const fileUrl = this._buildUrl(filePath);
    let urlObj;
    try { urlObj = new URL(fileUrl); } catch { return; }

    const fileSegments = urlObj.pathname.split('/').filter(Boolean);
    if (fileSegments.length <= 1) return;
    fileSegments.pop();

    let endpointSegments = [];
    try { endpointSegments = new URL(this.endpoint).pathname.split('/').filter(Boolean); } catch {}

    const startIndex = endpointSegments.length;
    for (let i = startIndex + 1; i <= fileSegments.length; i++) {
      const colUrl = `${urlObj.origin}/${fileSegments.slice(0, i).join('/')}`;
      if (this._ensuredCollections.has(colUrl)) continue;

      try {
        await this.mkcol(colUrl, { signal });
        this._ensuredCollections.add(colUrl);
      } catch (err) {
        if (err.statusCode === 405) this._ensuredCollections.add(colUrl);
        else throw err;
      }
    }
  }

  async put(path, bytes, options = {}) {
    await this.ensureParentCollections(path, options.signal);

    const headers = { 'Content-Type': options.contentType || 'application/json; charset=utf-8' };
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch;

    const body = typeof bytes === 'string' ? bytes : JSON.stringify(bytes);
    let res;
    try {
      res = await this._request('PUT', path, { body, headers, signal: options.signal });
    } catch (err) {
      if (err.statusCode === 409) {
        this._ensuredCollections.clear();
        await this.ensureParentCollections(path, options.signal);
        res = await this._request('PUT', path, { body, headers, signal: options.signal });
      } else {
        throw err;
      }
    }
    return { etag: res.headers.get('etag') || res.headers.get('ETag') || null };
  }

  async get(path, signal) {
    const res = await this._request('GET', path, { signal });
    return {
      bytes: await res.text(),
      etag: res.headers.get('etag') || res.headers.get('ETag') || null,
      contentType: res.headers.get('content-type') || 'application/json',
      modifiedAt: res.headers.get('last-modified') || null
    };
  }

  async remove(path, options = {}, signal) {
    const headers = options.ifMatch ? { 'If-Match': options.ifMatch } : {};
    await this._request('DELETE', path, { headers, signal });
    return { success: true };
  }

  async list(prefix = '', signal) {
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getetag/><d:getlastmodified/></d:prop></d:propfind>`;
    const res = await this._request('PROPFIND', prefix, { headers: { Depth: '1' }, body: propfindXml, signal });
    return this._parseMultistatusXml(await res.text());
  }

  _parseMultistatusXml(xmlText) {
    const items = [];
    if (!xmlText) return items;
    const responseRegex = /<([a-zA-Z0-9]+:)?response\b[^>]*>([\s\S]*?)<\/\1?response>/gi;
    let match;

    while ((match = responseRegex.exec(xmlText)) !== null) {
      const block = match[2];
      const hrefMatch = block.match(/<([a-zA-Z0-9]+:)?href\b[^>]*>([\s\S]*?)<\/\1?href>/i);
      if (!hrefMatch) continue;

      const rawHref = decodeURIComponent(hrefMatch[2].trim());
      const isCollection = /<([a-zA-Z0-9]+:)?resourcetype\b[^>]*>[\s\S]*?<([a-zA-Z0-9]+:)?collection\b/i.test(block);
      const lenMatch = block.match(/<([a-zA-Z0-9]+:)?getcontentlength\b[^>]*>(\d+)<\/\1?getcontentlength>/i);
      const etagMatch = block.match(/<([a-zA-Z0-9]+:)?getetag\b[^>]*>([^<]+)<\/\1?getetag>/i);
      const modMatch = block.match(/<([a-zA-Z0-9]+:)?getlastmodified\b[^>]*>([^<]+)<\/\1?getlastmodified>/i);

      items.push({
        path: this._normalizeListedPath(rawHref),
        size: lenMatch ? parseInt(lenMatch[2], 10) : 0,
        etag: etagMatch ? etagMatch[2].trim() : null,
        modifiedAt: modMatch ? modMatch[2].trim() : null,
        isDirectory: isCollection
      });
    }
    return items;
  }

  _normalizeListedPath(href) {
    try {
      let p = new URL(href, this.endpoint).pathname;
      let endpointSegments = [];
      try { endpointSegments = new URL(this.endpoint).pathname.split('/').filter(Boolean); } catch {}
      const baseSegments = (this.basePath || '').split('/').filter(Boolean);
      const effectiveBaseSegments = mergeSegmentsWithoutOverlap(endpointSegments, baseSegments);
      const effectiveBasePath = '/' + effectiveBaseSegments.join('/');

      if (effectiveBasePath !== '/' && p.startsWith(effectiveBasePath)) {
        p = p.slice(effectiveBasePath.length);
      } else {
        const epPath = '/' + endpointSegments.join('/');
        if (epPath !== '/' && p.startsWith(epPath)) p = p.slice(epPath.length);
        const basePathPref = '/' + baseSegments.join('/');
        if (basePathPref !== '/' && p.startsWith(basePathPref)) p = p.slice(basePathPref.length);
      }
      return p.replace(/^\/+/, '');
    } catch {
      return href.replace(/^\/+/, '');
    }
  }

  async probe(signal) {
    const probeFilename = `.probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;
    const probeContent = JSON.stringify({ probe: true, time: Date.now() });

    try {
      let putRes;
      let conditionalCreate = false;
      try {
        putRes = await this.put(probeFilename, probeContent, { ifNoneMatch: '*', signal });
        conditionalCreate = true;
      } catch (err) {
        if (err instanceof PreconditionFailedError) throw err;
        putRes = await this.put(probeFilename, probeContent, { signal });
      }

      const getRes = await this.get(probeFilename, signal);
      const etag = getRes.etag || putRes?.etag;
      let conditionalReplace = false;
      if (etag) {
        try {
          await this.put(probeFilename, JSON.stringify({ probe: true, step: 2 }), { ifMatch: etag, signal });
          conditionalReplace = true;
        } catch {}
      }

      await this.remove(probeFilename, {}, signal).catch(() => {});
      return { ok: true, read: true, write: true, conditionalCreate, conditionalReplace, list: true, provider: 'webdav' };
    } catch (err) {
      await this.remove(probeFilename, {}, signal).catch(() => {});
      return {
        ok: false, read: false, write: false, conditionalCreate: false, conditionalReplace: false, list: false,
        error: err.message, statusCode: err.statusCode || 0, provider: 'webdav'
      };
    }
  }
}
