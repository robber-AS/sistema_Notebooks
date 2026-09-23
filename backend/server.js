require('dotenv').config();

const express = require('express');
const cors = require('cors');

const pool = require('./config/db');
const { authenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const notebookRoutes = require('./routes/notebooks');
const teacherRoutes = require('./routes/teachers');
const loanRoutes = require('./routes/loans');
const returnRoutes = require('./routes/returns');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ============================================================
// TESTE DE CONEXÃO
// GET /api/test
// ============================================================
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    const [tabelas] = await pool.query(
      `SELECT TABLE_NAME AS tabela, TABLE_ROWS AS registros
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN
         ('usuarios','professores','notebooks','emprestimos','devolucoes','manutencoes')
       ORDER BY TABLE_NAME`,
      [process.env.DB_NAME || 'sistema_notebooks']
    );
    res.json({
      status: 'ok',
      mensagem: 'Conexão com o banco de dados MySQL realizada com sucesso!',
      banco: process.env.DB_NAME || 'sistema_notebooks',
      php_version: null,
      node_version: process.version,
      tabelas,
    });
  } catch (error) {
    res.status(500).json({ status: 'erro', mensagem: 'Falha na conexão: ' + error.message });
  }
});

// ============================================================
// ROTAS - AUTH (login público)
// ============================================================
app.use('/api/auth', authRoutes);

// ============================================================
// ROTAS PROTEGIDAS (exigem token JWT)
// ============================================================
app.use('/api/notebooks', authenticate, notebookRoutes);
app.use('/api/teachers', authenticate, teacherRoutes);
app.use('/api/loans', authenticate, loanRoutes);
app.use('/api/returns', authenticate, returnRoutes);
app.use('/api/reports', authenticate, reportRoutes);

// ============================================================
// ROTA 404
// ============================================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada.' });
});

// ============================================================
// INFORMAÇÃO DE INICIALIZAÇÃO
// ============================================================
app.listen(PORT, () => {
  console.log('==============================================');
  console.log('SISTEMA DE EMPRÉSTIMO DE NOTEBOOKS - BACKEND');
  console.log('==============================================');
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
  console.log(`Teste de conexão:    http://localhost:${PORT}/api/test`);
  console.log(`Frontend:            abra home.html no navegador`);
  console.log('==============================================');
});