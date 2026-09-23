const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/returns
// GET /api/returns?condicao=Bom|Regular|Danificado|Manutenção Necessária
// GET /api/returns/:id
router.get('/', async (req, res) => {
  try {
    const { condicao, id } = req.query;

    if (id) {
      const [rows] = await pool.query(
        `SELECT d.*, CONCAT(n.marca, ' ', n.modelo) AS notebook_nome, n.patrimonio,
                p.nome AS professor_nome, e.data_saida
         FROM devolucoes d
         INNER JOIN notebooks n ON n.id = d.notebook_id
         INNER JOIN professores p ON p.id = d.professor_id
         INNER JOIN emprestimos e ON e.id = d.emprestimo_id
         WHERE d.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Devolução não encontrada.' });
      }
      return res.json({ success: true, data: rows[0] });
    }

    let where = '';
    const params = [];

    if (condicao && condicao !== 'all') {
      where = 'WHERE d.condicao = ?';
      params.push(condicao);
    }

    const [rows] = await pool.query(
      `SELECT d.*, CONCAT(n.marca, ' ', n.modelo) AS notebook_nome, n.patrimonio,
              p.nome AS professor_nome, e.data_saida
       FROM devolucoes d
       INNER JOIN notebooks n ON n.id = d.notebook_id
       INNER JOIN professores p ON p.id = d.professor_id
       INNER JOIN emprestimos e ON e.id = d.emprestimo_id
       ${where}
       ORDER BY d.id DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao listar devoluções:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// DELETE /api/returns/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [existente] = await pool.query('SELECT id FROM devolucoes WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Devolução não encontrada.' });
    }

    await pool.query('DELETE FROM devolucoes WHERE id = ?', [id]);

    res.json({ success: true, message: 'Registro de devolução excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir devolução:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;