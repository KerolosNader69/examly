export interface User {
  name: string;
  email: string;
  role: 'teacher' | 'student';
}

const USER_KEY = 'examly_user';

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  window.localStorage.removeItem(USER_KEY);
}
