#!/bin/bash

# Get the folder where the script is located
DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to that folder
cd "$DIR" || exit

# Print current working directory
echo "Running server from: $(pwd)"

# Kill any process running on port 52782
lsof -ti:52782 | xargs kill -9 2>/dev/null

# Start Python HTTP server
python3 -m http.server 52782