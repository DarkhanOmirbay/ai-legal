import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      setUser(null)
      // Clear any invalid tokens
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      })
      
      const { user: userData, access_token } = response.data
      
      // Store token in localStorage as backup
      localStorage.setItem('token', access_token)
      
      setUser(userData)
      toast.success('Login successful!')
      
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed'
      toast.error(message)
      return { 
        success: false, 
        error: message,
        needsVerification: message.includes('verify your email')
      }
    }
  }

  const register = async (email, username, password, confirmPassword) => {
    try {
      const response = await api.post('/auth/register', {
        email,
        username,
        password,
        confirm_password: confirmPassword
      })
      
      toast.success('Registration successful! Please check your email.')
      return { 
        success: true, 
        email: response.data.email,
        requiresVerification: response.data.requires_verification 
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const verifyEmail = async (email, verificationCode) => {
    try {
      await api.post('/auth/verify-email', {
        email,
        verification_code: verificationCode
      })
      
      toast.success('Email verified successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Verification failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const resendVerification = async (email) => {
    try {
      await api.post('/auth/resend-verification', { email })
      toast.success('Verification code sent!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to resend code'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const forgotPassword = async (email) => {
    try {
      await api.post('/auth/forgot-password', { email })
      toast.success('Password reset link sent to your email!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to send reset link'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const resetPassword = async (token, newPassword, confirmPassword) => {
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
      
      toast.success('Password reset successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Password reset failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore logout errors
    } finally {
      setUser(null)
      localStorage.removeItem('token')
      toast.success('Logged out successfully')
    }
  }

  const handleOAuthCallback = (token) => {
    if (token) {
      localStorage.setItem('token', token)
      checkAuth()
      toast.success('Google login successful!')
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    checkAuth,
    handleOAuthCallback
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}