from pydantic import BaseModel
from typing import Optional

class RawUnit(BaseModel):
    text: str
    unit_type: str # "text", "figure", "transcript"
    
    # Location
    page_no: Optional[int] = None
    slide_no: Optional[int] = None
    start_sec: Optional[float] = None
    end_sec: Optional[float] = None
    
    # Media
    image_path: Optional[str] = None
