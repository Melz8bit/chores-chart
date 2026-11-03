import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The URL hash as the page was opened, read before createClient: supabase-js
// strips auth params from the hash while it initializes. ResetPasswordPage
// uses it to tell a real emailed recovery link (type=recovery) or a failed
// one (error_description) apart from someone just typing the URL.
export const initialAuthHash = new URLSearchParams(window.location.hash.slice(1))

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
