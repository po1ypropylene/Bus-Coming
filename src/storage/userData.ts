import type { UserData } from '../types/transit'
import { validateUserData } from '../utils/transit'

export const USER_KEY = 'bus-coming-user-v1'

export function readUser(): { user: UserData; error: boolean } {
    try {
        const saved = localStorage.getItem(USER_KEY)
        return {
            user: saved
                ? validateUserData(JSON.parse(saved))
                : {
                      version: 1,
                      theme: 'green',
                      language: navigator.language.startsWith('zh') ? 'tc' : 'en',
                      bookmarks: [],
                  },
            error: false,
        }
    } catch {
        return { user: { version: 1, theme: 'green', language: 'en', bookmarks: [] }, error: true }
    }
}
