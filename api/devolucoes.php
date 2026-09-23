<?php
// ============================================================
// API DE DEVOLUÇÕES
// GET    /api/devolucoes.php            -> lista todas (com detalhes)
// GET    /api/devolucoes.php?condicao=X -> filtra por condição
// GET    /api/devolucoes.php?id=1       -> busca uma
// DELETE /api/devolucoes.php?id=1       -> exclui registro
// ============================================================

require_once __DIR__ . '/config/config.php';

$pdo = getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$body = getRequestBody();

switch ($method) {
    case 'GET':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        // Busca uma devolução específica
        if ($id > 0) {
            $stmt = $pdo->prepare('
                SELECT
                    d.*,
                    CONCAT(n.marca, \' \', n.modelo) AS notebook_nome,
                    n.patrimonio,
                    p.nome AS professor_nome
                FROM devolucoes d
                INNER JOIN notebooks n ON n.id = d.notebook_id
                INNER JOIN professores p ON p.id = d.professor_id
                WHERE d.id = :id
            ');
            $stmt->execute([':id' => $id]);
            $devolucao = $stmt->fetch();

            if (!$devolucao) {
                errorResponse('Devolução não encontrada.', 404);
            }
            success($devolucao);
        }

        // Filtro por condição
        $where = '';
        $params = [];

        if (isset($_GET['condicao']) && $_GET['condicao'] !== 'all' && $_GET['condicao'] !== '') {
            $where = ' WHERE d.condicao = :condicao';
            $params[':condicao'] = $_GET['condicao'];
        }

        $stmt = $pdo->prepare("
            SELECT
                d.*,
                CONCAT(n.marca, ' ', n.modelo) AS notebook_nome,
                n.patrimonio,
                p.nome AS professor_nome
            FROM devolucoes d
            INNER JOIN notebooks n ON n.id = d.notebook_id
            INNER JOIN professores p ON p.id = d.professor_id
            $where
            ORDER BY d.id DESC
        ");
        $stmt->execute($params);

        success($stmt->fetchAll());
        break;

    case 'DELETE':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID da devolução é obrigatório.');
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM devolucoes WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Devolução não encontrada.', 404);
        }

        $stmt = $pdo->prepare('DELETE FROM devolucoes WHERE id = :id');
        $stmt->execute([':id' => $id]);

        success([], 'Registro de devolução excluído com sucesso');
        break;

    default:
        errorResponse('Método não permitido.', 405);
}