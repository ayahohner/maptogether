#!/bin/sh
# Prints the Worker Preview name for a git branch: wrangler's own sanitizing
# (lowercase, [a-z0-9-]), cut to fit "<name>-maptogether-relay" in a 63-char DNS label.
printf '%s' "$1" | tr -c 'a-zA-Z0-9-' '-' | tr -s '-' | tr 'A-Z' 'a-z' | cut -c1-45 | sed 's/^-*//; s/-*$//'
