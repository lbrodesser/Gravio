import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export default async function RootPage(): Promise<never> {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const headersList = await headers()
  const userAgent = headersList.get('user-agent') ?? ''
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

  if (isMobile) {
    redirect('/mobile/home')
  }

  redirect('/desktop/home')
}
