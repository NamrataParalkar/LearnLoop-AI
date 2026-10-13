from typing import List, Dict, Any, Tuple
import models

class CitationResolver:
    def __init__(self, retrieved_chunks: List[models.Chunk]):
        # Map both 'C<id>' and numeric '<id>' to the actual chunk object
        self.chunk_map = {}
        for c in retrieved_chunks:
            self.chunk_map[f"C{c.id}"] = c
            self.chunk_map[str(c.id)] = c
        
    def resolve(self, answer_parts: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]], List[int]]:
        """Maps C-labels back to chunks from the database only, drops invalid ones, formats text.
        Returns (full_text, citations_list, valid_topic_ids)
        """
        full_text = ""
        citations = []
        topic_ids = set()
        
        # Deduplication tracker for citation items: (source_id, page, slide_no, start_sec)
        seen_locations = set()
        
        for part in answer_parts:
            text = part.get("text", "")
            raw_ids = part.get("chunk_ids", [])
            
            valid_chunks = []
            for cid in raw_ids:
                cid_str = str(cid).strip()
                if cid_str in self.chunk_map:
                    valid_chunks.append(self.chunk_map[cid_str])
                    
            if not valid_chunks:
                full_text += text + " "
                continue
                
            for c in valid_chunks:
                if c.topic_id:
                    topic_ids.add(c.topic_id)
                    
                loc_key = (c.source_id, c.page, c.slide_no, c.start_sec)
                
                # Check 60s transcript grouping if video
                is_duplicate = False
                if c.start_sec is not None:
                    for prev_loc in seen_locations:
                        if prev_loc[0] == c.source_id and prev_loc[3] is not None:
                            if abs(prev_loc[3] - c.start_sec) < 60:
                                is_duplicate = True
                                break
                else:
                    if loc_key in seen_locations:
                        is_duplicate = True
                        
                if not is_duplicate:
                    seen_locations.add(loc_key)
                    excerpt = c.text[:300] + "..." if len(c.text) > 300 else c.text
                    
                    loc_str = ""
                    if c.slide_no: loc_str = f"Slide {c.slide_no}"
                    elif c.page: loc_str = f"Page {c.page}"
                    elif c.start_sec is not None: loc_str = f"Time {int(c.start_sec)}s"
                    else: loc_str = f"Chunk {c.id}"
                    
                    source_title = "Course Material"
                    if c.source and c.source.file_path:
                        import os
                        source_title = os.path.basename(c.source.file_path)
                    elif c.source and c.source.course:
                        source_title = c.source.course.title
                        
                    citations.append({
                        "chunk_id": c.id,
                        "source_id": c.source_id,
                        "source_title": source_title,
                        "source_type": c.source.source_type if c.source else "unknown",
                        "location": loc_str,
                        "page": c.page,
                        "slide_no": c.slide_no,
                        "start_sec": c.start_sec,
                        "excerpt": excerpt,
                        "media_url": f"/api/media/{c.source_id}" + (f"?page={c.page}" if c.page else f"?slide={c.slide_no}" if c.slide_no else f"?time={c.start_sec}" if c.start_sec else "")
                    })
                
            full_text += text + " "
            
        return full_text.strip(), citations, list(topic_ids)
