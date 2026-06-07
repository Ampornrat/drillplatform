'use client'

import { createContext, useContext } from 'react'
import type { AppCtx } from '@/types'

const AppContext = createContext<AppCtx | null>(null)

export function AppContextProvider({
  ctx,
  children,
}: {
  ctx: AppCtx
  children: React.ReactNode
}) {
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useAppContext(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppContextProvider')
  return ctx
}

/** Safe version — returns null outside the provider instead of throwing. */
export function useAppContextSafe(): AppCtx | null {
  return useContext(AppContext)
}
