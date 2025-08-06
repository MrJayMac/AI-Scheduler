import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=no_code', request.url))
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI!,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    
    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const userInfo = await userResponse.json()
    
    // Save tokens to Supabase
    const supabase = await createClient()
    
    // Get current user from Supabase auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    // Calculate expiration time
    const expiresAt = Date.now() + (tokens.expires_in * 1000)

    // Save tokens to database
    const { error: dbError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: user.id,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        google_user_id: userInfo.id,
        google_email: userInfo.email,
      })

    if (dbError) {
      throw new Error('Failed to save tokens to database')
    }

    // Redirect back to dashboard with success
    return NextResponse.redirect(new URL('/dashboard?connected=true', request.url))
    
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_failed', request.url))
  }
}