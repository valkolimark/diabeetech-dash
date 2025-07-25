#!/bin/bash

echo "Checking timestamp issue..."

# Current correct epoch (in milliseconds)
CURRENT_EPOCH=$(($(date +%s) * 1000))
echo "Current epoch (correct): $CURRENT_EPOCH"

# The epoch from the data
BAD_EPOCH=1753478227132
echo "Data epoch (incorrect): $BAD_EPOCH"

# Difference in years
DIFF_MS=$((BAD_EPOCH - CURRENT_EPOCH))
DIFF_YEARS=$((DIFF_MS / 1000 / 60 / 60 / 24 / 365))
echo "Difference: ~$DIFF_YEARS years"

# What the date actually represents
echo -e "\nIncorrect epoch converts to:"
# For macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    date -r $((BAD_EPOCH / 1000))
else
    date -d @$((BAD_EPOCH / 1000))
fi

echo -e "\nThis explains why Nightscout won't display the data - it's dated 30 years in the future!"
echo -e "\nThe issue is with the data source (share2) sending wrong timestamps."