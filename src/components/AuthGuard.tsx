import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import LoginPage from '../pages/LoginPage'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#006666' }} />
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return <>{children}</>
}
