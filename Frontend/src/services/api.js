import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://zanger-ai.org.kz/api',
  timeout: 30000,
  withCredentials: true, // Important for cookies
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token')
      
      // Only redirect if we're not already on a public page
      const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/']
      if (!publicPages.includes(window.location.pathname)) {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// Chat API functions
export const chatAPI = {
  // Get all conversations
  getConversations: () => api.get('/chat/conversations'),
  
  // Create new conversation
  createConversation: () => api.post('/chat/new'),
  
  // Send message
  sendMessage: (data) => api.post('/chat/message', data),
  
  // Get conversation history
  getHistory: (conversationId) => api.get(`/chat/history/${conversationId}`),
  
  // Rename conversation
  renameConversation: (conversationId, name) => 
    api.put(`/chat/conversations/${conversationId}`, { name }),
  
  // Delete conversation
  deleteConversation: (conversationId) => 
    api.delete(`/chat/conversations/${conversationId}`)
}

export default api
