import React from 'react'
import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  MessageSquare, 
  Shield, 
  ArrowRight,
  CheckCircle,
  Users,
  Clock,
  Star
} from 'lucide-react'

const HomePage = () => {
  const features = [
    {
      icon: BookOpen,
      title: "Kazakhstan Legislation",
      description: "Access information about Kazakhstan's legal framework with instant, accurate responses based on current legislation."
    },
    {
      icon: MessageSquare,
      title: "Conversational Interface",
      description: "Ask questions in plain language and receive clear, contextual answers about laws, regulations, and legal procedures."
    },
    {
      icon: Shield,
      title: "Private & Secure",
      description: "Your legal queries and conversations are private and secure. We prioritize the confidentiality of your legal information."
    }
  ]

  const steps = [
    { number: 1, title: "Sign Up", description: "Create an account to get started with AI Legal Assistant." },
    { number: 2, title: "Ask a Question", description: "Type your legal query in natural language." },
    { number: 3, title: "Get Answers", description: "Receive accurate information based on Kazakhstan legislation." },
    { number: 4, title: "Save & Access History", description: "Keep track of your legal inquiries for future reference." }
  ]

  const businessExamples = [
    "What are the requirements for registering a business in Kazakhstan?",
    "What taxes apply to small businesses in Kazakhstan?",
    "What are the labor laws regarding working hours in Kazakhstan?"
  ]

  const civilExamples = [
    "What is the process for filing for divorce in Kazakhstan?",
    "How is property divided during inheritance in Kazakhstan?",
    "What are the tenant rights in Kazakhstan?"
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-2/3 mb-8 lg:mb-0">
              <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                AI Legal Assistant
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-blue-100">
                Your intelligent legal guide based on Kazakhstan legislation
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
            <div className="lg:w-1/3">
              <div className="w-64 h-64 mx-auto bg-blue-500 rounded-full flex items-center justify-center">
               <div className="w-64 h-64 mx-auto rounded-full overflow-hidden shadow-2xl">
                    <img 
                      src="/legal.jpg" 
                      alt="Legal Assistant" 
                      className="w-full h-full object-cover"
                    />
                  </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-gray-800">
            What is AI Legal Assistant?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-gray-800">
            How it Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                  {step.number}
                </div>
                <h4 className="text-lg font-semibold mb-3 text-gray-800">{step.title}</h4>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Questions */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-gray-800">
            Example Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 p-8 rounded-lg">
              <h5 className="text-xl font-semibold mb-6 text-gray-800">Business Law</h5>
              <ul className="space-y-3">
                {businessExamples.map((example, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{example}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 p-8 rounded-lg">
              <h5 className="text-xl font-semibold mb-6 text-gray-800">Civil Law</h5>
              <ul className="space-y-3">
                {civilExamples.map((example, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link 
              to="/login" 
              className="inline-flex items-center bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
            >
              Try It Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h5 className="text-xl font-semibold mb-4">AI Legal Assistant</h5>
              <p className="text-gray-300 mb-4">
                Your intelligent legal guide based on Kazakhstan legislation
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-gray-300 mb-2">© 2025 AI Legal Assistant. All rights reserved.</p>
              <p className="text-gray-400 text-sm">
                This service provides general legal information, not legal advice. 
                Please consult with a qualified attorney for specific legal matters.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage