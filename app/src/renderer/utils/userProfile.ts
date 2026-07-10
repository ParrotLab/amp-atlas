// A locally-stored display name, used only when GitHub has no name set for the user.
const KEY = 'amp.userName'
const CHANGED = 'amp:profile-changed'

export function getStoredName(): string {
  return localStorage.getItem(KEY) || ''
}

export function setStoredName(name: string): void {
  localStorage.setItem(KEY, name.trim())
  window.dispatchEvent(new Event(CHANGED))
}

export const PROFILE_CHANGED_EVENT = CHANGED
