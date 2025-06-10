import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { chatAPI } from '../services/api'
import ReactMarkdown from 'react-markdown'
import {
  Plus,
  Send,
  MessageSquare,
  User,
  LogOut,
  Edit2,
  Trash2,
  MoreVertical,
  X,
  Check,
  Menu,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import toast from 'react-hot-toast'

const ChatPage = () => {
  const { user, logout } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Загружаем состояние сайдбара из localStorage
    const saved = localStorage.getItem('sidebarOpen')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Сохраняем состояние сайдбара в localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id)
    }
  }, [activeConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations()
      setConversations(response.data)
      
      // Auto-select first conversation if exists
      if (response.data.length > 0 && !activeConversation) {
        setActiveConversation(response.data[0])
      }
    } catch (error) {
      toast.error('Failed to load conversations')
    }
  }

  const loadMessages = async (conversationId) => {
    setLoading(true)
    try {
      const response = await chatAPI.getHistory(conversationId)
      setMessages(response.data.messages || [])
    } catch (error) {
      toast.error('Failed to load messages')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  // ОБНОВЛЕНО: Мгновенное создание чата с автофокусом
  const createNewConversation = async () => {
    try {
      const response = await chatAPI.createConversation()
      const newConv = response.data
      setConversations(prev => [newConv, ...prev])
      setActiveConversation(newConv)
      setMessages([])
      
      // Автоматически фокусируемся на поле ввода для лучшего UX
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      
    } catch (error) {
      toast.error('Failed to create new conversation')
    }
  }

  // ОБНОВЛЕНО: Улучшенная логика отправки сообщений
  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSending(true)

    // Добавляем сообщение пользователя сразу в UI
    const userMessage = {
      id: Date.now(),
      query: messageText,
      answer: '',
      created_at: new Date().toISOString(),
      isUser: true
    }
    setMessages(prev => [...prev, userMessage])

    // Добавляем индикатор печатания
    const typingMessage = {
      id: Date.now() + 1,
      query: '',
      answer: '...',
      created_at: new Date().toISOString(),
      isTyping: true
    }
    setMessages(prev => [...prev, typingMessage])

    try {
      const response = await chatAPI.sendMessage({
        message: messageText,
        conversation_id: activeConversation?.id
      })

      // Удаляем временные сообщения
      setMessages(prev => prev.filter(msg => !msg.isTyping && msg.id !== userMessage.id))

      // Добавляем настоящие сообщения
      const actualUserMessage = {
        id: response.data.message_id + '_user',
        query: messageText,
        answer: '',
        created_at: response.data.created_at,
        isUser: true
      }

      const botMessage = {
        id: response.data.message_id,
        query: '',
        answer: response.data.answer,
        created_at: response.data.created_at,
        isUser: false
      }

      setMessages(prev => [...prev, actualUserMessage, botMessage])

      // Обновляем название беседы если нужно (автоматическое переименование)
      if (response.data.conversation_name && response.data.conversation_name !== activeConversation?.name) {
        const updatedConv = { ...activeConversation, name: response.data.conversation_name }
        setActiveConversation(updatedConv)
        setConversations(prev => 
          prev.map(conv => 
            conv.id === response.data.conversation_id 
              ? updatedConv
              : conv
          )
        )
      }

      // Если беседа была создана во время отправки сообщения (если не было активной беседы)
      if (!activeConversation && response.data.conversation_id) {
        const newConv = {
          id: response.data.conversation_id,
          name: response.data.conversation_name || 'New Chat',
          created_at: response.data.created_at,
          updated_at: response.data.created_at
        }
        setActiveConversation(newConv)
        setConversations(prev => [newConv, ...prev])
      }

    } catch (error) {
      // Удаляем индикатор печатания
      setMessages(prev => prev.filter(msg => !msg.isTyping))
      
      // Добавляем сообщение об ошибке
      const errorMessage = {
        id: Date.now() + 2,
        query: '',
        answer: 'Sorry, an error occurred while processing your request. Please try again.',
        created_at: new Date().toISOString(),
        isUser: false,
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
      
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  const selectConversation = (conversation) => {
    setActiveConversation(conversation)
    // На мобильных закрываем сайдбар после выбора чата
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const startRename = (conversation) => {
    setActiveConversation(conversation)
    setRenameValue(conversation.name)
    setShowRenameModal(true)
  }

  const handleRename = async () => {
    if (!renameValue.trim() || !activeConversation) return

    try {
      await chatAPI.renameConversation(activeConversation.id, renameValue.trim())
      
      setConversations(prev =>
        prev.map(conv =>
          conv.id === activeConversation.id
            ? { ...conv, name: renameValue.trim() }
            : conv
        )
      )
      
      setActiveConversation(prev => ({ ...prev, name: renameValue.trim() }))
      setShowRenameModal(false)
      toast.success('Conversation renamed')
    } catch (error) {
      toast.error('Failed to rename conversation')
    }
  }

  const startDelete = (conversation) => {
    setConversationToDelete(conversation)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!conversationToDelete) return

    try {
      await chatAPI.deleteConversation(conversationToDelete.id)
      
      setConversations(prev => prev.filter(conv => conv.id !== conversationToDelete.id))
      
      if (activeConversation?.id === conversationToDelete.id) {
        const remaining = conversations.filter(conv => conv.id !== conversationToDelete.id)
        setActiveConversation(remaining[0] || null)
        setMessages([])
      }
      
      setShowDeleteModal(false)
      setConversationToDelete(null)
      toast.success('Conversation deleted')
    } catch (error) {
      toast.error('Failed to delete conversation')
    }
  }

  const ConversationItem = ({ conversation }) => {
    const [showMenu, setShowMenu] = useState(false)
    
    return (
      <div className="relative">
        <div
          className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors group ${
            activeConversation?.id === conversation.id
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-700 text-gray-300'
          }`}
          onClick={() => selectConversation(conversation)}
        >
          <MessageSquare className="w-4 h-4 mr-3 flex-shrink-0" />
          <span className="flex-1 truncate text-sm">{conversation.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-10 min-w-[120px]">
            <button
              onClick={() => {
                startRename(conversation)
                setShowMenu(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Rename
            </button>
            <button
              onClick={() => {
                startDelete(conversation)
                setShowMenu(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'w-80' : 'w-0'} 
        bg-gray-800 text-white flex flex-col transition-all duration-300 overflow-hidden
        ${!sidebarOpen ? 'border-r-0' : 'border-r border-gray-700'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold whitespace-nowrap">AI Legal Assistant</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={createNewConversation}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors"
                title="Create new chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {conversations.map(conversation => (
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))}
            {conversations.length === 0 && (
              <div className="text-center text-gray-400 mt-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Create your first chat</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <User className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm truncate">{user?.username}</span>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors flex-shrink-0 ml-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              {/* Кнопка для переключения сайдбара */}
              <button
                onClick={toggleSidebar}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-5 h-5 text-gray-600" />
                ) : (
                  <PanelLeftOpen className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <h2 className="text-lg font-semibold text-gray-800 truncate">
                {activeConversation?.name || 'Select or start a new conversation'}
              </h2>
            </div>
            {activeConversation && (
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => startRename(activeConversation)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  title="Rename conversation"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startDelete(activeConversation)}
                  className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100"
                  title="Delete conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to AI Legal Assistant</h3>
                <p className="text-gray-600 mb-6">Ask any question about Kazakhstan legislation and legal matters.</p>
                <div className="space-y-3">
                  <button
                    onClick={createNewConversation}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors block w-full"
                  >
                    Start New Conversation
                  </button>
                  {!sidebarOpen && conversations.length > 0 && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="text-blue-600 hover:text-blue-700 px-6 py-2 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors block w-full"
                    >
                      Show Previous Conversations
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-3xl px-4 py-3 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : message.isError
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    {message.isTyping ? (
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        {message.isUser ? (
                          <p className="m-0">{message.query}</p>
                        ) : (
                          <ReactMarkdown>{message.answer}</ReactMarkdown>
                        )}
                      </div>
                    )}
                    <div className={`text-xs mt-2 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(message.created_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        {activeConversation && (
          <div className="bg-white border-t border-gray-200 p-4">
            <form onSubmit={sendMessage} className="flex items-end space-x-2">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your legal question here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="1"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  disabled={sending}
                />
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Rename Conversation</h3>
              <button
                onClick={() => setShowRenameModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter new name"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Delete Conversation</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatPage