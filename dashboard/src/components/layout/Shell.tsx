import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { Page } from './Sidebar'
import { OverviewPage } from '../../pages/OverviewPage'
import { SessionsPage } from '../../pages/SessionsPage'
import { MessagingPage } from '../../pages/MessagingPage'
import { CheckerPage } from '../../pages/CheckerPage'
import { ApiDocsPage } from '../../pages/ApiDocsPage'
import { ApiKeysPage } from '../../pages/ApiKeysPage'

interface Props {
  onLogout: () => void
}

export function Shell({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('overview')

  const renderPage = () => {
    switch (page) {
      case 'overview': return <OverviewPage onNavigate={setPage} />
      case 'sessions': return <SessionsPage />
      case 'messaging': return <MessagingPage />
      case 'checker': return <CheckerPage />
      case 'api-docs': return <ApiDocsPage />
      case 'api-keys': return <ApiKeysPage />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header onLogout={onLogout} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Sidebar current={page} onChange={setPage} />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
        }}>
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
