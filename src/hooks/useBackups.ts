import { useRef } from 'react'
import type { Copy } from '../i18n'
import type { UserData } from '../types/transit'
import { validateUserData } from '../utils/transit'
export function useBackups(
  user: UserData,
  updateUser: (next: UserData) => void,
  setNotice: (message: string) => void,
  t: Copy,
) {
  const importInput = useRef<HTMLInputElement>(null)
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `bus-coming-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(t.backupDownloaded)
  }
  async function importBackup(file?: File) {
    if (!file) return
    try {
      if (file.size > 10_000_000) throw new Error('Too large')
      const imported = validateUserData(JSON.parse(await file.text()))
      const merged = new Map(user.bookmarks.map((b) => [b.id, b]))
      imported.bookmarks.forEach((b) => merged.set(b.id, b))
      const next = validateUserData({ ...imported, bookmarks: [...merged.values()] })
      updateUser(next)
      setNotice(t.backupSuccess)
    } catch {
      setNotice(t.backupError)
    }
    if (importInput.current) importInput.current.value = ''
  }
  return { importInput, exportBackup, importBackup }
}
