<?php
// ============================================================
// API DE EMPRÉSTIMOS
// GET    /api/emprestimos.php            -> lista todos (com detalhes)
// GET    /api/emprestimos.php?status=X   -> filtra por status
// POST   /api/emprestimos.php            -> cria novo
// POST   /api/emprestimos.php?action=devolver&id=X  -> registra devolução
// DELETE /api/emprestimos.php?id=1       -> exclui
// ============================================================

require_once __DIR__ . '/config/config.php';

$pdo = getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$body = getRequestBody();

switch ($method) {
    case 'GET':
        // Filtros
        $where = [];
        $params = [];

        if (isset($_GET['status']) && $_GET['status'] !== '') {
            $statusMap = [
                'pendente'  => 'Pendente',
                'atrasado'  => 'Atrasado',
                'devolvido' => 'Devolvido',
            ];
            $status = $statusMap[$_GET['status']] ?? null;
            if ($status) {
                $where[] = "CASE
                    WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
                    WHEN e.data_prevista_devolucao < CURDATE() THEN 'Atrasado'
                    ELSE 'Pendente'
                END = :status";
                $params[':status'] = $status;
            }
        }

        $whereSql = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT
                e.*,
                CASE
                    WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
                    WHEN e.data_prevista_devolucao < CURDATE() THEN 'Atrasado'
                    ELSE 'Pendente'
                END AS status,
                CONCAT(n.marca, ' ', n.modelo) AS notebook_nome,
                n.patrimonio,
                p.nome AS professor_nome,
                p.matricula AS professor_matricula
            FROM emprestimos e
            INNER JOIN notebooks n ON n.id = e.notebook_id
            INNER JOIN professores p ON p.id = e.professor_id
            $whereSql
            ORDER BY e.id DESC
        ");
        $stmt->execute($params);

        success($stmt->fetchAll());
        break;

    case 'POST':
        $action = $_GET['action'] ?? 'criar';

        // ====================================================
        // CRIAR EMPRÉSTIMO
        // ====================================================
        if ($action === 'criar') {
            $notebookId = (int)($body['notebook_id'] ?? 0);
            $professorId = (int)($body['professor_id'] ?? 0);
            $dataSaida = trim($body['data_saida'] ?? '');
            $dataPrevista = trim($body['data_prevista_devolucao'] ?? '');
            $observacoes = trim($body['observacoes'] ?? '');

            if ($notebookId <= 0 || $professorId <= 0 || empty($dataSaida) || empty($dataPrevista)) {
                errorResponse('Notebook, professor, data de saída e data prevista são obrigatórios.');
            }

            if ($dataPrevista < $dataSaida) {
                errorResponse('A data prevista não pode ser anterior à data de saída.');
            }

            // Notebook existe e está disponível?
            $stmt = $pdo->prepare('SELECT estado FROM notebooks WHERE id = :id');
            $stmt->execute([':id' => $notebookId]);
            $notebook = $stmt->fetch();

            if (!$notebook) {
                errorResponse('Notebook não encontrado.', 404);
            }

            if (in_array($notebook['estado'], ['Em Manutenção', 'Baixado', 'Ruim'])) {
                errorResponse('Notebook não está disponível para empréstimo.');
            }

            // Notebook já emprestado?
            $stmt = $pdo->prepare('
                SELECT COUNT(*) FROM emprestimos
                WHERE notebook_id = :id AND data_devolucao IS NULL
            ');
            $stmt->execute([':id' => $notebookId]);
            if ($stmt->fetchColumn() > 0) {
                errorResponse('Notebook já está emprestado.');
            }

            // Professor existe?
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM professores WHERE id = :id');
            $stmt->execute([':id' => $professorId]);
            if ($stmt->fetchColumn() == 0) {
                errorResponse('Professor não encontrado.', 404);
            }

            $stmt = $pdo->prepare('
                INSERT INTO emprestimos
                    (notebook_id, professor_id, data_saida, data_prevista_devolucao, observacoes)
                VALUES
                    (:notebook_id, :professor_id, :data_saida, :data_prevista, :observacoes)
            ');
            $stmt->execute([
                ':notebook_id' => $notebookId,
                ':professor_id' => $professorId,
                ':data_saida' => $dataSaida,
                ':data_prevista' => $dataPrevista,
                ':observacoes' => $observacoes,
            ]);

            created(['id' => $pdo->lastInsertId()], 'Empréstimo registrado com sucesso');
        }

        // ====================================================
        // REGISTRAR DEVOLUÇÃO (direto no empréstimo)
        // ====================================================
        if ($action === 'devolver') {
            $id = (int)($body['id'] ?? 0);
            $dataDevolucao = trim($body['data_devolucao'] ?? '');
            $condicao = trim($body['condicao'] ?? '');
            $observacoes = trim($body['observacoes'] ?? '');

            if ($id <= 0 || empty($dataDevolucao) || empty($condicao)) {
                errorResponse('ID, data de devolução e condição são obrigatórios.');
            }

            $condicoesValidas = ['Bom', 'Regular', 'Danificado', 'Manutenção Necessária'];
            if (!in_array($condicao, $condicoesValidas)) {
                errorResponse('Condição inválida.');
            }

            // Busca o empréstimo
            $stmt = $pdo->prepare('
                SELECT e.*, n.id AS nb_id
                FROM emprestimos e
                INNER JOIN notebooks n ON n.id = e.notebook_id
                WHERE e.id = :id
            ');
            $stmt->execute([':id' => $id]);
            $emprestimo = $stmt->fetch();

            if (!$emprestimo) {
                errorResponse('Empréstimo não encontrado.', 404);
            }

            if ($emprestimo['data_devolucao']) {
                errorResponse('Este empréstimo já foi devolvido.');
            }

            // Atualiza o empréstimo
            $stmt = $pdo->prepare('
                UPDATE emprestimos
                SET data_devolucao = :data_devolucao,
                    condicao_devolucao = :condicao,
                    observacoes = :observacoes
                WHERE id = :id
            ');
            $stmt->execute([
                ':data_devolucao' => $dataDevolucao,
                ':condicao' => $condicao,
                ':observacoes' => $observacoes,
                ':id' => $id,
            ]);

            // Grava na tabela devolucoes
            $stmt = $pdo->prepare('
                INSERT INTO devolucoes
                    (emprestimo_id, notebook_id, professor_id, data_devolucao, condicao, observacoes)
                VALUES
                    (:emprestimo_id, :notebook_id, :professor_id, :data_devolucao, :condicao, :observacoes)
            ');
            $stmt->execute([
                ':emprestimo_id' => $id,
                ':notebook_id' => $emprestimo['notebook_id'],
                ':professor_id' => $emprestimo['professor_id'],
                ':data_devolucao' => $dataDevolucao,
                ':condicao' => $condicao,
                ':observacoes' => $observacoes,
            ]);

            // O TRIGGER trg_devolucao_atualiza_notebook atualiza o estado automaticamente

            success([], 'Devolução registrada com sucesso');
        }

        errorResponse('Ação inválida.');
        break;

    case 'DELETE':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID do empréstimo é obrigatório.');
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM emprestimos WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Empréstimo não encontrado.', 404);
        }

        // As devoluções vinculadas serão removidas por CASCADE
        $stmt = $pdo->prepare('DELETE FROM emprestimos WHERE id = :id');
        $stmt->execute([':id' => $id]);

        success([], 'Empréstimo excluído com sucesso');
        break;

    default:
        errorResponse('Método não permitido.', 405);
}