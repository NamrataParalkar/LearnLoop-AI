import asyncio
import logging
from ingestion.schemas import RawUnit
from llm import generate_text_with_image

logger = logging.getLogger(__name__)

async def process_figures(units: list[RawUnit]) -> list[RawUnit]:
    """Process figure units using vision model with concurrency limits."""
    semaphore = asyncio.Semaphore(3)
    
    async def process_unit(unit: RawUnit):
        if unit.unit_type != "figure" or not unit.image_path:
            return unit
            
        async with semaphore:
            try:
                # Add retries in real implementation
                prompt = "Please provide a factual description of this image. Explain what the diagram shows, labels, axes, and key relationships. Do not invent information."
                caption = generate_text_with_image(prompt, unit.image_path)
                
                # If too small/decorative, it might return empty or standard rejection
                if len(caption) > 10 and "decorative" not in caption.lower():
                    unit.text = caption
            except Exception as e:
                logger.error(f"Vision model failed for {unit.image_path}: {e}")
        return unit
        
    tasks = [process_unit(u) for u in units]
    return await asyncio.gather(*tasks)
