<?php
declare(strict_types=1);

/**
 * GitHub push webhook handler for Hostinger shared hosting.
 * - Accepts only POST requests
 * - Validates HMAC SHA-256 signature
 * - Accepts GitHub payloads sent as application/json or form-urlencoded payload=
 * - Deploys only refs/heads/main for Victordtesla24/abentertainment
 */

header("Content-Type: application/json; charset=utf-8");

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    exit;
}

$rawBody = file_get_contents("php://input");
if ($rawBody === false || $rawBody === "") {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Empty request body"]);
    exit;
}

$signatureHeader = $_SERVER["HTTP_X_HUB_SIGNATURE_256"] ?? "";
if ($signatureHeader === "" || !str_starts_with($signatureHeader, "sha256=")) {
    http_response_code(401);
    echo json_encode(["ok" => false, "error" => "Missing webhook signature"]);
    exit;
}

$secret = getenv("DEPLOY_WEBHOOK_SECRET") ?: "";
if ($secret === "") {
    $secretFile = "/home/u970615914/.deploy_webhook_secret";
    if (is_readable($secretFile)) {
        $fileSecret = file_get_contents($secretFile);
        if ($fileSecret !== false) {
            $secret = trim($fileSecret);
        }
    }
}

if ($secret === "") {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Webhook secret is not configured"]);
    exit;
}

$expected = "sha256=" . hash_hmac("sha256", $rawBody, $secret);
if (!hash_equals($expected, $signatureHeader)) {
    http_response_code(401);
    echo json_encode(["ok" => false, "error" => "Invalid webhook signature"]);
    exit;
}

$event = $_SERVER["HTTP_X_GITHUB_EVENT"] ?? "";
if ($event !== "push") {
    http_response_code(202);
    echo json_encode(["ok" => true, "ignored" => "Only push events are handled"]);
    exit;
}

$contentType = $_SERVER["CONTENT_TYPE"] ?? "";
$payloadJson = $rawBody;
if (str_contains($contentType, "application/x-www-form-urlencoded")) {
    parse_str($rawBody, $form);
    $payloadJson = isset($form["payload"]) ? (string)$form["payload"] : "";
}

$payload = json_decode($payloadJson, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Invalid JSON payload"]);
    exit;
}

$ref = (string)($payload["ref"] ?? "");
$repoFullName = (string)($payload["repository"]["full_name"] ?? "");

if ($ref !== "refs/heads/main" || $repoFullName !== "Victordtesla24/abentertainment") {
    http_response_code(202);
    echo json_encode([
        "ok" => true,
        "ignored" => "Webhook accepted but ref/repository did not match deployment scope",
    ]);
    exit;
}

$deployRoot = "/home/u970615914/domains/abentertainment.com.au/public_html";
$lockPath = "/tmp/abentertainment_deploy.lock";
$logPath = "/home/u970615914/deploy-webhook.log";
$timestamp = gmdate("Y-m-d\\TH:i:s\\Z");
$shortSha = substr((string)($payload["after"] ?? ""), 0, 12);

$preamble = "[" . $timestamp . "] queued sha=" . $shortSha . PHP_EOL;
file_put_contents($logPath, $preamble, FILE_APPEND);

$backgroundScript =
    "set -euo pipefail; " .
    "exec 9>" . escapeshellarg($lockPath) . "; " .
    "flock -n 9 || exit 0; " .
    "cd " . escapeshellarg($deployRoot) . "; " .
    "git fetch origin main; " .
    "git reset --hard origin/main; " .
    "git clean -fd; " .
    "echo '[done] " . $shortSha . " '\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\";";

$launchCommand = sprintf(
    "/usr/bin/env bash -lc %s >> %s 2>&1 &",
    escapeshellarg($backgroundScript),
    escapeshellarg($logPath)
);
exec($launchCommand);

http_response_code(202);
echo json_encode(["ok" => true, "queued_sha" => $shortSha]);
