'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateOAuthUrl } from '@/lib/google/oauth'

export default function GoogleCalendarConnect() {
  const supabase = createClient()
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const checkConnection = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        setIsConnected(false)
        setLoading(false)
        return
      }
      
      if (!user) {
        console.log('No user found')
        setIsConnected(false)
        setLoading(false)
        return
      }

      console.log('User authenticated:', user.id)

      const { data: tokens, error: dbError } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .single()

      if (dbError && dbError.code !== 'PGRST116') {
        console.error('Database error:', dbError)
        setIsConnected(false)
      } else {
        setIsConnected(!!tokens?.access_token)
        console.log('Connection check result:', !!tokens?.access_token)
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  

  const handleConnect = () => {
    setConnecting(true)
    const oauthUrl = generateOAuthUrl()
    window.location.href = oauthUrl
  }

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'google')

      setIsConnected(false)
    } catch (error) {
      console.error('Error disconnecting calendar:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-0">
        <p className="text-slate-400">Checking calendar connection...</p>
      </div>
    )
  }

  return (
    <div className="p-0">
      <h3 className="m-0 text-base font-semibold mb-2">Google Calendar</h3>
      {isConnected ? (
        <div className="flex items-center gap-3">
          <div className="pill pill-success">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Connected</span>
          </div>
          <button onClick={handleDisconnect} className="btn btn-neutral">Disconnect</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-400">Connect your Google Calendar to view your events.</p>
          <button onClick={handleConnect} disabled={connecting} className="btn btn-primary">
            {connecting ? 'Connecting…' : 'Connect Google Calendar'}
          </button>
        </div>
      )}
    </div>
  )
}