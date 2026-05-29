#!/usr/bin/env bash
# restore_me_local.sh — repuebla tu .me local con las 52 entradas listadas
USERNAME="suign"
PASSWORD="123456"
# --- helpers para que sea menos verboso ---
c() { cargo run --quiet -- communicate --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
r() { cargo run --quiet -- react --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
rl(){ cargo run --quiet -- relate --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
h() { cargo run --quiet -- have --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
b() { cargo run --quiet -- be --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
a() { cargo run --quiet -- at --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
d() { cargo run --quiet -- do --username "$USERNAME" --password "$PASSWORD" --key "$1" --value "$2"; }
# --- Communicate ---
c "status" "GraphQL bundle mutation working 🔧"
c "group" "Nos vemos el sábado a las 7pm"
c "abellae" '{"status":"ready","notes":"Se puede testear desde get"}'
c "_" "¡Terminamos la base de datos!"
c "_" "¡Terminamos la base de datos!"

# --- React ---
r "project:cleaker" "🚀"
r "meeting:2025" "❤️"
r "_" "🤖"
r "_" "🔥"
r "update:2025.07.30" "💡"
r "project:neurons.me" "🔥"
r "project:cleaker" "🔥"

# --- Relate ---
rl "" '{"username":"pepelalo","since":"2022-01-01","bond":"deep"}'
rl "" '{"name":"cleaker","role":"support"}'
rl "" '{"linked":"project:x","via":"intent"}'
rl "" '{"contribution":"infra","active":true}'
rl "" '{"collaborator":"pepelalo","role":"dev2"}'
rl "" '{"collaborator":"suign","role":"dev"}'
rl "" '{"collaborator":"abellae","role":"creator"}'

# --- Have ---
h "profile" '{"name":"Abella","skills":["Rust","JS","AI"],"active":true,"bio":"Developer of neurons.me and cleaker"}'
h "wallet" '{"type":"eth","address":"0x123abc...","alias":"cancunDAO"}'
h "equipment" "projector"
h "wallet" '{"alias":"main","public":"0xABC123","type":"eth"}'
h "tool" "cleaker"
h "_" '{"device":"Oak-D","alias":"camera1"}'
h "languages" '["es","en","fr"]'
h "profile" '{"name":"Abella","roles":["admin","user"],"active":true}'
h "wallet" '{"type":"eth","address":"0xABCDEF1234"}'
h "age" "34"

# --- Be ---
b "identity" "visionary"
b "status2" "visionary2"
b "status" "visionary"
b "status" "visionary"
b "status" "visionary"
b "status" "visionary"
b "hobbie" "diving"
b "_" "connected"
b "type" "collective"
b "_" "consciousness"
b "intelligence" '{"type":"emergent","level":9}'
b "species" "human"
b "species" "human"
b "identity" "creator"

# --- At ---
a "place" "Cancún"
a "location" "Cordoba"
a "environment" '{"hostname":"dev.neurons.me","uptime":"23h"}'
a "_" "home"
a "location" "cancun"
a "location" "cdmx"

# --- Do ---
d "action" "jumped"
d "task" "build"

echo "✔️ Restauración terminada."