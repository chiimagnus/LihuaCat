#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash tests/stability-run.sh <photos-dir>"
  exit 1
fi

PHOTOS_DIR="$1"
if [[ ! -d "$PHOTOS_DIR" ]]; then
  echo "Input directory not found: $PHOTOS_DIR"
  exit 1
fi

RUNS="${LIHUACAT_STABILITY_RUNS:-10}"
SUCCESS=0
FAIL=0
FAILURE_LOG=""
BROWSER_EXECUTABLE="${LIHUACAT_BROWSER_EXECUTABLE:-}"

for ((i=1; i<=RUNS; i++)); do
  CMD=(pnpm run dev -- --input "$PHOTOS_DIR" --style healing --mode template --mock-agent)
  if [[ -n "$BROWSER_EXECUTABLE" ]]; then
    CMD+=(--browser-executable "$BROWSER_EXECUTABLE")
  fi

  if OUTPUT=$("${CMD[@]}" 2>&1); then
    SUCCESS=$((SUCCESS+1))
    echo "[run $i/$RUNS] PASS"
  else
    FAIL=$((FAIL+1))
    LAST_LINE=$(echo "$OUTPUT" | tail -n 1)
    FAILURE_LOG="${FAILURE_LOG}[run $i] ${LAST_LINE}"$'\n'
    echo "[run $i/$RUNS] FAIL"
  fi
done

SUCCESS_RATE=$(awk "BEGIN { if ($RUNS == 0) print 0; else printf \"%.2f\", ($SUCCESS / $RUNS) * 100 }")
echo "STABILITY_RESULT success=${SUCCESS} fail=${FAIL} success_rate=${SUCCESS_RATE}% runs=${RUNS}"
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILURE_SUMMARY_BEGIN"
  echo -n "$FAILURE_LOG"
  echo "FAILURE_SUMMARY_END"
  exit 1
fi
