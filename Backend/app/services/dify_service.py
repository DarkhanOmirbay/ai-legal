import aiohttp
import json
from typing import Dict, Any, Optional, List
from config import settings

class DifyService:
    def __init__(self, api_key: str = settings.DIFY_API_KEY, base_url: str = settings.DIFY_API_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def send_message(self, 
                         query: str, 
                         user_id: str, 
                         conversation_id: Optional[str] = None, 
                         inputs: Dict[str, Any] = None,
                         files: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Send a message to Dify API
        """
        if inputs is None:
            inputs = {}
            
        if files is None:
            files = []
            
        url = f"{self.base_url}/chat-messages"
        
        payload = {
            "query": query,
            "user": user_id,
            "response_mode": "blocking", 
            "inputs": inputs
        }
        
        if conversation_id:
            payload["conversation_id"] = conversation_id
            
        if files:
            payload["files"] = files
            
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to send message: {text}")
                return await response.json()

    async def get_conversation_history(self, conversation_id: str, user_id: str, limit: int = 20) -> Dict[str, Any]:
        """
        Get conversation history
        """
        url = f"{self.base_url}/messages?conversation_id={conversation_id}&user={user_id}&limit={limit}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to get conversation history: {text}")
                return await response.json()

    async def get_conversations(self, user_id: str, limit: int = 20) -> Dict[str, Any]:
        """
        Get conversations for a user
        """
        url = f"{self.base_url}/conversations?user={user_id}&limit={limit}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to get conversations: {text}")
                return await response.json()

    async def create_new_conversation(self, name: str, user_id: str) -> Dict[str, Any]:
        """
        Create a new conversation - НЕ вызываем Dify API сразу для скорости
        Conversation в Dify будет создан при первом сообщении
        """
        return {
            "conversation_id": None,  # Будет создан при первом сообщении
            "name": name
        }
    
    async def rename_conversation(self, conversation_id: str, user_id: str, name: str = None) -> Dict[str, Any]:
        """
        Rename a conversation
        """
        if not conversation_id:
            # Если conversation_id еще нет (чат без сообщений), просто возвращаем успех
            return {"success": True}
            
        url = f"{self.base_url}/conversations/{conversation_id}/name"
        
        payload = {
            "user": user_id
        }
        
        if name:
            payload["name"] = name
        else:
            payload["auto_generate"] = True
            
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to rename conversation: {text}")
                return await response.json()
    
    async def delete_conversation(self, conversation_id: str, user_id: str) -> Dict[str, Any]:
        """
        Delete a conversation
        """
        if not conversation_id:
            # Если conversation_id еще нет, просто возвращаем успех
            return {"success": True}
            
        url = f"{self.base_url}/conversations/{conversation_id}"
        
        payload = {
            "user": user_id
        }
            
        async with aiohttp.ClientSession() as session:
            async with session.delete(url, headers=self.headers, json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to delete conversation: {text}")
                return await response.json()