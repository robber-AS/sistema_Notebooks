const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/teachers
// GET /api/teachers/:id
router.get('/', async (req, res) => {
  try {
    const { id } = req.query;

    if (id) {
      const [rows] = await pool.query('SELECT * FROM professores WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Professor não encontrado.' });
      }
      return res.json({ success: true, data: rows[0] });
    }

    const [rows] = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM emprestimos e
               WHERE e.professor_id = p.id) AS total_emprestimos
       FROM professores p
       ORDER BY p.nome`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao listar professores:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// POST /api/teachers
router.post('/', async (req, res) => {
  const { nome, matricula, disciplina, telefone, email, observacoes } = req.body || {};

  if (!nome || !matricula || !disciplina || !telefone) {
    return res.status(400).json({ success: false, message: 'Nome, matrícula, disciplina e telefone são obrigatórios.' });
  }

  try {
    const [existentes] = await pool.query('SELECT id FROM professores WHERE matricula = ?', [matricula]);
    if (existentes.length > 0) {
      return res.status(400).json({ success: false, message: 'Já existe um professor com esta matrícula.' });
    }

    const [result] = await pool.query(
      'INSERT INTO professores (nome, matricula, disciplina, telefone, email, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, matricula, disciplina, telefone, email || null, observacoes || null]
    );

    res.status(201).json({ success: true, message: 'Professor cadastrado com sucesso', data: { id: result.insertId } });
  } catch (error) {
    console.error('Erro ao criar professor:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// PUT /api/teachers/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, matricula, disciplina, telefone, email, observacoes, ativo } = req.body || {};

  try {
    const [existente] = await pool.query('SELECT id FROM professores WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Professor não encontrado.' });
    }

    const novosValores = { nome, matricula, disciplina, telefone, email, observacoes, ativo };
    const colunas = [];
    const valores = [];

    for (const [chave, valor] of Object.entries(novosValores)) {
      if (valor !== undefined) {
        colunas.push(`\`${chave}\` = ?`);
        valores.push(valor);
      }
    }

    if (colunas.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar.' });
    }

    valores.push(id);
    await pool.query(`UPDATE professores SET ${colunas.join(', ')} WHERE id = ?`, valores);

    res.json({ success: true, message: 'Professor atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar professor:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [existente] = await pool.query('SELECT id FROM professores WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Professor não encontrado.' });
    }

    const [emprestimos] = await pool.query(
      'SELECT COUNT(*) AS total FROM emprestimos WHERE professor_id = ?',
      [id]
    );

    if (emprestimos[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível excluir este professor. Existem ${emprestimos[0].total} empréstimo(s) registrado(s). Finalize ou exclua os empréstimos antes.`
      });
    }

    await pool.query('DELETE FROM professores WHERE id = ?', [id]);

    res.json({ success: true, message: 'Professor excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir professor:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;