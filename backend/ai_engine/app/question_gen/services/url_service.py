import re
import asyncio
from pytubefix import Playlist

def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:https?://)?(?:www\.)?youtu\.be/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/embed/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/live/([^?&]+)",
    ]
    
    for pattern in patterns:
        match = re.match(pattern, url)
        if match:
            return match.group(1)
    return None

async def get_urls_from_playlist(playlist_url: str):
    try:
        playlist = await asyncio.to_thread(Playlist, playlist_url)
        video_urls = await asyncio.to_thread(lambda: list(playlist.video_urls))
        return {"video_urls": video_urls}
    except Exception as e:
        return {"error": str(e), "video_urls": []}