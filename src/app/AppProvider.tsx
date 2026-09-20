import type { ReactNode } from 'react'
import { useAppController } from '../hooks/useAppController'
import { AppContext } from './AppContext'
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppController()
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
