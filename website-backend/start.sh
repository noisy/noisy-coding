#!/bin/zsh
# Start the demo token backend with the xAI key pulled straight from the
# macOS keychain into this process env. The value is never printed, never
# logged and never written to a file. A keychain miss aborts the start.
set -e
cd "$(dirname "$0")"
export XAI_DEMO_API_KEY="$(security find-generic-password -s env.XAI_API_KEY -w)"
# Local testing: a mint holds the IP for the whole session length, which
# blocks rapid retries. Production keeps the strict defaults.
export DEMO_PER_IP_CONCURRENT="${DEMO_PER_IP_CONCURRENT:-5}"
export DEMO_PER_IP_DAILY="${DEMO_PER_IP_DAILY:-50}"
exec npm run dev
