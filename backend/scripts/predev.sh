#!/bin/sh
# Kill any process already listening on the backend port.
kill -9 $(lsof -ti:5100) 2>/dev/null || true
