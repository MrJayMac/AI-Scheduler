'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email ?? null)
      } else {
        router.push('/login')
      }
    }

    getUser()
  }, [supabase, router])

  return (
    <div>
      <h1>Welcome {userEmail}</h1>
    </div>
  )
}
