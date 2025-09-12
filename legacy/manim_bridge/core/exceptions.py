"""Custom exceptions for Manim Bridge"""


class BridgeException(Exception):
    """Base exception for all bridge-related errors"""

    pass


class ProcessingError(BridgeException):
    """Error during video processing"""

    pass


class ValidationError(BridgeException):
    """Error during validation"""

    pass


class ManifestError(BridgeException):
    """Error with manifest operations"""

    pass


class SecurityError(BridgeException):
    """Security-related error"""

    pass


class MonitoringError(BridgeException):
    """Error during monitoring operations"""

    pass
