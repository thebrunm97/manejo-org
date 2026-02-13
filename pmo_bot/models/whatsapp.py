"""
models/whatsapp.py - WhatsApp Webhook Message Models

Defines Pydantic schemas for incoming WhatsApp messages via WPPConnect/Cloud API.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union, Dict, Any


class WhatsAppInboundMessage(BaseModel):
    """
    Incoming message from WhatsApp webhook.
    
    This model validates the JSON payload received from WPPConnect Server
    or WhatsApp Cloud API at the /webhook endpoint.
    
    Example payload:
        {
            "event": "onmessage",
            "from": "5531999999999@c.us",
            "fromMe": false,
            "id": "3EB0XXXXXXXXXXXX",
            "type": "chat",
            "body": "Colhi 20kg de tomate hoje",
            "chatId": "5531999999999@c.us",
            "timestamp": 1736679692
        }
    """
    
    # Required fields
    event: str = Field(description="Event type, e.g. 'onmessage'")
    from_: str = Field(alias="from", description="Sender ID (phone@c.us or phone@lid)")
    from_me: bool = Field(alias="fromMe", description="True if sent by bot itself")
    id: str = Field(description="Unique message ID")
    type: str = Field(description="Message type: 'chat', 'ptt', 'audio'")
    
    # Optional fields
    body: str = Field(default="", description="Text content (empty for audio)")
    
    # FIX: chatId can be a dict for LID users
    chat_id: Optional[Union[str, Dict[str, Any], Any]] = Field(default=None, alias="chatId", description="Chat ID")
    
    timestamp: Optional[int] = Field(default=None, description="Unix timestamp")
    mimetype: Optional[str] = Field(default=None, description="MIME type for media messages")
    
    # [FIX] Capture sender profile to get C.US from LID messages
    sender: Optional[Dict[str, Any]] = Field(default=None, description="Sender profile info")
    
    # Allow extra fields for forward compatibility
    model_config = {
        "populate_by_name": True,
        "extra": "ignore",
    }

    @field_validator("chat_id", mode="before")
    @classmethod
    def normalize_chat_id(cls, v):
        """
        Normalize chatId.
        For LID users, WPPConnect sends an object:
        {"server": "lid", "user": "...", "_serialized": "ID@lid"}
        We extract _serialized to keep it as a string.
        """
        if isinstance(v, dict):
            # Prioriza _serialized que tem o sufixo correto (@lid ou @c.us)
            serialized = v.get("_serialized")
            if serialized:
                return serialized
            # Fallback: construir manualmente
            user = v.get("user", "")
            server = v.get("server", "c.us")
            return f"{user}@{server}"
        return v
    
    @property
    def is_audio(self) -> bool:
        """
        Robust audio detection.
        
        Checks:
        - type == 'ptt' (voice note)
        - type == 'audio'
        - 'audio' in mimetype
        - type == 'chat' but mimetype contains 'audio'
        """
        mime = self.mimetype or ''
        msg_type = self.type or ''
        
        return (
            msg_type == 'ptt' or
            msg_type == 'audio' or
            'audio' in mime.lower() or
            (msg_type == 'chat' and 'audio' in mime.lower())
        )
    
    @property
    def is_text(self) -> bool:
        """Check if message is text."""
        return self.type == "chat"
    
    @property
    def should_process(self) -> bool:
        """Check if message should be processed (not from self, is 'onmessage')."""
        return not self.from_me and self.event.lower() == "onmessage"
    
    @property
    def sender_phone(self) -> str:
        """
        Get sender ID for DB lookup.
        Prioritizes C.US (Real Phone) if available, otherwise falls back to basic ID.
        """
        # 1. Try sender profile (Real Phone)
        if self.sender and isinstance(self.sender, dict):
            s_id = self.sender.get('id')
            if isinstance(s_id, dict):
                s_id = s_id.get('_serialized', '')
            if s_id and "@c.us" in str(s_id):
                return s_id

        # 2. Try chatId (if C.US)
        if isinstance(self.chat_id, str) and "@c.us" in self.chat_id:
            return self.chat_id
            
        # 3. Return raw from_ (can be @lid or @c.us)
        # Note: If this returns @lid, DB lookup must handle it or fail gracefully.
        return self.from_
    
    def get_real_phone_cus(self) -> str:
        """
        Extract the real @c.us phone number from sender profile if available.
        
        WPPConnect includes profilePicThumbObj and other nested data that may
        contain the real phone number even for LID users.
        
        Returns:
            Phone ID ending in @c.us if found, otherwise empty string.
        """
        if not self.sender or not isinstance(self.sender, dict):
            return ""
        
        # Check profilePicThumbObj.id (sometimes has real number)
        profile_pic = self.sender.get('profilePicThumbObj', {})
        if isinstance(profile_pic, dict):
            pic_id = profile_pic.get('id', {})
            if isinstance(pic_id, dict):
                serialized = pic_id.get('_serialized', '')
                if '@c.us' in serialized:
                    return serialized
        
        # Check sender.id directly
        sender_id = self.sender.get('id', {})
        if isinstance(sender_id, dict):
            serialized = sender_id.get('_serialized', '')
            if '@c.us' in serialized:
                return serialized
        elif isinstance(sender_id, str) and '@c.us' in sender_id:
            return sender_id
        
        return ""

    @property
    def reply_to_id(self) -> str:
        """
        Returns the best ID to reply to.
        
        PRIORITY ORDER:
        1. Real @c.us from sender profile (most reliable for WPPConnect)
        2. chatId if it's @c.us
        3. chatId even if @lid (at least it's the correct conversation context)
        4. from_ as last resort
        
        Note: WPPConnect Server has issues with @lid IDs, so we prefer @c.us.
        """
        # 1. Try to get real @c.us from sender profile
        real_cus = self.get_real_phone_cus()
        if real_cus:
            return real_cus
        
        # 2. If chatId is @c.us, use it
        if self.chat_id and isinstance(self.chat_id, str):
            if '@c.us' in self.chat_id:
                return self.chat_id
        
        # 3. If from_ is @c.us, use it
        if '@c.us' in self.from_:
            return self.from_
        
        # 4. Fallback: use chatId even if @lid (better than nothing)
        if self.chat_id and isinstance(self.chat_id, str):
            return self.chat_id
            
        # 5. Last resort
        return self.from_
