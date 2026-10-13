import os
import subprocess
import logging
from faster_whisper import WhisperModel
from ingestion.schemas import RawUnit
from app.config import settings

logger = logging.getLogger(__name__)

def parse_video(source_id: int, file_path: str) -> list[RawUnit]:
    units = []
    
    media_dir = os.path.join(settings.media_dir, str(source_id))
    os.makedirs(media_dir, exist_ok=True)
    audio_path = os.path.join(media_dir, "audio.wav")
    
    # 1. Extract audio
    try:
        subprocess.run(
            ["ffmpeg", "-i", file_path, "-q:a", "0", "-map", "a", audio_path, "-y"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to extract audio: {e}")
        return units
        
    # 2. Transcribe
    try:
        model = WhisperModel(settings.whisper_model, device="cpu", compute_type="int8")
        segments, info = model.transcribe(audio_path, beam_size=5)
        
        current_chunk_text = []
        chunk_start = None
        last_end = 0
        
        for segment in segments:
            if chunk_start is None:
                chunk_start = segment.start
                
            current_chunk_text.append(segment.text.strip())
            last_end = segment.end
            
            # Grouping heuristic: ~30-90 seconds or long pause
            duration = segment.end - chunk_start
            
            if duration > 45 or segment.text.strip().endswith('.'):
                text = " ".join(current_chunk_text)
                units.append(RawUnit(
                    text=text,
                    unit_type="transcript",
                    start_sec=chunk_start,
                    end_sec=last_end
                ))
                current_chunk_text = []
                chunk_start = None
                
        if current_chunk_text:
            text = " ".join(current_chunk_text)
            units.append(RawUnit(
                text=text,
                unit_type="transcript",
                start_sec=chunk_start,
                end_sec=last_end
            ))
            
    except Exception as e:
        logger.error(f"Failed to transcribe audio: {e}")
        
    # 3. Extract keyframes
    # One every 30s + heuristic based on transcript keywords
    try:
        keyframe_times = set()
        for i in range(0, int(info.duration), 30):
            keyframe_times.add(i)
            
        for unit in units:
            text_lower = unit.text.lower()
            if "as you can see" in text_lower or "on the slide" in text_lower or "this diagram" in text_lower:
                keyframe_times.add(int(unit.start_sec))
                
        for t in sorted(keyframe_times):
            image_path = os.path.join(media_dir, f"frame_{t}.jpg")
            subprocess.run(
                ["ffmpeg", "-ss", str(t), "-i", file_path, "-vframes", "1", "-q:v", "2", image_path, "-y"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            units.append(RawUnit(
                text="",
                unit_type="figure",
                start_sec=t,
                end_sec=t,
                image_path=image_path
            ))
    except Exception as e:
        logger.error(f"Failed to extract keyframes: {e}")
        
    units.sort(key=lambda x: x.start_sec if x.start_sec is not None else 0)
    return units
