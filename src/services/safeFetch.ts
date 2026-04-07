import { lookup } from 'node:dns/promises';
import net from 'node:net';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice(7);
    return net.isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }

  return false;
}

function isUnsafeIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

export async function assertPublicHttpUrl(input: string, options?: { defaultProtocol?: 'http:' | 'https:' }): Promise<URL> {
  let value = input.trim();
  if (options?.defaultProtocol && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    value = `${options.defaultProtocol}//${value}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are supported.');
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('Private or local addresses are not allowed.');
  }

  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new Error('Private or local addresses are not allowed.');
    }
    return url;
  }

  const records = await withTimeout(
    lookup(hostname, { all: true, verbatim: true }),
    2_500,
    'Timed out while resolving the host.'
  );

  if (records.length === 0 || records.some((record) => isUnsafeIp(record.address))) {
    throw new Error('Private or local addresses are not allowed.');
  }

  return url;
}

export async function safeFetch(
  input: string | URL,
  init: RequestInit & { maxRedirects?: number } = {}
): Promise<Response> {
  const { maxRedirects = 3, ...requestInit } = init;
  let currentUrl = await assertPublicHttpUrl(input instanceof URL ? input.toString() : input);
  let method = (requestInit.method ?? 'GET').toUpperCase();
  let body = requestInit.body;

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await fetch(currentUrl, {
      ...requestInit,
      body,
      method,
      redirect: 'manual',
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    if (redirects === maxRedirects) {
      throw new Error('Too many redirects.');
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirect response missing Location header.');
    }

    currentUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString());

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== 'GET' && method !== 'HEAD')) {
      method = 'GET';
      body = undefined;
    }
  }

  throw new Error('Too many redirects.');
}
