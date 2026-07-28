export function getAuthHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem('contabil_ia_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.user?.id) {
        return {
          'x-user-id': parsed.user.id,
          'Authorization': `Bearer ${parsed.user.id}`,
        };
      }
    }
  } catch (e) {
    console.warn('Erro ao ler headers de autenticação:', e);
  }
  return {
    'x-user-id': 'usr_admin_1',
    'Authorization': 'Bearer usr_admin_1',
  };
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}
