"""Prepare a recorder take for the website, preserving the original timeline."""

import argparse
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("take", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--corrections", type=Path, help="JSON mapping from misrecognized text to approved text")
    args = parser.parse_args()
    timeline_path, = args.take.glob("*.json")
    video_path, = args.take.glob("*.webm")
    take = json.loads(timeline_path.read_text())
    clips = Path(__file__).resolve().parents[2] / "dashboard/src/components/marketing/crew-voice"
    local_clips = Path(__file__).resolve().parent / "clips"
    recording_name = "hero-recording" if take.get("scenario", {}).get("id", "").startswith("hero") else "crew-recording"
    replies = [event for event in take["events"] if event["type"] == "agent-start"]
    args.output.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video_path)]
    for event in replies:
        filename = f"{event['clip']}.mp3"
        clip_path = local_clips / filename if filename.startswith("hero-lux-") else clips / filename
        command += ["-i", str(clip_path)]
    # Preserve the full frame so the Storybook crop can be changed live.
    filters = ["[0:v]null[v]"]
    for index, event in enumerate(replies, 1):
        filters.append(f"[{index}:a]adelay={event['atMs']:.3f}:all=1[a{index}]")
    inputs = "[0:a]" + "".join(f"[a{i}]" for i in range(1, len(replies) + 1))
    filters.append(f"{inputs}amix=inputs={len(replies)+1}:duration=first:normalize=0[a]")
    command += ["-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                str(args.output / f"{recording_name}.mp4")]
    subprocess.run(command, check=True)
    # Keep raw arrivals and user-selected offsets; do not bake text adjustments
    # into the media or include machine-specific recorder metadata.
    data = {key: take[key] for key in ("version", "durationMs", "events", "transcriptOffsetsMs")}
    if "scenario" in take:
        data["scenario"] = take["scenario"]
    corrections = json.loads(args.corrections.read_text()) if args.corrections else {}
    for event in data["events"]:
        if event["type"] == "transcript" and event.get("text") in corrections:
            event["originalText"] = event["text"]
            event["text"] = corrections[event["text"]]
    (args.output / f"{recording_name}.json").write_text(json.dumps(data, indent=2) + "\n")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(args.output / f"{recording_name}.mp4"), "-frames:v", "1",
                    str(args.output / f"{recording_name}-poster.jpg")], check=True)


if __name__ == "__main__":
    main()
