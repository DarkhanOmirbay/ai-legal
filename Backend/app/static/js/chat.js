const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('new-chat-btn');
const currentConversationName = document.getElementById('current-conversation-name');
const conversationIdInput = document.getElementById('conversation-id');
const sendBtn = document.getElementById('send-btn');
const renameBtn = document.getElementById('rename-btn');
const deleteBtn = document.getElementById('delete-btn');
const renameModal = new bootstrap.Modal(document.getElementById('renameModal'));
const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
const renameInput = document.getElementById('rename-input');
const renameSaveBtn = document.getElementById('rename-save-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

let activeConversationId = null;
let conversations = [];
let apiErrorCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const conversationItems = document.querySelectorAll('.conversation-item');
    
    if (conversationItems.length > 0) {
        const firstConversation = conversationItems[0];
        selectConversation(firstConversation.dataset.id);
    }
    
    initEventListeners();
});

function initEventListeners() {
    messageForm.addEventListener('submit', sendMessage);
    newChatBtn.addEventListener('click', createNewConversation);
    conversationList.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem) {
            selectConversation(conversationItem.dataset.id);
        }
    });
    renameBtn.addEventListener('click', () => {
        renameInput.value = currentConversationName.textContent;
        renameModal.show();
    });
    renameSaveBtn.addEventListener('click', renameConversation);
    deleteBtn.addEventListener('click', () => deleteModal.show());
    deleteConfirmBtn.addEventListener('click', deleteConversation);
}

function createNewConversation() {
    fetch('http://localhost:8000/api/chat/new', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        const newItem = document.createElement('li');
        newItem.className = 'conversation-item';
        newItem.dataset.id = data.conversation_id;
        newItem.innerHTML = `<i class="bi bi-chat-left-text"></i><span>New Chat</span>`;
        conversationList.prepend(newItem);
        selectConversation(data.conversation_id);
        enableChatUI();
    })
    .catch(error => {
        console.error('Error creating new conversation:', error);
        alert('Error creating new conversation. Please try again.');
    });
}

function enableChatUI() {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    renameBtn.disabled = false;
    deleteBtn.disabled = false;
}

function selectConversation(id) {
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
    });
    
    activeConversationId = id;
    conversationIdInput.value = id;
    enableChatUI();
    
    const activeItem = document.querySelector(`.conversation-item[data-id="${id}"]`);
    if (activeItem) {
        currentConversationName.textContent = activeItem.querySelector('span').textContent;
    }
    
    loadConversationHistory(id);
}

function loadConversationHistory(id) {
    messagesContainer.innerHTML = '';
    showLoading();
    
    fetch(`http://localhost:8000/api/chat/history/${id}`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(messages => {
        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h3>Welcome to AI Legal Assistant</h3>
                    <p>Ask any question about Kazakhstan legislation and legal matters.</p>
                    <p>Example questions:</p>
                    <ul>
                        <li>What are the requirements for registering a company in Kazakhstan?</li>
                        <li>Explain the divorce process in Kazakhstan</li>
                        <li>What are the tax obligations for small businesses?</li>
                        <li>What legal documents are needed for property purchase?</li>
                    </ul>
                </div>
            `;
        } else {
            messages.forEach(message => {
                addMessageToUI(message.query, 'user');
                addMessageToUI(message.answer, 'bot');
            });
            scrollToBottom();
        }
    })
    .catch(error => {
        console.error('Error loading conversation history:', error);
        messagesContainer.innerHTML = `
            <div class="alert alert-danger">
                Error loading conversation history. Please try again or start a new conversation.
            </div>
            <div class="welcome-message">
                <h3>Welcome to AI Legal Assistant</h3>
                <p>Ask any question about Kazakhstan legislation and legal matters.</p>
            </div>
        `;
    });
}

function sendMessage(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message || !activeConversationId) return;
    
    addMessageToUI(message, 'user');
    messageInput.value = '';
    showTypingIndicator();
    
    const formData = new FormData();
    formData.append('message', message);
    formData.append('conversation_id', activeConversationId);
    
    fetch('http://localhost:8000/api/chat/message', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        addMessageToUI(data.answer, 'bot');
        scrollToBottom();
        updateConversationNameIfNew(message);
    })
    .catch(error => {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        addErrorMessageToUI();
        scrollToBottom();
    });
}

function updateConversationNameIfNew(message) {
    const activeItem = document.querySelector(`.conversation-item[data-id="${activeConversationId}"]`);
    if (activeItem && activeItem.querySelector('span').textContent === 'New Chat') {
        const newName = message.length < 30 ? message : message.substring(0, 30) + '...';
        activeItem.querySelector('span').textContent = newName;
        currentConversationName.textContent = newName;
    }
}

function addMessageToUI(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;
    let formattedContent = content;
    if (type === 'bot') {
        formattedContent = marked.parse(content);
    }
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    messageDiv.innerHTML = `
        <div class="message-content ${type === 'bot' ? 'markdown-content' : ''}">${formattedContent}</div>
        <div class="message-time">${timeString}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addErrorMessageToUI() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
        <div class="message-content text-danger">
            <p>Sorry, an error occurred while processing your request. Please try again.</p>
        </div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="loading-dots">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) typingIndicator.remove();
}

function showLoading() {
    messagesContainer.innerHTML = `
        <div class="d-flex justify-content-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
}

function renameConversation() {
    const newName = renameInput.value.trim();
    if (!newName || !activeConversationId) return;
    
    const formData = new FormData();
    formData.append('name', newName);
    
    fetch(`http://localhost:8000/api/chat/rename/${activeConversationId}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            currentConversationName.textContent = newName;
            const activeItem = document.querySelector(`.conversation-item[data-id="${activeConversationId}"]`);
            if (activeItem) activeItem.querySelector('span').textContent = newName;
            renameModal.hide();
        }
    })
    .catch(error => {
        console.error('Error renaming conversation:', error);
        renameModal.hide();
    });
}

function deleteConversation() {
    if (!activeConversationId) return;
    
    fetch(`http://localhost:8000/api/chat/delete/${activeConversationId}`, { method: 'POST' })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const activeItem = document.querySelector(`.conversation-item[data-id="${activeConversationId}"]`);
            if (activeItem) activeItem.remove();
            resetChatUI();
            deleteModal.hide();
            
            const remainingConversations = document.querySelectorAll('.conversation-item');
            if (remainingConversations.length > 0) {
                selectConversation(remainingConversations[0].dataset.id);
            } else {
                showWelcomeMessage();
            }
        }
    })
    .catch(error => {
        console.error('Error deleting conversation:', error);
        deleteModal.hide();
    });
}

function resetChatUI() {
    messagesContainer.innerHTML = '';
    currentConversationName.textContent = 'Select or start a new conversation';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    renameBtn.disabled = true;
    deleteBtn.disabled = true;
    activeConversationId = null;
}

function showWelcomeMessage() {
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h3>Welcome to AI Legal Assistant</h3>
            <p>Click "New Chat" to start asking questions about Kazakhstan legislation.</p>
        </div>
    `;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageForm.dispatchEvent(new Event('submit'));
    }
});
