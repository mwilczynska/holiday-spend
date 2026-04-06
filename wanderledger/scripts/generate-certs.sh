#!/bin/bash
# Generate self-signed TLS certificates for development/initial deployment

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/selfsigned.key" \
  -out "$CERT_DIR/selfsigned.crt" \
  -subj "/C=AU/ST=NSW/L=Sydney/O=Wanderledger/CN=wanderledger"

echo "Certificates generated in $CERT_DIR"
