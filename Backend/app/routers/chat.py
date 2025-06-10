from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, Cookie
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from pydantic import BaseModel
import datetime

from database import get_db
from models.models import User, Conversation, Message
from services.auth_service import get_current_user
from services.dify_service import DifyService

router = APIRouter(tags=["chat"])
dify_service = DifyService()

class MessageRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None

class RenameConversationRequest(BaseModel):
    name: str

def safe_isoformat(dt):
    """Safely convert datetime to ISO format, handling None values"""
    if dt is None:
        return datetime.datetime.utcnow().isoformat()
    return dt.isoformat()

@router.post("/new")
async def create_new_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Creating new chat for user: {current_user.username}")
        
        
        conversation = Conversation(
            dify_conversation_id=None,  # Будет создан при первом сообщении
            name="New Chat",
            user_id=current_user.id
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return {
            "id": conversation.id,
            "name": conversation.name,
            "dify_conversation_id": conversation.dify_conversation_id,
            "created_at": safe_isoformat(conversation.created_at),
            "updated_at": safe_isoformat(conversation.updated_at)
        }
    except Exception as e:
        print(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/message")
async def send_message(
    message_data: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Sending message for user: {current_user.username}")
        
        # Если conversation_id не указан, создаем новую беседу
        if not message_data.conversation_id:
            conversation = Conversation(
                dify_conversation_id=None,  # Будет создан ниже
                name="New Chat",
                user_id=current_user.id
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
        else:
            conversation = db.query(Conversation).filter(
                Conversation.id == message_data.conversation_id, 
                Conversation.user_id == current_user.id
            ).first()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Если у беседы нет dify_conversation_id, создаем его сейчас
        if not conversation.dify_conversation_id:
            print(f"Creating new Dify conversation for first message")
            # Первое сообщение - создаем conversation в Dify
            result = await dify_service.send_message(
                query=message_data.message,
                user_id=current_user.username,
                conversation_id=None  # Новая беседа в Dify
            )
            # Сохраняем conversation_id от Dify
            conversation.dify_conversation_id = result["conversation_id"]
        else:
            print(f"Sending message to existing Dify conversation: {conversation.dify_conversation_id}")
            # Обычное сообщение в существующую беседу
            result = await dify_service.send_message(
                query=message_data.message,
                user_id=current_user.username,
                conversation_id=conversation.dify_conversation_id
            )
        
        new_message = Message(
            dify_message_id=result["message_id"],
            conversation_id=conversation.id,
            query=message_data.message,
            answer=result["answer"]
        )
        
        db.add(new_message)
        
        # Обновляем время последнего обновления беседы
        if new_message.created_at:
            conversation.updated_at = new_message.created_at
        else:
            conversation.updated_at = datetime.datetime.utcnow()
            
        # Автоматически переименовываем чат на основе первого сообщения
        if conversation.name == "New Chat" and len(message_data.message.strip()) > 0:
            # Берем первые 30 символов сообщения как название
            new_name = message_data.message.strip()[:30]
            if len(message_data.message.strip()) > 30:
                new_name += "..."
            conversation.name = new_name
            print(f"Auto-renamed conversation to: {new_name}")
        
        db.commit()
        
        return {
            "message_id": new_message.id,
            "conversation_id": conversation.id,
            "answer": result["answer"],
            "created_at": safe_isoformat(new_message.created_at),
            "conversation_name": conversation.name
        }
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Loading conversations for user: {current_user.username}")
        conversations = db.query(Conversation).filter(
            Conversation.user_id == current_user.id
        ).order_by(Conversation.updated_at.desc().nulls_last()).all()
        
        result = []
        for conversation in conversations:
            result.append({
                "id": conversation.id,
                "name": conversation.name,
                "created_at": safe_isoformat(conversation.created_at),
                "updated_at": safe_isoformat(conversation.updated_at)
            })
        
        print(f"Found {len(result)} conversations")
        return result
    except Exception as e:
        print(f"Error loading conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{conversation_id}")
async def get_chat_history(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Loading history for conversation {conversation_id}, user: {current_user.username}")
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id, 
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.asc()).all()
        
        result = []
        for message in messages:
            result.append({
                "id": message.id,
                "query": message.query,
                "answer": message.answer,
                "created_at": safe_isoformat(message.created_at)
            })
        
        print(f"Found {len(result)} messages")
        return {
            "conversation": {
                "id": conversation.id,
                "name": conversation.name,
                "created_at": safe_isoformat(conversation.created_at),
                "updated_at": safe_isoformat(conversation.updated_at)
            },
            "messages": result
        }
    except Exception as e:
        print(f"Error loading history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)   
):
    try:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id, 
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Удаляем беседу из Dify если она там есть
        if conversation.dify_conversation_id:
            try:
                await dify_service.delete_conversation(
                    conversation.dify_conversation_id, 
                    current_user.username
                )
            except Exception as e:
                print(f"Warning: Failed to delete from Dify: {str(e)}")
                # Не прерываем процесс, если не удалось удалить из Dify
        
        # Удаляем сообщения сначала
        db.query(Message).filter(Message.conversation_id == conversation.id).delete()
        
        # Удаляем беседу
        db.delete(conversation)
        db.commit()
        
        return {"success": True, "message": "Conversation deleted successfully"}
    except Exception as e:
        print(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: int,
    rename_data: RenameConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id, 
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Переименовываем в Dify если беседа там есть
        if conversation.dify_conversation_id:
            try:
                await dify_service.rename_conversation(
                    conversation.dify_conversation_id, 
                    current_user.username, 
                    rename_data.name
                )
            except Exception as e:
                print(f"Warning: Failed to rename in Dify: {str(e)}")
                # Продолжаем, даже если не удалось переименовать в Dify
        
        conversation.name = rename_data.name
        db.commit()
        
        return {
            "success": True, 
            "id": conversation.id,
            "name": conversation.name,
            "updated_at": safe_isoformat(conversation.updated_at)
        }
    except Exception as e:
        print(f"Error renaming conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))