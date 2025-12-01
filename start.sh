#!/bin/sh
# Force install pg if not present
if ! npm ls pg 2>/dev/null | grep -q "pg@"; then
  echo "Installing pg package..."
  npm install pg@8.11.3 --no-save
fi

# Start the server
node src/server.js
