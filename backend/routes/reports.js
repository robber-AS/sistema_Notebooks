const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const STATUS_CASE = `CASE
        WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
        WHEN e.data_prevista_devolucao < CURDATE() THEN 'Atrasado'
        ELSE 'Pendente'
    END`;

// GET /api/reports?tipo=dashboard
// GET /api/reports?tipo=notebooks_estado
// GET /api/reports?tipo=emprestimos_professor
// GET /api/reports?tipo=atrasados
// GET /api/reports?tipo=atividade_mensal
// GET /api/reports?tipo=condicao
// GET /api/reports?tipo=historico
// GET /api/reports?tipo=notebooks_ranking
router.get('/', async (req, res) => {
  const { tipo } = req.query;

  try {
    switch (tipo) {
      // ============================================================
      case 'dashboard': {
        const [[resumo]] = await pool.query(
          `SELECT
             (SELECT COUNT(*) FROM notebooks WHERE ativo = 1) AS total_notebooks,
             (SELECT COUNT(*) FROM professores WHERE ativo = 1) AS total_professores,
             (SELECT COUNT(*) FROM notebooks n
              WHERE n.ativo = 1
                AND n.estado NOT IN ('Em Manutenção', 'Baixado', 'Ruim')
                AND n.id NOT IN (SELECT notebook_id FROM emprestimos WHERE data_devolucao IS NULL)
             ) AS notebooks_disponiveis,
             (SELECT COUNT(*) FROM emprestimos WHERE data_devolucao IS NULL) AS notebooks_emprestados`
        );

        const [recentes] = await pool.query(
          `SELECT e.id, ${STATUS_CASE} AS status, e.data_saida,
                  CONCAT(n.marca, ' ', n.modelo) AS notebook_nome,
                  p.nome AS professor_nome
           FROM emprestimos e
           INNER JOIN notebooks n ON n.id = e.notebook_id
           INNER JOIN professores p ON p.id = e.professor_id
           ORDER BY e.id DESC
           LIMIT 5`
        );

        // Campos do resumo ficam no mesmo nível, como o frontend espera
        return res.json({ success: true, data: { ...resumo, recentes } });
      }

      // ============================================================
      case 'notebooks_estado': {
        const [rows] = await pool.query('SELECT estado, COUNT(*) AS total FROM notebooks GROUP BY estado');
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'emprestimos_professor': {
        const [rows] = await pool.query(
          `SELECT p.id AS professor_id, p.nome AS professor, COUNT(e.id) AS total_emprestimos
           FROM professores p
           LEFT JOIN emprestimos e ON e.professor_id = p.id
           GROUP BY p.id, p.nome
           ORDER BY total_emprestimos DESC`
        );
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'atrasados': {
        const [rows] = await pool.query(
          `SELECT e.id AS emprestimo_id,
                  n.id AS notebook_id,
                  CONCAT(n.marca, ' ', n.modelo) AS notebook,
                  p.id AS professor_id,
                  p.nome AS professor,
                  p.telefone AS telefone_professor,
                  e.data_saida,
                  e.data_prevista_devolucao,
                  DATEDIFF(CURDATE(), e.data_prevista_devolucao) AS dias_atraso
           FROM emprestimos e
           INNER JOIN notebooks n ON n.id = e.notebook_id
           INNER JOIN professores p ON p.id = e.professor_id
           WHERE e.data_devolucao IS NULL
             AND e.data_prevista_devolucao < CURDATE()
           ORDER BY dias_atraso DESC`
        );
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'atividade_mensal': {
        const [rows] = await pool.query(
          `SELECT DATE_FORMAT(data_saida, '%m/%Y') AS mes_ano,
                  YEAR(data_saida) AS ano,
                  MONTH(data_saida) AS mes,
                  COUNT(*) AS total_emprestimos
           FROM emprestimos
           GROUP BY YEAR(data_saida), MONTH(data_saida), DATE_FORMAT(data_saida, '%m/%Y')
           ORDER BY ano DESC, mes DESC
           LIMIT 12`
        );
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'condicao': {
        const [rows] = await pool.query('SELECT condicao, COUNT(*) AS total FROM devolucoes GROUP BY condicao');
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'historico': {
        const [rows] = await pool.query(
          `SELECT e.id, e.data_saida, e.data_prevista_devolucao, e.data_devolucao,
                  e.condicao_devolucao, e.observacoes,
                  ${STATUS_CASE} AS status,
                  CONCAT(n.marca, ' ', n.modelo) AS notebook_nome,
                  p.nome AS professor_nome,
                  DATEDIFF(COALESCE(e.data_devolucao, CURDATE()), e.data_saida) AS dias_duracao
           FROM emprestimos e
           INNER JOIN notebooks n ON n.id = e.notebook_id
           INNER JOIN professores p ON p.id = e.professor_id
           ORDER BY e.id DESC`
        );
        return res.json({ success: true, data: rows });
      }

      // ============================================================
      case 'notebooks_ranking': {
        const [rows] = await pool.query(
          `SELECT n.id AS notebook_id,
                  CONCAT(n.marca, ' ', n.modelo) AS notebook,
                  n.patrimonio,
                  COUNT(e.id) AS total_emprestimos
           FROM notebooks n
           LEFT JOIN emprestimos e ON e.notebook_id = n.id
           GROUP BY n.id, n.marca, n.modelo, n.patrimonio
           ORDER BY total_emprestimos DESC`
        );
        return res.json({ success: true, data: rows });
      }

      default:
        return res.status(400).json({ success: false, message: 'Tipo de relatório inválido.' });
    }
  } catch (error) {
    console.error('Erro ao gerar relatório:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;