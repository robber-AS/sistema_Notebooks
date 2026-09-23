<?php
// ============================================================
// CONFIGURAÇÃO DO BANCO DE DADOS - MySQL
// Edite os valores conforme seu ambiente
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'sistema_notebooks');
define('DB_USER', 'root');
define('DB_PASS', '');

define('DB_CHARSET', 'utf8mb4');

// Retorna a conexão PDO com MySQL
function getConnection() {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            sendResponse(500, ['error' => 'Falha na conexão com o banco de dados: ' . $e->getMessage()]);
            exit;
        }
    }

    return $pdo;
}

// ============================================================
// FUNÇÕES AUXILIARES DE RESPOSTA
// ============================================================

function sendResponse($statusCode, $data) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function success($data = [], $message = 'Operação realizada com sucesso') {
    sendResponse(200, ['success' => true, 'message' => $message, 'data' => $data]);
}

function created($data = [], $message = 'Registro criado com sucesso') {
    sendResponse(201, ['success' => true, 'message' => $message, 'data' => $data]);
}

function errorResponse($message, $statusCode = 400) {
    sendResponse($statusCode, ['success' => false, 'message' => $message]);
}

// Lê o corpo da requisição (JSON)
function getRequestBody() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return $data ?: [];
}

// Trata CORS (permitir acesso do frontend)
function handleCors() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

handleCors();