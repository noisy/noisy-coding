"""Prepare a recorder take for the website, preserving the original timeline."""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from repair_audio import repair_microphone


def find_timeline(folder):
    candidates = [path for path in folder.glob('*.json')
                  if isinstance(json.loads(path.read_text()).get('events'), list)]
    if len(candidates) != 1:
        raise ValueError('The take folder must contain exactly one recorder timeline JSON.')
    return candidates[0]


def render_take(video_path, take, output, recording_name, microphone=None):
    root = Path(__file__).resolve().parents[2]
    clips = root / 'dashboard/src/components/marketing/crew-voice'
    local_clips = Path(__file__).resolve().parent / 'clips'
    replies = [event for event in take['events'] if event['type'] == 'agent-start']
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(video_path)]
    if microphone:
        command += ['-i', str(microphone)]
    first_reply_input = 2 if microphone else 1
    for event in replies:
        filename = f"{event['clip']}.mp3"
        clip_path = local_clips / filename if filename.startswith('hero-lux-') else clips / filename
        command += ['-i', str(clip_path)]
    filters = ['[0:v]null[v]']
    for index, event in enumerate(replies, first_reply_input):
        filters.append(f"[{index}:a]adelay={event['atMs']:.3f}:all=1[a{index}]")
    inputs = '[1:a]' if microphone else '[0:a]'
    inputs += ''.join(f'[a{i}]' for i in range(first_reply_input, first_reply_input + len(replies)))
    filters.append(f'{inputs}amix=inputs={len(replies)+1}:duration=first:normalize=0[a]')
    command += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
                '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
                str(output / f'{recording_name}.mp4')]
    subprocess.run(command, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('take', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--corrections', type=Path, help='Defaults to take/transcript-corrections.json when present')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--audio-edits', type=Path, help='Defaults to take/audio-edits.json when present')
    group.add_argument('--skip-audio-repair', action='store_true', help='Rebuild an uncleaned comparison from the original')
    args = parser.parse_args()
    timeline_path = find_timeline(args.take)
    video_path, = args.take.glob('*.webm')
    take = json.loads(timeline_path.read_text())
    recording_name = 'hero-recording' if take.get('scenario', {}).get('id', '').startswith('hero') else 'crew-recording'
    args.output.mkdir(parents=True, exist_ok=True)
    edits_path = args.audio_edits or args.take / 'audio-edits.json'
    with tempfile.TemporaryDirectory(prefix='demo-microphone-') as directory:
        microphone = None
        if not args.skip_audio_repair and (args.audio_edits or edits_path.exists()):
            microphone = Path(directory) / 'microphone.wav'
            repair_microphone(video_path, edits_path, microphone)
        render_take(video_path, take, args.output, recording_name, microphone)
    data = {key: take[key] for key in ('version', 'durationMs', 'events', 'transcriptOffsetsMs')}
    if 'scenario' in take:
        data['scenario'] = take['scenario']
    corrections_path = args.corrections or args.take / 'transcript-corrections.json'
    corrections = json.loads(corrections_path.read_text()) if args.corrections or corrections_path.exists() else {}
    for event in data['events']:
        if event['type'] == 'transcript' and event.get('text') in corrections:
            event['originalText'] = event['text']
            event['text'] = corrections[event['text']]
    (args.output / f'{recording_name}.json').write_text(json.dumps(data, indent=2) + '\n')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(args.output / f'{recording_name}.mp4'), '-frames:v', '1',
                    str(args.output / f'{recording_name}-poster.jpg')], check=True)


if __name__ == '__main__':
    main()
