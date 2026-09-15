#!/usr/bin/env python3
"""Generate website delivery copies without modifying approved source assets."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
IMAGES = [
    ('dashboard/src/assets/voice-avatars/editorial.png', 'dashboard/src/assets/voice-avatars/editorial.webp'),
    ('dashboard/src/components/marketing/recorded-hero/mac-desktop.png', 'dashboard/src/components/marketing/recorded-hero/mac-desktop.webp'),
]
VIDEOS = [
    (f'dashboard/src/components/marketing/recorded-{scene}/{scene}-recording.mp4', f'website/src/assets/optimized/{scene}-recording.mp4')
    for scene in ('hero', 'crew')
]
ARCHIVES = [f'tools/demo-recorder/takes/{take}/original.webm' for take in ('hero-v1', 'crew-v5')]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,nb_frames', '-of', 'json', str(path)]))

def audio_hash(path):
    # Compare encoded audio packets: stream copy must preserve the approved mix.
    return subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).decode().strip()

def main():
    sources = [source for source, _ in IMAGES + VIDEOS] + ARCHIVES
    before = {name: digest(ROOT / name) for name in sources}
    outputs = []
    for source, destination in IMAGES + VIDEOS:
        original, output = ROOT / source, ROOT / destination
        output.parent.mkdir(parents=True, exist_ok=True)
        # Write a temporary derivative, then replace only the delivery copy.
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory) / output.name
            if (source, destination) in IMAGES:
                subprocess.run(['cwebp', '-quiet', '-q', '90', '-m', '6', str(original), '-o', str(temporary)], check=True)
            else:
                subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(original), '-map', '0:v:0', '-map', '0:a:0', '-vf', 'scale=854:480:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', str(temporary)], check=True)
                original_info, result_info = probe(original), probe(temporary)
                assert abs(float(original_info['format']['duration']) - float(result_info['format']['duration'])) < 0.001, 'Duration changed'
                original_frames = next(s['nb_frames'] for s in original_info['streams'] if s['codec_type'] == 'video')
                result_frames = next(s['nb_frames'] for s in result_info['streams'] if s['codec_type'] == 'video')
                assert original_frames == result_frames, 'Video frame count changed'
                assert audio_hash(original) == audio_hash(temporary), 'Audio packets changed'
            assert temporary.stat().st_size < original.stat().st_size, 'Derivative must be smaller'
            output.write_bytes(temporary.read_bytes())
        outputs.append({'source': source, 'output': destination, 'source_bytes': original.stat().st_size, 'output_bytes': output.stat().st_size, 'output_sha256': digest(output)})
        print(f'{output.name}: {original.stat().st_size:,} → {output.stat().st_size:,} bytes')
    assert before == {name: digest(ROOT / name) for name in sources}, 'Source asset modified'
    manifest = {'source_sha256': before, 'outputs': outputs, 'settings': {'webp_quality': 90, 'video_size': '854x480', 'video_crf': 24, 'audio': 'packet-identical stream copy'}, 'tools': {tool: subprocess.check_output([tool, '-version' if tool == 'ffmpeg' else '-version']).decode().splitlines()[0] for tool in ('ffmpeg', 'cwebp')}}
    (ROOT / 'tools/website-media/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

if __name__ == '__main__':
    main()
