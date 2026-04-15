#!/bin/bash
# =============================================================
#  run_pipeline.sh — Full data processing pipeline
#
#  Run from the project root (Migration-Thesis/):
#    bash scripts/run_pipeline.sh
#
#  Steps:
#    1. process_data.py — generates migration + chart JSONs
#    2. add_confidence.py — patches JSONs with confidence tags
#    3. copies final JSONs to src/data/
# =============================================================

set -e  # exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "===== STEP 1: Processing raw data ====="
echo ""
cd "$SCRIPT_DIR"
python3 process_data.py

echo ""
echo "===== STEP 2: Adding confidence tags ====="
echo ""
python3 add_confidence.py

echo ""
echo "===== STEP 3: Copying to src/data/ ====="
echo ""
cp migrationData_5yr.json "$PROJECT_DIR/src/data/"
cp migrationData_10yr.json "$PROJECT_DIR/src/data/"
cp chartData.json "$PROJECT_DIR/src/data/"

echo ""
echo "===== Pipeline complete! ====="
echo "Files copied to src/data/"
echo "Run 'npm run dev' to see the changes."
echo ""