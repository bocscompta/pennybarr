import { useState, useRef, useCallback } from 'react'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'
import { sendOtpCode, verifyOtpCode } from '../services/authService'

type Step = 'email' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendOtpCode(email)
      setStep('otp')
      startCooldown()
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      await verifyOtpCode(email, code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide')
      setOtp(Array(6).fill(''))
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setLoading(true)
    try {
      await sendOtpCode(email)
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur renvoi')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    if (digit && index === 5) {
      const code = newOtp.join('')
      if (code.length === 6) {
        setTimeout(() => handleVerifyOtp(), 50)
      }
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newOtp = Array(6).fill('')
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]
    }
    setOtp(newOtp)
    if (pasted.length === 6) {
      setTimeout(() => handleVerifyOtp(), 50)
    } else {
      otpRefs.current[pasted.length]?.focus()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F9FAFB' }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-8"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
          border: '1px solid #E4E5E7',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/pennybarr-logo-dark.svg" alt="Pennybarr" className="h-8 mx-auto mb-4" />
          <p className="mt-1 text-sm" style={{ color: '#6C767F' }}>
            Comptabilite simplifiee
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: '#141A1F' }}
              htmlFor="email"
            >
              Adresse email
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#9CA3AF' }}
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  border: '1px solid #E4E5E7',
                  color: '#141A1F',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = '#006666')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = '#E4E5E7')
                }
              />
            </div>

            {error && (
              <p className="mt-2 text-sm" style={{ color: '#BE123C' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-6 py-3 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Recevoir un code'
              )}
            </button>
          </form>
        ) : (
          <div>
            <button
              onClick={() => {
                setStep('email')
                setOtp(Array(6).fill(''))
                setError(null)
              }}
              className="flex items-center gap-1 text-sm mb-6 transition-opacity hover:opacity-70"
              style={{ color: '#6C767F' }}
            >
              <ArrowLeft size={16} />
              Modifier l'email
            </button>

            <p className="text-sm mb-1" style={{ color: '#141A1F' }}>
              Code de verification
            </p>
            <p className="text-sm mb-6" style={{ color: '#6C767F' }}>
              Entrez le code a 6 chiffres envoye a{' '}
              <span className="font-medium" style={{ color: '#141A1F' }}>
                {email}
              </span>
            </p>

            <div className="flex gap-2 justify-center mb-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className="w-12 h-14 text-center text-xl font-semibold rounded-lg outline-none transition-all"
                  style={{
                    border: '1px solid #E4E5E7',
                    color: '#141A1F',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = '#006666')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = '#E4E5E7')
                  }
                />
              ))}
            </div>

            {error && (
              <p className="mt-2 mb-4 text-sm text-center" style={{ color: '#BE123C' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Verifier'
              )}
            </button>

            <div className="text-center mt-4">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm transition-opacity disabled:opacity-50"
                style={{ color: '#006666' }}
              >
                {resendCooldown > 0
                  ? `Renvoyer le code (${resendCooldown}s)`
                  : 'Renvoyer le code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
