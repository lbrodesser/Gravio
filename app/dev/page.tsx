'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const TEST_USERS = [
  {
    email: 'admin@gravio.dev',
    password: 'Gravio2024!',
    name: 'Admin',
    rolle: 'admin',
    beschreibung: 'Vollzugriff, alle Projekte',
    farbe: 'bg-red-500',
    initial: 'A',
  },
  {
    email: 'bauleiter@gravio.dev',
    password: 'Gravio2024!',
    name: 'Max Muster',
    rolle: 'Bauleiter',
    beschreibung: 'Projekte verwalten, Aufmaße prüfen',
    farbe: 'bg-blue-500',
    initial: 'B',
  },
  {
    email: 'vorarbeiter@gravio.dev',
    password: 'Gravio2024!',
    name: 'Thomas Weber',
    rolle: 'Vorarbeiter',
    beschreibung: 'Aufmaße erfassen, Skizzen erstellen',
    farbe: 'bg-green-500',
    initial: 'V',
  },
]

export default function DevPage(): React.JSX.Element {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient()
  const router = useRouter()

  if (process.env.NODE_ENV !== 'development') {
    router.replace('/')
    return <></>
  }

  async function loginAs(email: string, password: string): Promise<void> {
    setLoading(email)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(null)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-block bg-yellow-500 text-yellow-950 text-xs font-bold px-3 py-1 rounded-full mb-4">
            DEV MODE
          </span>
          <h1 className="text-2xl font-bold text-white">Gravio Dev Login</h1>
          <p className="text-gray-400 text-sm mt-1">Nur im Development-Mode sichtbar</p>
        </div>

        <div className="space-y-3">
          {TEST_USERS.map((user) => (
            <button
              key={user.email}
              onClick={() => loginAs(user.email, user.password)}
              disabled={loading !== null}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex items-center gap-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className={`${user.farbe} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                {loading === user.email ? (
                  <span className="animate-spin text-sm">⟳</span>
                ) : (
                  user.initial
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{user.name}</span>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{user.rolle}</span>
                </div>
                <p className="text-gray-500 text-sm truncate">{user.beschreibung}</p>
                <p className="text-gray-600 text-xs mt-0.5">{user.email}</p>
              </div>
              <span className="text-gray-600 text-lg">→</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <p className="text-center text-gray-700 text-xs mt-8">
          Passwort aller Test-User: <code className="text-gray-500">Gravio2024!</code>
        </p>
      </div>
    </div>
  )
}
