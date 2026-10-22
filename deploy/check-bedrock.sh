#!/bin/bash
# Prueft, ob der Server Amazon Bedrock ueber seine IAM-Rolle nutzen kann.
# Aendert nichts, ruft nur auf und meldet je Pruefung OK oder FEHLER.
#
#   bash ~/app/deploy/check-bedrock.sh [claude-inference-profile-id]
set -uo pipefail

REGION=eu-central-1
EMBED_MODEL=amazon.titan-embed-text-v2:0
CHAT_MODEL="${1:-eu.anthropic.claude-haiku-4-5-20251001-v1:0}"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

ok()   { echo "  OK      $1"; }
fail() { echo "  FEHLER  $1"; echo "          $2" | head -c 400; echo; }

echo "1) Hat der Server eine Rolle?"
if ARN=$(aws sts get-caller-identity --query Arn --output text 2>"$TMP"); then
  ok "Server meldet sich an als: $ARN"
else
  fail "Keine Rolle am Server (EC2 -> Instanz -> Sicherheit -> IAM-Rolle)" "$(cat "$TMP")"
fi

echo "2) Embeddings (Titan Text Embeddings V2, $REGION)"
if aws bedrock-runtime invoke-model --region "$REGION" --model-id "$EMBED_MODEL" \
     --cli-binary-format raw-in-base64-out \
     --body '{"inputText":"Ventil wechseln","dimensions":1024}' /tmp/titan.json >/dev/null 2>"$TMP"; then
  DIMS=$(python3 -c 'import json; print(len(json.load(open("/tmp/titan.json"))["embedding"]))')
  ok "Titan liefert einen Vektor mit $DIMS Zahlen"
else
  fail "Titan-Aufruf abgelehnt" "$(cat "$TMP")"
fi

echo "3) Text (Claude, EU-Inference-Profil $CHAT_MODEL)"
if ANSWER=$(aws bedrock-runtime converse --region "$REGION" --model-id "$CHAT_MODEL" \
     --messages '[{"role":"user","content":[{"text":"Antworte nur mit: ok"}]}]' \
     --query "output.message.content[0].text" --output text 2>"$TMP"); then
  ok "Claude antwortet: $ANSWER"
else
  fail "Claude-Aufruf abgelehnt" "$(cat "$TMP")"
fi

echo "4) Kommt die App im Docker-Container an die Rolle?"
if OUT=$(sudo docker run --rm amazon/aws-cli sts get-caller-identity --region "$REGION" --query Arn --output text 2>"$TMP"); then
  ok "Container meldet sich an als: $OUT"
else
  fail "Container erreicht die Rolle nicht (Instanz-Metadaten: Hop-Limit muss 2 sein)" "$(tail -c 300 "$TMP")"
fi

echo "5) Gegenprobe: Ist die Rolle eng genug? (soll abgelehnt werden)"
if aws s3 ls >/dev/null 2>"$TMP"; then
  echo "  HINWEIS Die Rolle darf auch S3 auflisten - mehr Rechte als noetig"
else
  ok "S3 ist nicht erlaubt - die Rolle darf nur, was sie soll"
fi
