from ingestion.schemas import RawUnit
import re

def chunk_units(units: list[RawUnit], max_tokens: int = 400) -> list[RawUnit]:
    """
    Groups/splits RawUnits into text chunks of roughly max_tokens.
    Never crosses a page/slide/video boundary.
    """
    chunks = []
    
    # Rough approximation: 1 word ~ 1.3 tokens. 400 tokens ~ 300 words.
    words_limit = 300
    
    for unit in units:
        if unit.unit_type == "figure":
            chunks.append(unit)
            continue
            
        words = unit.text.split()
        if len(words) <= words_limit:
            chunks.append(unit)
        else:
            # Split large text blocks
            current_words = []
            for i, word in enumerate(words):
                current_words.append(word)
                if len(current_words) >= words_limit:
                    # Look for end of sentence to break cleanly
                    if word.endswith('.') or len(current_words) > words_limit + 50:
                        chunks.append(RawUnit(
                            text=" ".join(current_words),
                            unit_type=unit.unit_type,
                            page_no=unit.page_no,
                            slide_no=unit.slide_no,
                            start_sec=unit.start_sec,
                            end_sec=unit.end_sec
                        ))
                        # 15% overlap
                        overlap_idx = int(len(current_words) * 0.85)
                        current_words = current_words[overlap_idx:]
            
            if current_words:
                chunks.append(RawUnit(
                    text=" ".join(current_words),
                    unit_type=unit.unit_type,
                    page_no=unit.page_no,
                    slide_no=unit.slide_no,
                    start_sec=unit.start_sec,
                    end_sec=unit.end_sec
                ))
                
    return chunks
