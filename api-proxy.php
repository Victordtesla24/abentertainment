<?php
/**
 * API Reverse Proxy — forwards /api/* requests to the VPS Node.js server.
 *
 * Hostinger shared hosting (LiteSpeed) cannot proxy directly via .htaccess [P] flag.
 * This PHP script acts as a transparent reverse proxy, forwarding requests to the
 * VPS at 187.77.12.13:3001 and relaying responses back to the browser.
 *
 * .htaccess routes: /api/* → api-proxy.php?__path=/api/*
 *                   /uploads/* → api-proxy.php?__path=/uploads/*
 */

$VPS_HOST = 'http://187.77.12.13:3000';

// Get the API path from the query parameter set by .htaccess rewrite
$apiPath = isset($_GET['__path']) ? $_GET['__path'] : '';
$validPath = $apiPath && (strpos($apiPath, '/api/') === 0 || strpos($apiPath, '/uploads/') === 0 || strpos($apiPath, '/events/') === 0);
if (!$validPath) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid path']);
    exit;
}

$targetUrl = $VPS_HOST . $apiPath;
$method = $_SERVER['REQUEST_METHOD'];

// Read request body for POST/PUT/PATCH/DELETE
$requestBody = file_get_contents('php://input');

// Build headers to forward
$forwardHeaders = [
    'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'application/json'),
    'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? ''),
    'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? ''),
    'X-Forwarded-Proto: https',
];

// Forward Authorization header if present
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $forwardHeaders[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
}

// Forward Cookie header — required for session-based auth (admin panel)
if (!empty($_SERVER['HTTP_COOKIE'])) {
    $forwardHeaders[] = 'Cookie: ' . $_SERVER['HTTP_COOKIE'];
}

// Forward CSRF token header if present
if (isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
    $forwardHeaders[] = 'X-CSRF-Token: ' . $_SERVER['HTTP_X_CSRF_TOKEN'];
}

// Forward Origin header
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $forwardHeaders[] = 'Origin: ' . $_SERVER['HTTP_ORIGIN'];
}

// Handle CORS preflight
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: https://abentertainment.com.au');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

// Make the request to VPS — follow redirects (trailingSlash in Next.js may issue 308)
$ch = curl_init($targetUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
]);

if ($requestBody && in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API server unreachable', 'detail' => $error]);
    exit;
}

// Split response into headers and body
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

// Forward relevant response headers
foreach (explode("\r\n", $responseHeaders) as $headerLine) {
    if (stripos($headerLine, 'content-type:') === 0) {
        header($headerLine);
    }
    if (stripos($headerLine, 'set-cookie:') === 0) {
        header($headerLine, false);
    }
}

// Set CORS headers for the proxied response
header('Access-Control-Allow-Origin: https://abentertainment.com.au');
header('Access-Control-Allow-Credentials: true');

http_response_code($httpCode);
echo $responseBody;
