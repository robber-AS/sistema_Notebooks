<?php
// ============================================================
// API DE RELATÓRIOS
// GET /api/relatorios.php?tipo=dashboard         -> resumo geral
// GET /api/relatorios.php?tipo=notebooks_estado  -> estado dos notebooks
// GET /api/relatorios.php?tipo=emprestimos_professor -> empréstimos por professor
// GET /api/relatorios.php?tipo=atrasados         -> empréstimos atrasados
// GET /api/relatorios.php?tipo=atividade_mensal  -> atividade mensal
// GET /api/relatorios.php?tipo=condicao          -> condições das devoluções
// GET /api/relatorios.php?tipo=historico         -> histórico completo
// ============================================================

require_once __DIR__ . '/config/config.php';

$pdo = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    errorResponse('Método não permitido.', 405);
}

$tipo = $_GET['tipo'] ?? 'dashboard';

switch ($tipo) {

    // Resumo do dashboard
    case 'dashboard':
        $result = $pdo->query('SELECT * FROM vw_dashboard_resumo');
        $dados = $result->fetch();

        // Últimos 5 empréstimos
        $recentes = $pdo->query('
            SELECT
                e.id, e.data_saida,
                CASE
                    WHEN e.data_devolucao IS NOT NULL THEN \'Devolvido\'
                    WHEN e.data_prevista_devolucao < CURDATE() THEN \'Atrasado\'
                    ELSE \'Pendente\'
                END AS status,
                CONCAT(n.marca, \' \', n.modelo) AS notebook_nome,
                p.nome AS professor_nome
            FROM emprestimos e
            INNER JOIN notebooks n ON n.id = e.notebook_id
            INNER JOIN professores p ON p.id = e.professor_id
            ORDER BY e.id DESC
            LIMIT 5
        ')->fetchAll();

        success([
            'resumo' => $dados,
            'recentes' => $recentes,
        ]);
        break;

    // Estado dos notebooks
    case 'notebooks_estado':
        $estados = $pdo->query("
            SELECT estado, COUNT(*) AS total
            FROM notebooks
            GROUP BY estado
        ")->fetchAll();

        success($estados);
        break;

    // Empréstimos por professor
    case 'emprestimos_professor':
        $result = $pdo->query('
            SELECT
                p.id AS professor_id,
                p.nome AS professor,
                COUNT(e.id) AS total_emprestimos
            FROM professores p
            LEFT JOIN emprestimos e ON e.professor_id = p.id
            GROUP BY p.id, p.nome
            ORDER BY total_emprestimos DESC
        ')->fetchAll();

        success($result);
        break;

    // Empréstimos atrasados
    case 'atrasados':
        $result = $pdo->query('SELECT * FROM vw_emprestimos_atrasados ORDER BY dias_atraso DESC');
        success($result->fetchAll());
        break;

    // Atividade mensal
    case 'atividade_mensal':
        $result = $pdo->query('SELECT * FROM vw_atividade_mensal LIMIT 12');
        success($result->fetchAll());
        break;

    // Condições nas devoluções
    case 'condicao':
        $result = $pdo->query('SELECT * FROM vw_condicao_devolucoes');
        success($result->fetchAll());
        break;

    // Histórico completo
    case 'historico':
        $result = $pdo->query('
            SELECT
                e.id, e.data_saida, e.data_prevista_devolucao, e.data_devolucao,
                e.condicao_devolucao, e.observacoes,
                CASE
                    WHEN e.data_devolucao IS NOT NULL THEN \'Devolvido\'
                    WHEN e.data_prevista_devolucao < CURDATE() THEN \'Atrasado\'
                    ELSE \'Pendente\'
                END AS status,
                CONCAT(n.marca, \' \', n.modelo) AS notebook_nome,
                p.nome AS professor_nome,
                DATEDIFF(COALESCE(e.data_devolucao, CURDATE()), e.data_saida) AS dias_duracao
            FROM emprestimos e
            INNER JOIN notebooks n ON n.id = e.notebook_id
            INNER JOIN professores p ON p.id = e.professor_id
            ORDER BY e.id DESC
        ')->fetchAll();

        success($result);
        break;

    // Ranking de notebooks
    case 'notebooks_ranking':
        $result = $pdo->query('SELECT * FROM vw_notebooks_mais_utilizados');
        success($result->fetchAll());
        break;

    default:
        errorResponse('Tipo de relatório inválido.');
}