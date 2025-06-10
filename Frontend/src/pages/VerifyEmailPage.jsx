import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'

const VerifyEmailPage = () => {
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(1 * 60) // 15 minutes
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail, resendVerification } = useAuth()
  
  const email = searchParams.get('email')
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm()

  const verificationCode = watch('verificationCode', '')

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/register')
    }
  }, [email, navigate])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (verificationCode && verificationCode.length === 6) {
      handleSubmit(onSubmit)()
    }
  }, [verificationCode])

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const onSubmit = async (data) => {
    if (!data.verificationCode || data.verificationCode.length !== 6) return
    
    setLoading(true)
    try {
      const result = await verifyEmail(email, data.verificationCode)
      
      if (result.success) {
        navigate('/login')
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setResendLoading(true)
    try {
      const result = await resendVerification(email)
      
      if (result.success) {
        setTimeLeft(15 * 60) // Reset timer
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setResendLoading(false)
    }
  }

  if (!email) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Verify Your Email</h1>
            <p className="text-gray-600 mt-2">
              We've sent a 6-digit verification code to
            </p>
            <p className="text-gray-800 font-medium">{email}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                id="verificationCode"
                type="text"
                maxLength={6}
                {...register('verificationCode', {
                  required: 'Verification code is required',
                  pattern: {
                    value: /^\d{6}$/,
                    message: 'Please enter a 6-digit code'
                  }
                })}
                className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest ${
                  errors.verificationCode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="000000"
                autoComplete="one-time-code"
                onChange={(e) => {
                  // Only allow numbers
                  e.target.value = e.target.value.replace(/\D/g, '')
                }}
              />
              {errors.verificationCode && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.verificationCode.message}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !verificationCode || verificationCode.length !== 6}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          <div className="text-center mt-6 space-y-4">
            <div>
              <p className="text-gray-600 text-sm mb-2">Didn't receive the code?</p>
              <button
                onClick={handleResendCode}
                disabled={resendLoading || timeLeft > 0}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                    Sending...
                  </div>
                ) : timeLeft > 0 ? (
                  `Resend code in ${formatTime(timeLeft)}`
                ) : (
                  'Resend Code'
                )}
              </button>
            </div>

            {/* Timer Display */}
            <div className="flex items-center justify-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              {timeLeft > 0 ? (
                <span>Code expires in: {formatTime(timeLeft)}</span>
              ) : (
                <span className="text-red-600">Code expired</span>
              )}
            </div>

            <p>
              <Link 
                to="/register" 
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back to registration
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage