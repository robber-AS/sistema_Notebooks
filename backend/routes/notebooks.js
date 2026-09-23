const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/notebooks/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT n.*,
              (SELECT COUNT(*) FROM emprestimos e
               WHERE e.notebook_id = n.id AND e.data_devolucao IS NULL) AS emprestado
       FROM notebooks n
       WHERE n.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notebook não encontrado.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Erro ao buscar notebook:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// GET /api/notebooks
// GET /api/notebooks?disponiveis=true
router.get('/', async (req, res) => {
  try {
    const { disponiveis, id } = req.query;

    // Busca um notebook específico
    if (id) {
      const [rows] = await pool.query(
        `SELECT n.*,
                (SELECT COUNT(*) FROM emprestimos e
                 WHERE e.notebook_id = n.id AND e.data_devolucao IS NULL) AS emprestado
         FROM notebooks n
         WHERE n.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Notebook não encontrado.' });
      }

      return res.json({ success: true, data: rows[0] });
    }

    // Apenas notebooks disponíveis (para novo empréstimo)
    if (disponiveis === 'true' || disponiveis === '1') {
      const [rows] = await pool.query(
        `SELECT n.*
         FROM notebooks n
         WHERE n.ativo = 1
           AND n.estado NOT IN ('Em Manutenção', 'Baixado', 'Ruim')
           AND n.id NOT IN (
               SELECT notebook_id FROM emprestimos WHERE data_devolucao IS NULL
           )
         ORDER BY n.marca, n.modelo`
      );
      return res.json({ success: true, data: rows });
    }

    // Lista todos
    const [rows] = await pool.query(
      `SELECT n.*,
              (SELECT COUNT(*) FROM emprestimos e
               WHERE e.notebook_id = n.id AND e.data_devolucao IS NULL) AS emprestado
       FROM notebooks n
       ORDER BY n.id`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao listar notebooks:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// POST /api/notebooks
router.post('/', async (req, res) => {
  const {
    marca, modelo, patrimonio, estado = 'Bom',
    numero_serie, processador, memoria_ram, armazenamento,
    ano_aquisicao, observacoes,
  } = req.body || {};

  if (!marca || !modelo || !patrimonio) {
    return res.status(400).json({ success: false, message: 'Marca, modelo e patrimônio são obrigatórios.' });
  }

  try {
    // Verifica patrimônio duplicado
    const [existentes] = await pool.query('SELECT id FROM notebooks WHERE patrimonio = ?', [patrimonio]);
    if (existentes.length > 0) {
      return res.status(400).json({ success: false, message: 'Já existe um notebook com este patrimônio.' });
    }

    const [result] = await pool.query(
      `INSERT INTO notebooks
         (marca, modelo, patrimonio, estado, numero_serie, processador,
          memoria_ram, armazenamento, ano_aquisicao, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [marca, modelo, patrimonio, estado, numero_serie || null, processador || null,
       memoria_ram || null, armazenamento || null, ano_aquisicao || null, observacoes || null]
    );

    res.status(201).json({ success: true, message: 'Notebook cadastrado com sucesso', data: { id: result.insertId } });
  } catch (error) {
    console.error('Erro ao criar notebook:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// PUT /api/notebooks/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { marca, modelo, patrimonio, estado, numero_serie, processador,
          memoria_ram, armazenamento, ano_aquisicao, observacoes, ativo } = req.body || {};

  try {
    const [existente] = await pool.query('SELECT id FROM notebooks WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Notebook não encontrado.' });
    }

    const novosValores = {
      marca, modelo, patrimonio, estado, numero_serie, processador,
      memoria_ram, armazenamento, ano_aquisicao, observacoes, ativo,
    };

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
    await pool.query(`UPDATE notebooks SET ${colunas.join(', ')} WHERE id = ?`, valores);

    res.json({ success: true, message: 'Notebook atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar notebook:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// DELETE /api/notebooks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se está emprestado
    const [emprestimos] = await pool.query(
      'SELECT id FROM emprestimos WHERE notebook_id = ? AND data_devolucao IS NULL',
      [id]
    );
    if (emprestimos.length > 0) {
      return res.status(409).json({ success: false, message: 'Não é possível excluir: notebook está emprestado.' });
    }

    const [existente] = await pool.query('SELECT id FROM notebooks WHERE id = ?', [id]);
    if (existente.length === 0) {
      return res.status(404).json({ success: false, message: 'Notebook não encontrado.' });
    }

    await pool.query('DELETE FROM notebooks WHERE id = ?', [id]);

    res.json({ success: true, message: 'Notebook excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir notebook:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;