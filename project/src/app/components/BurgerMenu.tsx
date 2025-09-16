"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface BurgerMenuProps {
  open: boolean
  onClose: () => void
  onOpenPreferences: () => void
  connected: boolean
  onDisconnected: () => void
}

export default function BurgerMenu({ open, onClose, onOpenPreferences, connected, onDisconnected }: BurgerMenuProps) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!open) return null

  const disconnect = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMsg('Not signed in')
        return
      }
      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'google')
      setMsg('Disconnected')
      onDisconnected()
      onClose()
    } catch {
      setMsg('Failed to disconnect')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute top-14 left-4 w-56 rounded-xl border border-slate-700/40 bg-slate-900/90 backdrop-blur p-2 shadow-xl">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-2 pb-1">Menu</div>
        <button className="w-full text-left px-3 py-2 rounded-md hover:bg-white/5" onClick={() => { onClose(); onOpenPreferences(); }}>
          Preferences
        </button>
        {connected && (
          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-white/5 disabled:opacity-60" onClick={disconnect} disabled={busy}>
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
        {msg && <div className="px-3 pt-2 text-[11px] text-slate-400">{msg}</div>}
      </div>
    </div>
  )
}
