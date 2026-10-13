import fitz  # PyMuPDF
import os
import logging
from ingestion.schemas import RawUnit
from app.config import settings
try:
    import pytesseract
    from PIL import Image
    import io
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

logger = logging.getLogger(__name__)

def parse_pdf(source_id: int, file_path: str) -> list[RawUnit]:
    units = []
    
    media_dir = os.path.join(settings.media_dir, str(source_id))
    os.makedirs(media_dir, exist_ok=True)
    
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.error(f"Failed to open PDF {file_path}: {e}")
        return units

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        
        # Extract images
        image_list = page.get_images(full=True)
        images_found = 0
        
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            width = base_image["width"]
            height = base_image["height"]
            
            # Skip tiny images
            if width < 150 or height < 150:
                continue
                
            image_filename = f"page_{page_num+1}_img_{img_index}.{image_ext}"
            image_filepath = os.path.join(media_dir, image_filename)
            
            with open(image_filepath, "wb") as f:
                f.write(image_bytes)
                
            units.append(RawUnit(
                text="", # Will be filled by vision model
                unit_type="figure",
                page_no=page_num + 1,
                image_path=image_filepath
            ))
            images_found += 1
            
        if not text and images_found == 0:
            logger.warning(f"Page {page_num + 1} is empty.")
            continue
            
        if len(text) < 50 and images_found == 0 and HAS_OCR:
            logger.info(f"Page {page_num + 1} has very little text, attempting OCR.")
            pix = page.get_pixmap()
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(img).strip()
            
        if text:
            units.append(RawUnit(
                text=text,
                unit_type="text",
                page_no=page_num + 1
            ))
            
    return units
