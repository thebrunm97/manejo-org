"""
services/wppconnect_adapter.py - WPPConnect Implementation

Implements NotificationService using the existing whatsapp_client module.
This is the default adapter for WPPConnect Server.
"""

import sys
import os
from typing import Dict

# Import base classes
from .notification_service import NotificationService, NotificationResult

# Import existing whatsapp_client
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.whatsapp_client import (
    send_text as wpp_send_text,
    check_connection as wpp_check,
    get_unread_messages as wpp_get_unread
)
from metrics import incr


class WppConnectNotificationService(NotificationService):
    """
    WPPConnect Server implementation of NotificationService.
    
    Uses the existing modules/whatsapp_client.py for HTTP calls.
    This is a thin adapter that converts WppResponse to NotificationResult.
    """
    
    def send_text(self, to: str, body: str) -> NotificationResult:
        """
        Send plain text message via WPPConnect.
        
        Args:
            to: Recipient phone (e.g., "5531999999999@c.us" or LID)
            body: Message text
            
        Returns:
            NotificationResult with success status
        """
        if not to:
            return NotificationResult.fail("Recipient phone is required", "INVALID_INPUT")
        
        if not body:
            return NotificationResult.fail("Message body is required", "INVALID_INPUT")
        
        # [FIX] Se for um LID, tenta resolver para @c.us primeiro
        recipient = to
        if "@lid" in to:
            from modules.whatsapp_client import resolve_lid_to_phone
            resolve_result = resolve_lid_to_phone(to)
            if resolve_result.success and resolve_result.data:
                resolved_phone = resolve_result.data.get("phone", "")
                if resolved_phone:
                    print(f"✅ [LID→CUS] Resolvido {to} → {resolved_phone}")
                    recipient = resolved_phone
            else:
                print(f"⚠️ [LID] Não foi possível resolver {to}, tentando enviar diretamente...")
        
        result = wpp_send_text(recipient, body)
        
        if result.success:
            message_id = result.data.get("id") if result.data else None
            incr("whatsapp_send_success")
            return NotificationResult.ok(message_id)
        else:
            incr("whatsapp_send_error")
            return NotificationResult.fail(
                error=result.error_message or "Unknown error",
                error_code=result.error_code
            )
    
    def send_template(
        self,
        to: str,
        template: str,
        params: Dict[str, str]
    ) -> NotificationResult:
        """
        Send templated message via WPPConnect.
        
        Since WPPConnect doesn't support native templates,
        we format the template locally with the provided params.
        
        Args:
            to: Recipient phone
            template: Template string with {placeholders}
            params: Dict of placeholder -> value
            
        Returns:
            NotificationResult with success status
        """
        try:
            formatted = template.format(**params)
        except KeyError as e:
            return NotificationResult.fail(
                f"Missing template parameter: {e}",
                "TEMPLATE_ERROR"
            )
        
        return self.send_text(to, formatted)
    
    def check_connection(self, timeout: int = 2) -> bool:
        """
        Check if WPPConnect session is active.
        
        Returns:
            True if connected to WhatsApp
        """
        result = wpp_check(timeout=timeout)
        if result.success and result.data:
            return result.data.get("connected", False)
        return False

    def get_unread_messages(self, timeout: int = 3) -> list:
        """
        Retrieve unread messages via WPPConnect.
        
        Returns:
            List of message objects (dicts)
        """
        result = wpp_get_unread(timeout=timeout)
        if result.success and isinstance(result.data, list):
            return result.data
        return []
