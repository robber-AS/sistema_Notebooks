const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// POST /api/auth/login  { usuario, senha }
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body || {};

  if (!usuario || !senha) {
    return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, nome, usuario, senha, email, ativo FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
    }

    const user = rows[0];

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
    }

    if (!user.ativo) {
      return res.status(403).json({ success: false, message: 'Usuário desativado. Contate o administrador.' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, nome: user.nome },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );

    const { senha: _, ...dadosUsuario } = user;

    res.json({ success: true, message: 'Login realizado com sucesso', token, data: dadosUsuario });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// POST /api/auth/register  { nome, usuario, senha, email }
router.post('/register', async (req, res) => {
  const { nome, usuario, senha, email } = req.body || {};

  if (!nome || !usuario || !senha) {
    return res.status(400).json({ success: false, message: 'Nome, usuário e senha são obrigatórios.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM usuarios WHERE usuario = ? OR (email IS NOT NULL AND email = ?) LIMIT 1',
      [usuario, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Usuário ou email já cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const [result] = await pool.query(
      'INSERT INTO usuarios (nome, usuario, senha, email) VALUES (?, ?, ?, ?)',
      [nome, usuario, senhaHash, email || null]
    );

    const token = jwt.sign(
      { id: result.insertId, usuario, nome },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      token,
      data: { id: result.insertId, nome, usuario, email }
    });
  } catch (error) {
    console.error('Erro no cadastro:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// GET /api/auth/me  - dados do usuário logado (token)
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, usuario, email FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

module.exports = router;