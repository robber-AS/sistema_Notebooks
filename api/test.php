<?php
// ============================================================
// TESTE DE CONEXÃO - Banco de Dados MySQL
// Acesse: http://localhost/sistema/api/test.php
// ============================================================

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config/config.php';

echo json_encode([
    'status' => 'ok',
    'mensagem' => 'Conexão com o banco de dados MySQL realizada com sucesso!',
    'banco' => DB_NAME,
    'servidor' => DB_HOST,
    'php_version' => PHP_VERSION,
]) . "\n\n";

// Testa as tabelas
try {
    $pdo = getConnection();

    $tabelas = ['usuarios', 'professores', 'notebooks', 'emprestimos', 'devolucoes', 'manutencoes'];

    echo "Tabelas verificadas:\n";
    foreach ($tabelas as $tabela) {
        $stmt = $pdo->query("SELECT COUNT(*) FROM $tabela");
        $count = $stmt->fetchColumn();
        echo "  - $tabela: $count registros\n";
    }

    // Testa a view do dashboard
    $stmt = $pdo->query('SELECT * FROM vw_dashboard_resumo');
    echo "\nResumo do dashboard:\n";
    foreach ($stmt->fetch() as $chave => $valor) {
        echo "  - $chave: $valor\n";
    }
} catch (Exception $e) {
    echo "\nERRO: " . $e->getMessage() . "\n";
}