const BASE = '/auth'

export async function loginApi(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Login failed')
  return data
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${BASE}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function checkAuthApi(token: string): Promise<boolean> {
  const res = await fetch(`${BASE}/check`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok
}
