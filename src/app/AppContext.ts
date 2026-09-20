import { createContext, useContext } from 'react'
import type { useAppController } from '../hooks/useAppController'

export const AppContext = createContext<ReturnType<typeof useAppController> | null>(null)

export function useApp() {
    const context = useContext(AppContext)
    if (!context) throw new Error('AppProvider is required')
    return context
}
