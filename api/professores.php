<?php
// ============================================================
// API DE PROFESSORES
// GET    /api/professores.php            -> lista todos
// GET    /api/professores.php?id=1       -> busca um
// POST   /api/professores.php            -> cria novo
// PUT    /api/professores.php?id=1       -> atualiza
// DELETE /api/professores.php?id=1       -> exclui
// ============================================================

require_once __DIR__ . '/config/config.php';

$pdo = getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$body = getRequestBody();

switch ($method) {
    case 'GET':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM professores WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $professor = $stmt->fetch();

            if (!$professor) {
                errorResponse('Professor não encontrado.', 404);
            }
            success($professor);
        }

        $result = $pdo->query('
            SELECT p.*,
                   (SELECT COUNT(*) FROM emprestimos e
                    WHERE e.professor_id = p.id) AS total_emprestimos
            FROM professores p
            ORDER BY p.nome
        ');
        success($result->fetchAll());
        break;

    case 'POST':
        $nome = trim($body['nome'] ?? '');
        $matricula = trim($body['matricula'] ?? '');
        $disciplina = trim($body['disciplina'] ?? '');
        $telefone = trim($body['telefone'] ?? '');
        $email = trim($body['email'] ?? '');
        $observacoes = trim($body['observacoes'] ?? '');

        if (empty($nome) || empty($matricula) || empty($disciplina) || empty($telefone)) {
            errorResponse('Nome, matrícula, disciplina e telefone são obrigatórios.');
        }

        // Verifica matrícula duplicada
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM professores WHERE matricula = :m');
        $stmt->execute([':m' => $matricula]);
        if ($stmt->fetchColumn() > 0) {
            errorResponse('Já existe um professor com esta matrícula.');
        }

        $stmt = $pdo->prepare('
            INSERT INTO professores (nome, matricula, disciplina, telefone, email, observacoes)
            VALUES (:nome, :matricula, :disciplina, :telefone, :email, :observacoes)
        ');
        $stmt->execute([
            ':nome'        => $nome,
            ':matricula'   => $matricula,
            ':disciplina'  => $disciplina,
            ':telefone'    => $telefone,
            ':email'       => $email ?: null,
            ':observacoes' => $observacoes,
        ]);

        created(['id' => $pdo->lastInsertId()], 'Professor cadastrado com sucesso');
        break;

    case 'PUT':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID do professor é obrigatório.');
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM professores WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Professor não encontrado.', 404);
        }

        $fields = [
            'nome'        => 'nome',
            'matricula'   => 'matricula',
            'disciplina'  => 'disciplina',
            'telefone'    => 'telefone',
            'email'       => 'email',
            'observacoes' => 'observacoes',
            'ativo'       => 'ativo',
        ];

        $sets = [];
        $params = [':id' => $id];

        foreach ($fields as $chave => $coluna) {
            if (array_key_exists($chave, $body)) {
                $sets[] = "$coluna = :$chave";
                $params[":$chave"] = $body[$chave];
            }
        }

        if (empty($sets)) {
            errorResponse('Nenhum campo para atualizar.');
        }

        $sql = 'UPDATE professores SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        success([], 'Professor atualizado com sucesso');
        break;

    case 'DELETE':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID do professor é obrigatório.');
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM professores WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Professor não encontrado.', 404);
        }

        $stmt = $pdo->prepare('DELETE FROM professores WHERE id = :id');
        $stmt->execute([':id' => $id]);

        success([], 'Professor excluído com sucesso');
        break;

    default:
        errorResponse('Método não permitido.', 405);
}