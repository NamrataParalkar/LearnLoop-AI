import json
import time
import logging
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

def generate_structured(prompt: str, schema: dict, model_name: str = None) -> dict:
    """Generate structured JSON output from Gemini with retry logic."""
    if not model_name:
        model_name = settings.tutor_model
        
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
    )
    
    last_err = None
    for attempt in range(4):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            return json.loads(response.text)
        except Exception as e:
            last_err = e
            logger.warning(f"generate_structured attempt {attempt+1} failed ({model_name}): {e}")
            time.sleep(1.5 * (attempt + 1))
            
    raise last_err

def generate_text(prompt: str, model_name: str = None) -> str:
    """Generate raw text from Gemini with retry logic."""
    if not model_name:
        model_name = settings.tutor_model
        
    last_err = None
    for attempt in range(4):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            last_err = e
            logger.warning(f"generate_text attempt {attempt+1} failed ({model_name}): {e}")
            time.sleep(1.5 * (attempt + 1))
            
    raise last_err

def generate_text_with_image(prompt: str, image_path: str, model_name: str = None) -> str:
    """Generate text from Gemini given an image."""
    if not model_name:
        model_name = settings.tutor_model
        
    try:
        from PIL import Image
        img = Image.open(image_path)
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, img]
                )
                return response.text
            except Exception as e:
                time.sleep(1.5 * (attempt + 1))
        return ""
    except Exception as e:
        logger.error(f"Vision API error: {e}")
        return ""
