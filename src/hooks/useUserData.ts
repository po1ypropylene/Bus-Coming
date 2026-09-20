import { useState } from 'react'
import { readUser, USER_KEY } from '../storage/userData'
import type { UserData } from '../types/transit'

export function useUserData() {
    const [initial] = useState(readUser)
    const [user, setUser] = useState(initial.user)
    const [saveError, setSaveError] = useState(initial.error)

    function updateUser(next: UserData) {
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(next))
            setSaveError(false)
        } catch {
            setSaveError(true)
        }
        setUser(next)
    }

    return { user, saveError, updateUser }
}
