<?php
// ============================================================
// API DE AUTENTICAÇÃO
// POST /api/login.php  { "usuario": "admin", "senha": "admin123" }
// POST /api/logout.php
// ============================================================

require_once __DIR__ . '/config/config.php';

// Verifica se a sessão já foi iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $action = isset($_GET['action']) ? $_GET['action'] : 'login';

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        success([], 'Sessão encerrada com sucesso');
    }

    $body = getRequestBody();
    $usuario = trim($body['usuario'] ?? '');
    $senha = trim($body['senha'] ?? '');

    if (empty($usuario) || empty($senha)) {
        errorResponse('Usuário e senha são obrigatórios.');
    }

    $pdo = getConnection();

    $stmt = $pdo->prepare('
        SELECT id, nome, usuario, senha, email, ativo
        FROM usuarios
        WHERE usuario = :usuario
        LIMIT 1
    ');
    $stmt->execute([':usuario' => $usuario]);
    $user = $stmt->fetch();

    // Valida credenciais (senha armazenada com MD5 nos dados de exemplo)
    if (!$user || $user['senha'] !== md5($senha)) {
        errorResponse('Usuário ou senha incorretos.', 401);
    }

    if (!(int)$user['ativo']) {
        errorResponse('Usuário desativado. Contate o administrador.', 403);
    }

    // Inicia sessão
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['usuario'] = $user['usuario'];
    $_SESSION['nome'] = $user['nome'];

    // Retorna dados do usuário (sem a senha)
    unset($user['senha']);
    success($user, 'Login realizado com sucesso');
} else {
    errorResponse('Método não permitido.', 405);
}