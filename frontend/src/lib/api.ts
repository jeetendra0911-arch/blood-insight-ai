const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Bypass-Tunnel-Reminder': 'true'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...getHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Auth endpoints
  async register(data: any) {
    return apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async login(data: any) {
    // We can login with standard OAuth2 password request body
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);

    const result = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (result && result.access_token) {
      localStorage.setItem('token', result.access_token);
    }
    return result;
  },

  async googleAuth(token: string, linkConfirmed: boolean = false) {
    const result = await apiRequest('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, link_confirmed: linkConfirmed }),
    });

    if (result && result.access_token) {
      localStorage.setItem('token', result.access_token);
    }
    return result;
  },

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },

  isAuthenticated() {
    return typeof window !== 'undefined' && !!localStorage.getItem('token');
  },

  async getMe() {
    return apiRequest('/auth/me');
  },

  // Reports endpoints
  async listReports() {
    return apiRequest('/reports');
  },

  async getReport(id: number) {
    return apiRequest(`/reports/${id}`);
  },

  async getReportBiomarkers(id: number) {
    return apiRequest(`/reports/${id}/biomarkers`);
  },

  async getReportAnalysis(id: number) {
    return apiRequest(`/reports/${id}/analysis`);
  },

  async deleteReport(id: number) {
    return apiRequest(`/reports/${id}`, {
      method: 'DELETE',
    });
  },

  async retryReport(id: number) {
    return apiRequest(`/reports/${id}/retry`, {
      method: 'POST',
    });
  },

  async uploadReport(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Bypass-Tunnel-Reminder': 'true'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/reports/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Upload failed');
    }

    return response.json();
  },
};
