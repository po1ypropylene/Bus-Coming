import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { readUser, USER_KEY } from '../storage/userData'
import type { UserData } from '../types/transit'

export function useUserData() {
    const [initial] = useState(readUser)
    const [user, setUser] = useState(initial.user)
    const current = useRef(initial.user)
    const [saveError, setSaveError] = useState(initial.error)

    const updateUser: Dispatch<SetStateAction<UserData>> = (update) => {
        const next = typeof update === 'function' ? update(current.current) : update
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(next))
            setSaveError(false)
        } catch {
            setSaveError(true)
        }
        current.current = next
        setUser(next)
    }

    return { user, saveError, updateUser }
}
