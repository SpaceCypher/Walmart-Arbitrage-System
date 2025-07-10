#!/bin/bash
# This script removes the files listed in REMOVED_FILES.txt
while read -r file; do
  if [ -f "$file" ]; then
    rm "$file"
  fi
done < REMOVED_FILES.txt
