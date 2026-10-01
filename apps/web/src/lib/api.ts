const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  errors?: any;
  status: number;

  constructor(message: string, code: string = 'ERROR', status: number = 500, errors?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Read token from localStorage if available (for Bearer auth header)
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('rasd_token');
  }

  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkErr: any) {
    throw new ApiError(
      'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو محاولة التحديث.',
      'NETWORK_ERROR',
      0,
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    data = { success: false, message: 'تعذر معالجة استجابة الخادم' };
  }

  if (!res.ok || data.success === false) {
    throw new ApiError(
      data.message || 'حدث خطأ أثناء الاتصال بالخادم',
      data.code || `HTTP_${res.status}`,
      res.status,
      data.errors,
    );
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  baseUrl: API_BASE,
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  download: async (endpoint: string, defaultFilename: string) => {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('rasd_token');
    }
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) {
      let errorMsg = 'فشل تنزيل الملف';
      try {
        const errJson = await res.json();
        if (errJson.message) errorMsg = errJson.message;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  },
};

