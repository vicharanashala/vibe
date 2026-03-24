import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { AuthStore } from "@/types/auth.types"

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAuthReady: false,

      setUser: (user) => {
        const email = user?.email || ""
        const savedAvatar = email
          ? localStorage.getItem(`avatar_${email}`)
          : ""

        set({
          user: {
            ...user,
            avatar: user?.avatar || savedAvatar || "",
          },
          isAuthenticated: true,
        })
      },

      setToken: (token) => {
        set({ token, isAuthenticated: !!token })
      },

      clearUser: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      updateAvatar: (avatar: string) => {
        const currentUser = get().user
        if (!currentUser) return

        const email = currentUser?.email || ""
        if (email) {
          localStorage.setItem(`avatar_${email}`, avatar)
        }

        set({
          user: {
            ...currentUser,
            avatar,
          },
        })
      },

      hasRole: (role) => {
        const user = get().user
        if (!user || !user.role) return false

        if (Array.isArray(role)) {
          return role.includes(user.role)
        }

        return user.role === role
      },

      setAuthReady: (ready) => {
        set({ isAuthReady: ready })
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setAuthReady(true)
        }
      },
    }
  )
)