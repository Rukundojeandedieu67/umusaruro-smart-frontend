import { useEffect, useState, type ReactNode } from 'react'
import { setAccessToken, verifyToken } from '../api/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isTrainer, setIsTrainer] = useState(false)

  useEffect(() => {
    setAccessToken(token)
  }, [token])

  useEffect(() => {
    const handleExpiry = () => {
      setToken(null)
      setIsTrainer(false)
    }
    window.addEventListener('umusaruro:auth-expired', handleExpiry)
    return () => window.removeEventListener('umusaruro:auth-expired', handleExpiry)
  }, [])

  async function connect(candidate: string) {
    const cleanToken = candidate.trim()
    const result = await verifyToken(cleanToken)
    setToken(cleanToken)
    setIsTrainer(result.isTrainer)
    return result.isTrainer
  }

  function disconnect() {
    setAccessToken(null)
    setToken(null)
    setIsTrainer(false)
  }

  return <AuthContext.Provider value={{ token, isTrainer, connect, disconnect }}>{children}</AuthContext.Provider>
}