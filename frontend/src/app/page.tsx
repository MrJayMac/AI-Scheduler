"use client"

import { useState } from "react";
import { supabase } from "../../client/supabase-client";

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleClick = () => {
    supabase.auth.signInWithPassword({ email, password })
  }


  return (
    <div>
      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleClick}>Login</button>
    </div>
  );
}
