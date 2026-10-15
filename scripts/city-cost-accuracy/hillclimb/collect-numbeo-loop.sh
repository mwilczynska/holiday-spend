#!/usr/bin/env bash
# Resumable slow Numbeo collection: reruns the collector after a pause until every candidate is logged.
# usage: collect-numbeo-loop.sh <cities.json> <out-name> [delay-ms]
cd "$(dirname "$0")/../../.."
total=$(node -e "console.log(require('./$1').length)")
while :; do
  node scripts/city-cost-accuracy/hillclimb/collect-numbeo.mjs "$1" "$2" --delay "${3:-15000}"
  logged=$(node -e "const f='research/city-cost-accuracy/hillclimb/panel/$2.log.json';console.log(require('fs').existsSync(f)?JSON.parse(require('fs').readFileSync(f)).length:0)")
  echo "$(date -u +%H:%M) logged $logged / $total"
  [ "$logged" -ge "$total" ] && break
  sleep 600
done
