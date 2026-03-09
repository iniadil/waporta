import { useState, useEffect, useCallback } from 'react'
import { checkAuthApi, logoutApi } from '../api/auth'

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setLoading(false)
      return
    }
    checkAuthApi(token).then((valid) => {
      setAuthenticated(valid)
      if (!valid) localStorage.removeItem('auth_token')
    }).finally(() => setLoading(false))
  }, [])

  const login = useCallback((token: string) => {
    localStorage.setItem('auth_token', token)
    setAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (token) await logoutApi(token)
    localStorage.removeItem('auth_token')
    setAuthenticated(false)
  }, [])

  const token = localStorage.getItem('auth_token')

  return { authenticated, loading, login, logout, token }
}
