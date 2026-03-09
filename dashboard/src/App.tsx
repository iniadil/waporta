import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { Shell } from './components/layout/Shell'

export default function App() {
  const { authenticated, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.12em',
      }}>
        LOADING...
      </div>
    )
  }

  if (!authenticated) {
    return <LoginPage onLogin={login} />
  }

  return <Shell onLogout={logout} />
}
