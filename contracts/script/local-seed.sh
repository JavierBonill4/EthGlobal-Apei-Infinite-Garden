#!/usr/bin/env bash
#
# Deploy a season, put plots in it, and start it -- in the right order.
#
# WHY THIS EXISTS
# startSeason() locks the cohort at whoever is queued in that instant. Run it
# before anyone has called joinQueue() and you get a world with zero plots,
# and claimWilderness() cannot let you in afterwards because it only recycles
# plots that already exist. The only cure is redeploying. That ordering trap
# cost a morning once; it should not cost another.
#
# usage:
#   anvil                      # fresh, in another terminal
#   ./script/local-seed.sh     # from contracts/
#
# Set PLAYERS=1..9 to change how many anvil accounts join (default 3).

set -euo pipefail
cd "$(dirname "$0")/.."

RPC=${RPC:-http://127.0.0.1:8545}
PLAYERS=${PLAYERS:-3}
KICKOFF_DELAY=172800   # must match KICKOFF_DELAY in Deploy.s.sol

# Anvil's standard mnemonic accounts 0-8. Known to everyone on earth;
# localhost only.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
  0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
  0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97
)

if (( PLAYERS < 1 || PLAYERS > ${#KEYS[@]} )); then
  echo "PLAYERS must be 1..${#KEYS[@]}" >&2; exit 1
fi

if [[ ! -f .env ]]; then
  echo "no contracts/.env -- run: cp .env.example .env" >&2; exit 1
fi
set -a; source .env; set +a

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "no chain at $RPC -- start anvil first" >&2; exit 1
fi

# A fresh chain is what makes the deployed addresses deterministic, which is
# what lets this script write env files you can trust. Redeploying onto a
# used chain works too, it just moves every address.
DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
NONCE=$(cast nonce "$DEPLOYER" --rpc-url "$RPC")
if [[ "$NONCE" != "0" ]]; then
  echo "warning: deployer nonce is $NONCE, not 0."
  echo "         Addresses will differ from a fresh run. Restart anvil for"
  echo "         reproducible ones. Continuing in 3s (ctrl-c to stop)..."
  sleep 3
fi

echo "==> deploying"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast >/dev/null

BROADCAST="broadcast/Deploy.s.sol/$(cast chain-id --rpc-url "$RPC")/run-latest.json"
read_addr() {
  python3 -c "
import json,sys
d=json.load(open('$BROADCAST'))
for t in d['transactions']:
    if t.get('transactionType')=='CREATE' and t.get('contractName')=='$1':
        print(t['contractAddress']); break
else:
    sys.exit('missing $1 in broadcast')
"
}

GARDEN=$(cast to-check-sum-address "$(read_addr Garden)")
RNG=$(cast to-check-sum-address "$(read_addr MockRandomness)")
STANDING=$(cast to-check-sum-address "$(read_addr StandingRecord)")
COLLECTIBLES=$(cast to-check-sum-address "$(read_addr Collectibles)")

echo "    Garden         $GARDEN"
echo "    MockRandomness $RNG"
echo "    StandingRecord $STANDING"
echo "    Collectibles   $COLLECTIBLES"

# The two env files, written from one source of truth so they cannot drift.
echo "==> writing contracts/.env and web/.env.local"
set_var() { # file key value
  if grep -q "^$2=" "$1"; then
    python3 - "$1" "$2" "$3" <<'PY'
import sys,re
f,k,v=sys.argv[1:4]
s=open(f).read()
open(f,'w').write(re.sub(r'(?m)^%s=.*$' % re.escape(k), '%s=%s' % (k,v), s))
PY
  else
    printf '%s=%s\n' "$2" "$3" >> "$1"
  fi
}
set_var .env GARDEN_ADDRESS "$GARDEN"
set_var .env RNG_ADDRESS "$RNG"

WEB_ENV=../web/.env.local
[[ -f $WEB_ENV ]] || cp ../web/.env.local.example "$WEB_ENV"
set_var "$WEB_ENV" NEXT_PUBLIC_GARDEN_ADDRESS "$GARDEN"
set_var "$WEB_ENV" NEXT_PUBLIC_STANDING_ADDRESS "$STANDING"
set_var "$WEB_ENV" NEXT_PUBLIC_COLLECTIBLES_ADDRESS "$COLLECTIBLES"

echo "==> queueing $PLAYERS plots (before startSeason -- this is the point)"
for ((i=0; i<PLAYERS; i++)); do
  cast send "$GARDEN" "joinQueue()" --value 0.001ether \
    --rpc-url "$RPC" --private-key "${KEYS[$i]}" >/dev/null
  echo "    plot $((i+1)) -> $(cast wallet address --private-key "${KEYS[$i]}")"
done

echo "==> jumping the kickoff timer and starting"
cast rpc evm_increaseTime $KICKOFF_DELAY --rpc-url "$RPC" >/dev/null
cast rpc evm_mine --rpc-url "$RPC" >/dev/null
cast send "$GARDEN" "startSeason()" --rpc-url "$RPC" --private-key "$PRIVATE_KEY" >/dev/null

# SeasonState field 3 of 7 is activePlots (level, epoch, activePlots, ...)
ACTIVE=$(cast call "$GARDEN" \
  "season()(uint32,uint32,uint32,uint32,uint32,uint16,uint8)" \
  --rpc-url "$RPC" | sed -n '3p')
echo
echo "season is running with $ACTIVE active plots."
echo "if that says 0, the cohort was empty -- restart anvil and run this again."
echo
echo "next:"
echo "  cast send \$GARDEN_ADDRESS 'drawWater(uint256,uint32)' 1 40 --rpc-url $RPC --private-key ${KEYS[0]}"
echo "  cast rpc evm_increaseTime 86400 --rpc-url $RPC && cast rpc evm_mine --rpc-url $RPC"
echo "  forge script script/LocalSettle.s.sol --rpc-url $RPC --broadcast"
