import { supabase } from '../lib/supabase'

export async function sendOtpCode(email: string): Promise<void> {
  console.log('🔐 Tentative envoi OTP pour:', email)

  // Nettoyer la session Supabase avant d'envoyer le code
  await supabase.auth.signOut({ scope: 'local' })

  const redirectUrl = window.location.origin

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectUrl,
    },
  })

  if (error) {
    console.error('❌ OTP send error:', error)
    throw new Error(`Erreur envoi du code: ${error.message}`)
  }

  console.log('✅ OTP envoyé avec succès. Redirect:', redirectUrl)
}

export async function verifyOtpCode(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) {
    console.error('OTP verify error:', error)
    throw new Error(`Code invalide ou expire: ${error.message}`)
  }
  return data
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign out error:', error)
    throw new Error(`Erreur deconnexion: ${error.message}`)
  }
}
