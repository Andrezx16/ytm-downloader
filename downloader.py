import yt_dlp
import os
import logging

logger = logging.getLogger(__name__)

class YoutubeDownloader:
    def __init__(self):
        # Opciones base para la extracción de información (rápida, sin descargar)
        self.base_opts = {
            'extract_flat': True,  # Extrae info de playlist sin descargar ni procesar cada video a fondo
            'quiet': True,
            'no_warnings': True,
        }

    def get_playlist_info(self, url: str) -> list[dict]:
        """
        Extrae la información de una URL (puede ser video o playlist).
        Retorna una lista de diccionarios con la información básica de cada pista.
        """
        results = []
        try:
            with yt_dlp.YoutubeDL(self.base_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                if 'entries' in info:
                    # Es una playlist
                    for entry in info['entries']:
                        if entry:
                            results.append({
                                'id': entry.get('id'),
                                'title': entry.get('title'),
                                'uploader': entry.get('uploader'),
                                'duration': entry.get('duration')
                            })
                else:
                    # Es un solo video
                    results.append({
                        'id': info.get('id'),
                        'title': info.get('title'),
                        'uploader': info.get('uploader'),
                        'duration': info.get('duration')
                    })
        except Exception as e:
            logger.error(f"Error extrayendo info de {url}: {e}")
            
        return results

    def download_track(self, video_id: str, output_dir: str, audio_format: str = 'm4a') -> str | None:
        """
        Descarga una pista específica por su video_id.
        Guarda el archivo en output_dir con el formato {titulo} [{id}].m4a
        """
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Opciones para la descarga real
        download_opts = {
            'format': f'bestaudio[ext={audio_format}]/bestaudio/best',
            'outtmpl': os.path.join(output_dir, '%(title)s [%(id)s].%(ext)s'),
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': audio_format,
                    'preferredquality': '192',
                },
                {
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                }
            ],
            'quiet': False,
            'no_warnings': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(download_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                # El archivo resultante después de procesar con FFmpeg
                # yt_dlp provee la ruta final del archivo si todo sale bien.
                expected_ext = audio_format
                filename = ydl.prepare_filename(info)
                # Reemplazar la extensión original por la procesada
                base, _ = os.path.splitext(filename)
                final_path = f"{base}.{expected_ext}"
                return final_path
        except Exception as e:
            logger.error(f"Error descargando track {video_id}: {e}")
            return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    dl = YoutubeDownloader()
    
    # URL de una playlist pública (usaremos una genérica de YT)
    playlist_url = "https://music.youtube.com/playlist?list=PLH2r0yechGmR43d7PFPl7P-ZRouLTh1Pp&si=ruJvMw1RV2jPCOMx"
    
    # 1. Prueba de extracción de Playlist
    print(f"Obteniendo info de la playlist: {playlist_url}")
    info = dl.get_playlist_info(playlist_url)
    
    print(f"\n¡Se encontraron {len(info)} canciones en la playlist!")
    
    # Mostrar las primeras 3 canciones para no inundar la consola
    for i, track in enumerate(info[:3]):
        print(f"{i+1}. {track['title']} (ID: {track['id']})")
    
    # 2. Prueba de descarga (descargar solo la primera canción de la playlist)
    if info:
        video_id = info[0]['id']
        title = info[0]['title']
        print(f"\nDescargando la primera canción: {title}...")
        
        output_folder = "test_downloads"
        ruta = dl.download_track(video_id=video_id, output_dir=output_folder, audio_format="m4a")
        
        if ruta:
            print(f"¡Descargado exitosamente en: {ruta}!")
        else:
            print("Hubo un error en la descarga.")
