import React, { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleOAuthCallback } = useAuth()
  const hasProcessed = useRef(false) // Предотвращаем двойной вызов

  useEffect(() => {
    // Предотвращаем двойное выполнение в StrictMode
    if (hasProcessed.current) return
    hasProcessed.current = true

    const handleCallback = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')
      const error = searchParams.get('error')

      if (error) {
        // Handle OAuth errors
        navigate(`/login?error=${error}`)
        return
      }

      if (token && type === 'google_success') {
        // Handle successful OAuth
        handleOAuthCallback(token)
        navigate('/chat')
      } else {
        // Invalid callback, redirect to login
        navigate('/login?error=oauth_failed')
      }
    }

    handleCallback()
  }, []) // Убираем зависимости чтобы предотвратить повторные вызовы

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  )
}

export default AuthCallbackPage