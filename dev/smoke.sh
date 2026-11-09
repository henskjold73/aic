#!/bin/bash
# Smoke test against the running local harness (npm start). Prints PASS/FAIL per check.
B=http://127.0.0.1:3000
JAR=$(mktemp)
ALICE=aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa
BOB=bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb
TEAM=cccccccc-3333-4333-8333-cccccccccccc
NEWKEY=dddddddd-4444-4444-8444-dddddddddddd
DUPKEY=eeeeeeee-5555-4555-8555-eeeeeeeeeeee
FP=$(printf 'f%.0s' $(seq 1 64))
pass=0; failn=0
check() { # name, expected substring, actual
  if printf '%s' "$3" | grep -q -- "$2"; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1"; echo "      expected: $2"; echo "      got:      $(printf '%s' "$3" | head -c 300)"; failn=$((failn+1)); fi
}
j() { curl -s -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' "$@"; }

echo "── signed out"
check "session is null"            '"account":null' "$(j $B/api/me/session)"
check "me/usage needs sign-in"     'not signed in'  "$(j $B/api/me/usage)"
TEAMJ=$(j $B/api/team/$TEAM)
check "team lists both members"    'Alice' "$TEAMJ"
check "team payload has no keys"   'OK' "$(printf '%s' "$TEAMJ" | grep -q "$ALICE\|$BOB\|user_uuid\|\"uuid\"" && echo LEAK || echo OK)"
check "member days via team link"  '"aiu"' "$(j "$B/api/team/$TEAM/days?month=$(date +%Y-%m)&member=$(printf '%s' "$TEAMJ" | sed -n 's/.*"id":"\([^"]*\)","name":"Alice".*/\1/p')")"
check "member of another team 404" 'member not found' "$(j "$B/api/team/$TEAM/days?month=$(date +%Y-%m)&member=99999999-9999-4999-8999-999999999999")"
check "legacy read still works"    '"aiu":120' "$(j $B/api/usage/$ALICE)"

echo "── sign in as alice, claim her legacy key"
j -o /dev/null "$B/dev/login?as=alice"
check "session has account"        '"display_name":"alice"' "$(j $B/api/me/session)"
check "attach legacy key"          '"merged":true' "$(j -X POST $B/api/me/keys -d "{\"key\":\"$ALICE\"}")"
check "usage via account"          '"aiu":120' "$(j $B/api/me/usage)"
check "team still shows alice"     'Alice' "$(j $B/api/team/$TEAM)"
check "my teams (by account)"      'Crew' "$(j $B/api/team)"
check "session keys hide the key"  'OK' "$(j $B/api/me/session | grep -q "$ALICE" && echo LEAK || echo OK)"

echo "── pairing a new machine"
PAIR=$(curl -s -X POST $B/api/usage/$NEWKEY/ping -H 'Content-Type: application/json' -d '{"request_pair_code":true}')
CODE=$(printf '%s' "$PAIR" | sed -n 's/.*"pair_code":"\([^"]*\)".*/\1/p')
check "installer gets a code"      '[A-Z2-9]\{4\}-[A-Z2-9]\{4\}' "$CODE"
check "wrong code rejected"        'invalid or expired' "$(j -X POST $B/api/me/pair -d '{"code":"AAAA-AAAA"}')"
check "right code links machine"   '"ok":true' "$(j -X POST $B/api/me/pair -d "{\"code\":\"$CODE\"}")"
check "code is single use"         'invalid or expired' "$(j -X POST $B/api/me/pair -d "{\"code\":\"$CODE\"}")"
check "re-run installer: linked"   '"linked":true' "$(curl -s -X POST $B/api/usage/$NEWKEY/ping -H 'Content-Type: application/json' -d '{"request_pair_code":true}')"

echo "── duplicate detection"
curl -s -o /dev/null -X POST $B/api/usage/$ALICE/ping -H 'Content-Type: application/json' -d "{\"script_version\":\"1.5.0\",\"db_fingerprint\":\"$FP\"}"
curl -s -o /dev/null -X POST $B/api/usage/$NEWKEY/ping -H 'Content-Type: application/json' -d "{\"script_version\":\"1.5.0\",\"db_fingerprint\":\"$FP\"}"
curl -s -o /dev/null -X POST $B/api/usage/$NEWKEY -H 'Content-Type: application/json' -d '{"aiu":60,"input_tokens":1,"output_tokens":1,"script_version":"1.5.0"}'
SESS=$(j $B/api/me/session)
check "warning raised"             'duplicate_keys' "$SESS"
check "reason is same_database"    'same_database' "$SESS"
check "overstated = smaller key"   '"overstated_aiu":60' "$SESS"
check "usage double counts (180)"  '"aiu":180' "$(j $B/api/me/usage)"
J=$(j $B/api/me/devices); IDS=$(printf "%s" "$J" | sed -n 's/.*"warnings":\[{[^}]*"key_ids":\["\([^"]*\)","\([^"]*\)"\].*/\1 \2/p')
NEWID=$(printf "%s" "$J" | sed -n 's/.*"id":"\([^"]*\)","hint":"dddd".*/\1/p')
DIS=$(printf '{"id":"%s","disabled":true}' "$NEWID"); ENA=$(printf '{"id":"%s","disabled":false}' "$NEWID")
check "disable the new key"        '"ok":true' "$(j -X PATCH $B/api/me/device -d "$DIS")"
check "usage back to 120"          '"aiu":120' "$(j $B/api/me/usage)"
check "warning gone after disable" '"warnings":\[\]' "$(j $B/api/me/session)"
j -o /dev/null -X PATCH $B/api/me/device -d "$ENA"
set -- $IDS
DSM=$(printf '{"key_ids":["%s","%s"]}' "$1" "$2")
check "dismiss as different"       '"ok":true' "$(j -X POST $B/api/me/dismiss -d "$DSM")"
check "warning stays dismissed"    '"warnings":\[\]' "$(j $B/api/me/session)"

echo "── budget, teams, legacy switch"
check "set budget"                 '"ok":true' "$(j -X PATCH $B/api/me/budget -d '{"budget":777}')"
check "budget on usage"            '"budget":777' "$(j $B/api/me/usage)"
check "team sees account budget"   '777' "$(j $B/api/team/$TEAM)"
check "key owned by bob's shadow is refused for a 2nd real account" '409' "$(j2=$(mktemp); curl -s -c $j2 -o /dev/null "$B/dev/login?as=mallory"; curl -s -b $j2 -X POST $B/api/me/keys -H 'Content-Type: application/json' -d "{\"key\":\"$ALICE\"}" -w ' %{http_code}')"
check "sign out"                   '"ok":true' "$(j -X POST $B/api/me/logout)"
check "signed out again"           '"account":null' "$(j $B/api/me/session)"

echo; echo "$pass passed, $failn failed"; rm -f "$JAR"
[ "$failn" = 0 ]
