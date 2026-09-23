<?php
// ============================================================
// API DE NOTEBOOKS
// GET    /api/notebooks.php            -> lista todos
// GET    /api/notebooks.php?id=1       -> busca um
// POST   /api/notebooks.php            -> cria novo
// PUT    /api/notebooks.php?id=1       -> atualiza
// DELETE /api/notebooks.php?id=1       -> exclui
// ============================================================

require_once __DIR__ . '/config/config.php';

$pdo = getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$body = getRequestBody();

switch ($method) {
    case 'GET':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        // Busca um notebook
        if ($id > 0) {
            $stmt = $pdo->prepare('
                SELECT n.*,
                       (SELECT COUNT(*) FROM emprestimos e
                        WHERE e.notebook_id = n.id AND e.data_devolucao IS NULL) AS emprestado
                FROM notebooks n
                WHERE n.id = :id
            ');
            $stmt->execute([':id' => $id]);
            $notebook = $stmt->fetch();

            if (!$notebook) {
                errorResponse('Notebook não encontrado.', 404);
            }
            success($notebook);
        }

        // Busca notebooks disponíveis
        if (isset($_GET['disponiveis']) && $_GET['disponiveis'] === '1') {
            $stmt = $pdo->query('
                SELECT n.*
                FROM notebooks n
                WHERE n.ativo = 1
                  AND n.estado NOT IN (\'Em Manutenção\', \'Baixado\', \'Ruim\')
                  AND n.id NOT IN (
                      SELECT notebook_id FROM emprestimos WHERE data_devolucao IS NULL
                  )
                ORDER BY n.marca, n.modelo
            ');
            success($stmt->fetchAll());
        }

        // Lista todos
        $result = $pdo->query('
            SELECT n.*,
                   (SELECT COUNT(*) FROM emprestimos e
                    WHERE e.notebook_id = n.id AND e.data_devolucao IS NULL) AS emprestado
            FROM notebooks n
            ORDER BY n.id
        ');
        success($result->fetchAll());
        break;

    case 'POST':
        $marca = trim($body['marca'] ?? '');
        $modelo = trim($body['modelo'] ?? '');
        $patrimonio = trim($body['patrimonio'] ?? '');
        $estado = trim($body['estado'] ?? 'Bom');
        $numeroSerie = trim($body['numero_serie'] ?? '');
        $processador = trim($body['processador'] ?? '');
        $memoriaRam = trim($body['memoria_ram'] ?? '');
        $armazenamento = trim($body['armazenamento'] ?? '');
        $anoAquisicao = trim($body['ano_aquisicao'] ?? '');
        $observacoes = trim($body['observacoes'] ?? '');

        if (empty($marca) || empty($modelo) || empty($patrimonio)) {
            errorResponse('Marca, modelo e patrimônio são obrigatórios.');
        }

        // Verifica patrimônio duplicado
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM notebooks WHERE patrimonio = :p');
        $stmt->execute([':p' => $patrimonio]);
        if ($stmt->fetchColumn() > 0) {
            errorResponse('Já existe um notebook com este patrimônio.');
        }

        $stmt = $pdo->prepare('
            INSERT INTO notebooks
                (marca, modelo, patrimonio, estado, numero_serie, processador,
                 memoria_ram, armazenamento, ano_aquisicao, observacoes)
            VALUES
                (:marca, :modelo, :patrimonio, :estado, :numero_serie, :processador,
                 :memoria_ram, :armazenamento, :ano_aquisicao, :observacoes)
        ');
        $stmt->execute([
            ':marca'        => $marca,
            ':modelo'       => $modelo,
            ':patrimonio'   => $patrimonio,
            ':estado'       => $estado,
            ':numero_serie' => $numeroSerie,
            ':processador'  => $processador,
            ':memoria_ram'  => $memoriaRam,
            ':armazenamento'=> $armazenamento,
            ':ano_aquisicao'=> $anoAquisicao ?: null,
            ':observacoes'  => $observacoes,
        ]);

        created(['id' => $pdo->lastInsertId()], 'Notebook cadastrado com sucesso');
        break;

    case 'PUT':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID do notebook é obrigatório.');
        }

        // Verifica se existe
        $check = $pdo->prepare('SELECT COUNT(*) FROM notebooks WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Notebook não encontrado.', 404);
        }

        // Campos permitidos para atualização
        $fields = [
            'marca'        => 'marca',
            'modelo'       => 'modelo',
            'patrimonio'   => 'patrimonio',
            'estado'       => 'estado',
            'numero_serie' => 'numero_serie',
            'processador'  => 'processador',
            'memoria_ram'  => 'memoria_ram',
            'armazenamento'=> 'armazenamento',
            'ano_aquisicao'=> 'ano_aquisicao',
            'observacoes'  => 'observacoes',
            'ativo'        => 'ativo',
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

        $sql = 'UPDATE notebooks SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        success([], 'Notebook atualizado com sucesso');
        break;

    case 'DELETE':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($id <= 0) {
            errorResponse('ID do notebook é obrigatório.');
        }

        // Verifica se está emprestado
        $stmt = $pdo->prepare('
            SELECT COUNT(*) FROM emprestimos
            WHERE notebook_id = :id AND data_devolucao IS NULL
        ');
        $stmt->execute([':id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            errorResponse('Não é possível excluir: notebook está emprestado.', 409);
        }

        // Verifica se existe
        $check = $pdo->prepare('SELECT COUNT(*) FROM notebooks WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetchColumn() == 0) {
            errorResponse('Notebook não encontrado.', 404);
        }

        $stmt = $pdo->prepare('DELETE FROM notebooks WHERE id = :id');
        $stmt->execute([':id' => $id]);

        success([], 'Notebook excluído com sucesso');
        break;

    default:
        errorResponse('Método não permitido.', 405);
}