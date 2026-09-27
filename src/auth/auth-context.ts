import { createContext } from 'react'

export interface AuthState {
  token: string | null
  isTrainer: boolean
  connect: (candidate: string) => Promise<boolean>
  disconnect: () => void
}

export const AuthContext = createContext<AuthState | null>(null)