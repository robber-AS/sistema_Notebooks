const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Coluna "status" computada via CASE (MySQL não permite CURDATE() em coluna gerada)
const STATUS_CASE = `CASE
        WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
        WHEN e.data_prevista_devolucao < CURDATE() THEN 'Atrasado'
        ELSE 'Pendente'
    END`;

// GET /api/loans
// GET /api/loans?status=pendente|atrasado|devolvido
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let where = '';
    const params = [];

    const statusMap = {
      pendente: 'Pendente',
      atrasado: 'Atrasado',
      devolvido: 'Devolvido',
    };

    if (status && statusMap[status]) {
      where = `WHERE ${STATUS_CASE} = ?`;
      params.push(statusMap[status]);
    }

    const [rows] = await pool.query(
      `SELECT
          e.*,
          ${STATUS_CASE} AS status,
          CONCAT(n.marca, ' ', n.modelo) AS notebook_nome,
          n.patrimonio,
          p.nome AS professor_nome,
          p.matricula AS professor_matricula
       FROM emprestimos e
       INNER JOIN notebooks n ON n.id = e.notebook_id
       INNER JOIN professores p ON p.id = e.professor_id
       ${where}
       ORDER BY e.id DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao listar empréstimos:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// POST /api/loans  { notebook_id, professor_id, data_saida, data_prevista_devolucao }
router.post('/', async (req, res) => {
  const { notebook_id, professor_id, data_saida, data_prevista_devolucao, observacoes } = req.body || {};

  if (!notebook_id || !professor_id || !data_saida || !data_prevista_devolucao) {
    return res.status(400).json({ success: false, message: 'Notebook, professor, data de saída e data prevista são obrigatórios.' });
  }

  if (data_prevista_devolucao < data_saida) {
    return res.status(400).json({ success: false, message: 'A data prevista não pode ser anterior à data de saída.' });
  }

  try {
    // Notebook existe e está disponível?
    const [notebooks] = await pool.query('SELECT id, estado FROM notebooks WHERE id = ?', [notebook_id]);
    if (notebooks.length === 0) {
      return res.status(404).json({ success: false, message: 'Notebook não encontrado.' });
    }

    const notebook = notebooks[0];
    if (['Em Manutenção', 'Baixado', 'Ruim'].includes(notebook.estado)) {
      return res.status(400).json({ success: false, message: 'Notebook não está disponível para empréstimo.' });
    }

    // Notebook já emprestado?
    const [emprestados] = await pool.query(
      'SELECT id FROM emprestimos WHERE notebook_id = ? AND data_devolucao IS NULL',
      [notebook_id]
    );
    if (emprestados.length > 0) {
      return res.status(400).json({ success: false, message: 'Notebook já está emprestado.' });
    }

    // Professor existe?
    const [professores] = await pool.query('SELECT id FROM professores WHERE id = ?', [professor_id]);
    if (professores.length === 0) {
      return res.status(404).json({ success: false, message: 'Professor não encontrado.' });
    }

    const [result] = await pool.query(
      `INSERT INTO emprestimos
         (notebook_id, professor_id, data_saida, data_prevista_devolucao, observacoes)
       VALUES (?, ?, ?, ?, ?)`,
      [notebook_id, professor_id, data_saida, data_prevista_devolucao, observacoes || null]
    );

    res.status(201).json({ success: true, message: 'Empréstimo registrado com sucesso', data: { id: result.insertId } });
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// POST /api/loans/:id/return
// Body: { data_devolucao, condicao, observacoes }
router.post('/:id/return', async (req, res) => {
  const { id } = req.params;
  const { data_devolucao, condicao, observacoes } = req.body || {};

  const condicoesValidas = ['Bom', 'Regular', 'Danificado', 'Manutenção Necessária'];

  if (!data_devolucao || !condicao) {
    return res.status(400).json({ success: false, message: 'Data de devolução e condição são obrigatórias.' });
  }

  if (!condicoesValidas.includes(condicao)) {
    return res.status(400).json({ success: false, message: 'Condição inválida.' });
  }

  try {
    // Busca o empréstimo
    const [emprestimos] = await pool.query(
      'SELECT e.*, n.id AS nb_id FROM emprestimos e INNER JOIN notebooks n ON n.id = e.notebook_id WHERE e.id = ?',
      [id]
    );

    if (emprestimos.length === 0) {
      return res.status(404).json({ success: false, message: 'Empréstimo não encontrado.' });
    }

    const emprestimo = emprestimos[0];

    if (emprestimo.data_devolucao) {
      return res.status(400).json({ success: false, message: 'Este empréstimo já foi devolvido.' });
    }

    // Transaction: atualiza empréstimo + grava devolução + atualiza estado do notebook
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE emprestimos
         SET data_devolucao = ?, condicao_devolucao = ?, observacoes = ?
         WHERE id = ?`,
        [data_devolucao, condicao, observacoes || null, id]
      );

      await connection.query(
        `INSERT INTO devolucoes
           (emprestimo_id, notebook_id, professor_id, data_devolucao, condicao, observacoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, emprestimo.notebook_id, emprestimo.professor_id, data_devolucao, condicao, observacoes || null]
      );

      // Atualiza estado do notebook conforme a condição
      if (condicao === 'Danificado') {
        await connection.query('UPDATE notebooks SET estado = ? WHERE id = ?', ['Ruim', emprestimo.notebook_id]);
      } else if (condicao === 'Manutenção Necessária') {
        await connection.query('UPDATE notebooks SET estado = ? WHERE id = ?', ['Em Manutenção', emprestimo.notebook_id]);
      }

      await connection.commit();
      res.json({ success: true, message: 'Devolução registrada com sucesso' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao registrar devolução:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// DELETE /api/loans/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [existente] = await pool.query('SELECT id FROM emprestimos WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Empréstimo não encontrado.' });
    }

    // Devoluções vinculadas são removidas via CASCADE
    await pool.query('DELETE FROM emprestimos WHERE id = ?', [id]);

    res.json({ success: true, message: 'Empréstimo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir empréstimo:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;