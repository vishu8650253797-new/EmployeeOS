#!/bin/sh
# Kill any process already listening on the backend port and any stale nodemon instance.
kill -9 $(lsof -ti:5100) 2>/dev/null || true
pkill -9 -f '\\.bin/nodemon' 2>/dev/null || true
