"""
services/notification_service.py - Abstract Notification Service

Defines the interface for sending notifications via WhatsApp or other channels.
Implementations can be swapped via factory in __init__.py.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class NotificationResult:
    """
    Result of a notification operation.
    
    Attributes:
        success: Whether the operation succeeded
        message_id: ID of the sent message (if available)
        error: Error message (if failed)
        error_code: Error code (TIMEOUT, AUTH_ERROR, etc.)
    """
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    
    @classmethod
    def ok(cls, message_id: Optional[str] = None) -> "NotificationResult":
        """Factory for success result."""
        return cls(success=True, message_id=message_id)
    
    @classmethod
    def fail(cls, error: str, error_code: Optional[str] = None) -> "NotificationResult":
        """Factory for failure result."""
        return cls(success=False, error=error, error_code=error_code)


class NotificationService(ABC):
    """
    Abstract base class for notification services.
    
    Implementations:
    - WppConnectNotificationService: WPPConnect Server (current)
    - CloudApiNotificationService: WhatsApp Cloud API (future)
    - TwilioNotificationService: Twilio WhatsApp API (future)
    
    Usage:
        from services import get_notification_service
        
        service = get_notification_service()
        result = service.send_text("5531999999999@c.us", "Hello!")
    """
    
    @abstractmethod
    def send_text(self, to: str, body: str) -> NotificationResult:
        """
        Send a plain text message.
        
        Args:
            to: Recipient phone (e.g., "5531999999999@c.us")
            body: Message text
            
        Returns:
            NotificationResult with success status
        """
        pass
    
    @abstractmethod
    def send_template(
        self,
        to: str,
        template: str,
        params: Dict[str, str]
    ) -> NotificationResult:
        """
        Send a templated message.
        
        For WPPConnect: Formats template locally with params.
        For Cloud API: Uses registered message templates.
        
        Args:
            to: Recipient phone
            template: Template string with {placeholders}
            params: Dict of placeholder -> value
            
        Returns:
            NotificationResult with success status
        """
        pass
    
    @abstractmethod
    def check_connection(self) -> bool:
        """
        Check if the notification service is connected.
        
        Returns:
            True if service is ready to send messages
        """
        pass

    @abstractmethod
    def get_unread_messages(self) -> list:
        """
        Retrieve unread messages.

        Returns:
            List of message objects (dicts)
        """
        pass
