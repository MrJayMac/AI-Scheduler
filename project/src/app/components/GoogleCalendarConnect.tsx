'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateOAuthUrl } from '@/lib/google/oauth'

export default function GoogleCalendarConnect() {
  const supabase = createClient()
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      // Wait for auth to be ready
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

      if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
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
  }

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
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <p>Checking calendar connection...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <h3>Google Calendar</h3>
      
      {isConnected ? (
        <div>
          <p style={{ color: 'green' }}>✅ Calendar connected successfully!</p>
          <button 
            onClick={handleDisconnect}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Disconnect Calendar
          </button>
        </div>
      ) : (
        <div>
          <p>Connect your Google Calendar to enable AI scheduling around your existing events.</p>
          <button 
            onClick={handleConnect}
            disabled={connecting}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: connecting ? '#ccc' : '#4285f4', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: connecting ? 'not-allowed' : 'pointer'
            }}
          >
            {connecting ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
        </div>
      )}
    </div>
  )
}