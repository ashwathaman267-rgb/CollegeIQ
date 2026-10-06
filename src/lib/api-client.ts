export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiFieldError {
  field?: string;
  message: string;
  code?: string;
}

/** Error thrown by the API client — always carries a human-friendly message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get fieldErrors(): ApiFieldError[] {
    return Array.isArray(this.details) ? (this.details as ApiFieldError[]) : [];
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, unknown>;
  /** Progress callback for uploads (0-100). */
  onProgress?: (percent: number) => void;
}

function buildUrl(path: string, query?: Record<string, unknown>) {
  const url = new URL(path, 'http://internal.local');
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v !== undefined && v !== null) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return `${url.pathname}${url.search}`;
}

function normaliseError(status: number, payload: unknown): ApiError {
  const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
  return new ApiError(
    status,
    err?.code ?? `HTTP_${status}`,
    err?.message ?? defaultMessages[status] ?? 'Something went wrong. Please try again.',
    err?.details,
  );
}

const defaultMessages: Record<number, string> = {
  400: 'That request could not be processed.',
  401: 'Your session has expired. Please sign in again.',
   403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'That change conflicts with existing data.',
  413: 'That file is too large to upload.',
  415: 'That file type is not supported.',
  422: 'Some of the submitted values are invalid.',
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  503: 'That service is temporarily unavailable.',
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { body, query, onProgress, headers, ...rest } = options;
  const url = buildUrl(path, query);

  const init: RequestInit = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body instanceof FormData
        ? {}
        : body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      ...(headers as Record<string, string>),
    },
    credentials: 'same-origin',
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  };

  let response: Response;
  try {
    if (body instanceof FormData && onProgress && typeof XMLHttpRequest !== 'undefined') {
      response = await uploadWithProgress(url, init, onProgress);
    } else {
      response = await fetch(url, init);
    }
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) throw normaliseError(response.status, payload);

  const envelope = payload as { data?: T; meta?: ApiMeta } | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return { data: envelope.data as T, meta: envelope.meta };
  }
  return { data: payload as T };
}

function uploadWithProgress(url: string, init: RequestInit, onProgress: (p: number) => void) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? 'POST', url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const headers = new Headers();
      xhr.getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
          const idx = line.indexOf(':');
          if (idx > 0) headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
        });
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status === 0 ? 200 : xhr.status,
          statusText: xhr.statusText,
          headers,
        }),
      );
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(init.body as FormData);
  });
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T = { deleted: boolean }>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData, onProgress?: (p: number) => void) =>
    request<T>('POST', path, { body: formData, onProgress }),
};
