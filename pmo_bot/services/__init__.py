"""
services package implementation.
Exposes common factories and interfaces.
"""
import os
from functools import lru_cache

# Expose Notification Service
from .notification_service import NotificationService, NotificationResult
from .wppconnect_adapter import WppConnectNotificationService

@lru_cache(maxsize=1)
def get_notification_service() -> NotificationService:
    """
    Factory to get the configured NotificationService implementation.
    Currently defaults to WppConnectNotificationService.
    """
    # Future: logic to choose implementation based on env var
    # implementation = os.getenv('NOTIFICATION_PROVIDER', 'wppconnect')
    
    return WppConnectNotificationService()
