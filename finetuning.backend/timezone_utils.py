"""
Timezone utilities for consistent IST timestamp generation
"""
from datetime import datetime
import pytz

# Indian Standard Time timezone
IST = pytz.timezone('Asia/Kolkata')

def get_ist_timestamp() -> str:
    """
    Get current timestamp in Indian Standard Time (IST) as ISO format string
    
    Returns:
        str: ISO format timestamp in IST (e.g., "2025-06-13T09:40:33+05:30")
    """
    return datetime.now(IST).isoformat()

def get_ist_datetime() -> datetime:
    """
    Get current datetime object in Indian Standard Time (IST)
    
    Returns:
        datetime: Current datetime in IST timezone
    """
    return datetime.now(IST)

def convert_to_ist_timestamp(dt: datetime) -> str:
    """
    Convert a datetime object to IST timestamp string
    
    Args:
        dt: datetime object (can be naive or timezone-aware)
        
    Returns:
        str: ISO format timestamp in IST
    """
    if dt.tzinfo is None:
        # If naive datetime, assume it's UTC and convert to IST
        utc_dt = pytz.UTC.localize(dt)
        ist_dt = utc_dt.astimezone(IST)
    else:
        # If timezone-aware, convert to IST
        ist_dt = dt.astimezone(IST)
    
    return ist_dt.isoformat()

def format_ist_timestamp(dt: datetime, format_str: str = "%Y-%m-%d %H:%M:%S %Z") -> str:
    """
    Format a datetime object as IST timestamp with custom format
    
    Args:
        dt: datetime object
        format_str: strftime format string
        
    Returns:
        str: Formatted timestamp string in IST
    """
    if dt.tzinfo is None:
        utc_dt = pytz.UTC.localize(dt)
        ist_dt = utc_dt.astimezone(IST)
    else:
        ist_dt = dt.astimezone(IST)
    
    return ist_dt.strftime(format_str)
