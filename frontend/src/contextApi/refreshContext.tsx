import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'

interface RefreshContextState {
  needRefresh: boolean
  triggerRefresh: () => void
}

const defaultState: RefreshContextState = {
  needRefresh: false,
  triggerRefresh: () => {},
}

const RefreshContext = createContext<RefreshContextState>(defaultState)

export const useRefresh = () => useContext(RefreshContext)

export const RefreshProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [needRefresh, setNeedRefresh] = useState(false)

  const triggerRefresh = useCallback(() => {
    setNeedRefresh((prev) => !prev)
  }, [])

  return (
    <RefreshContext.Provider value={{ needRefresh, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  )
}
