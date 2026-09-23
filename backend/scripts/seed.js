require('dotenv').config();

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ============================================================
// SCRIPT DE SETUP DO BANCO
// Uso: npm run seed
// Cria o banco, as tabelas e os dados de exemplo
// ============================================================

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'sistema_notebooks';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';

async function main() {
  console.log('==============================================');
  console.log('SISTEMA DE EMPRÉSTIMO DE NOTEBOOKS - SETUP');
  console.log('==============================================\n');

  // 1. Conecta sem database para poder criá-lo
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    multipleStatements: true,
  });

  console.log(`Conectado ao MySQL em ${DB_HOST}:${DB_PORT}`);
  console.log(`Criando banco de dados '${DB_NAME}'...`);

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
                    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB_NAME}\``);

  // 2. Tabela de usuários
  console.log('Criando tabela: usuarios...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      usuario VARCHAR(50) NOT NULL UNIQUE,
      senha VARCHAR(255) NOT NULL,
      email VARCHAR(150) UNIQUE,
      ativo TINYINT(1) DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  // 3. Tabela de professores
  console.log('Criando tabela: professores...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS professores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      matricula VARCHAR(30) NOT NULL UNIQUE,
      disciplina VARCHAR(100) NOT NULL,
      telefone VARCHAR(20) NOT NULL,
      email VARCHAR(150) UNIQUE,
      ativo TINYINT(1) DEFAULT 1,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_professores_telefone (telefone),
      INDEX idx_professores_disciplina (disciplina)
    ) ENGINE=InnoDB
  `);

  // 4. Tabela de notebooks
  console.log('Criando tabela: notebooks...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      marca VARCHAR(50) NOT NULL,
      modelo VARCHAR(100) NOT NULL,
      patrimonio VARCHAR(30) NOT NULL UNIQUE,
      estado ENUM('Bom', 'Regular', 'Ruim', 'Em Manutenção', 'Baixado') NOT NULL DEFAULT 'Bom',
      numero_serie VARCHAR(50) UNIQUE,
      processador VARCHAR(50),
      memoria_ram VARCHAR(20),
      armazenamento VARCHAR(20),
      ano_aquisicao YEAR,
      observacoes TEXT,
      ativo TINYINT(1) DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_notebooks_marca (marca),
      INDEX idx_notebooks_estado (estado)
    ) ENGINE=InnoDB
  `);

  // 5. Tabela de empréstimos (status calculado, não coluna gerada)
  console.log('Criando tabela: emprestimos...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS emprestimos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notebook_id INT NOT NULL,
      professor_id INT NOT NULL,
      data_saida DATE NOT NULL,
      data_prevista_devolucao DATE NOT NULL,
      data_devolucao DATE NULL,
      condicao_devolucao ENUM('Bom', 'Regular', 'Danificado', 'Manutenção Necessária') NULL,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_emprestimo_notebook
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_emprestimo_professor
        FOREIGN KEY (professor_id) REFERENCES professores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      INDEX idx_emprestimos_datas (data_saida, data_prevista_devolucao),
      INDEX idx_emprestimos_professor (professor_id),
      INDEX idx_emprestimos_notebook (notebook_id)
    ) ENGINE=InnoDB
  `);

  // 6. Tabela de devoluções
  console.log('Criando tabela: devolucoes...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS devolucoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emprestimo_id INT NOT NULL,
      notebook_id INT NOT NULL,
      professor_id INT NOT NULL,
      data_devolucao DATE NOT NULL,
      condicao ENUM('Bom', 'Regular', 'Danificado', 'Manutenção Necessária') NOT NULL,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_devolucao_emprestimo
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_devolucao_notebook
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_devolucao_professor
        FOREIGN KEY (professor_id) REFERENCES professores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      INDEX idx_devolucoes_data (data_devolucao),
      INDEX idx_devolucoes_condicao (condicao)
    ) ENGINE=InnoDB
  `);

  // 7. Tabela de manutenções
  console.log('Criando tabela: manutencoes...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS manutencoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notebook_id INT NOT NULL,
      data_inicio DATE NOT NULL,
      data_fim DATE NULL,
      tipo ENUM('Preventiva', 'Corretiva', 'Atualização') NOT NULL,
      descricao TEXT NOT NULL,
      custo DECIMAL(10,2) DEFAULT 0.00,
      tecnico VARCHAR(100),
      CONSTRAINT fk_manutencao_notebook
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);

  // 8. Usuário admin (senha com bcrypt)
  console.log('Verificando usuário admin...');
  const [[adminExistente]] = await conn.query(
    `SELECT id FROM usuarios WHERE usuario = 'admin' OR email = 'admin@escola.edu.br'`
  );

  if (!adminExistente) {
    const senhaHash = await bcrypt.hash('admin123', 10);
    await conn.query(
      `INSERT INTO usuarios (nome, usuario, senha, email) VALUES ('Administrador do Sistema', 'admin', ?, 'admin@escola.edu.br')`,
      [senhaHash]
    );
    console.log('  -> Usuário admin criado (senha: admin123)');
  } else {
    console.log('  -> Usuário admin já existe, mantido');
  }

  // 9. Dados de exemplo - professores
  console.log('Verificando dados de exemplo...');
  const [[countProfessores]] = await conn.query(`SELECT COUNT(*) AS total FROM professores`);
  if (!countProfessores.total) {
    console.log('Inserindo professores de exemplo...');
    await conn.query(`
      INSERT INTO professores (nome, matricula, disciplina, telefone, email) VALUES
      ('Maria Silva', 'PROF001', 'Matemática', '(11) 99999-1234', 'maria.silva@escola.edu.br'),
      ('João Santos', 'PROF002', 'Português', '(11) 99999-5678', 'joao.santos@escola.edu.br'),
      ('Ana Oliveira', 'PROF003', 'Administração', '(11) 98888-9123', 'ana.oliveira@escola.edu.br'),
      ('Carlos Pereira', 'PROF004', 'Informática', '(11) 97777-4567', 'carlos.pereira@escola.edu.br'),
      ('Fernanda Costa', 'PROF005', 'Inglês', '(11) 96666-7890', 'fernanda.costa@escola.edu.br')
    `);
  }

  // 10. Dados de exemplo - notebooks
  const [[countNotebooks]] = await conn.query(`SELECT COUNT(*) AS total FROM notebooks`);
  if (!countNotebooks.total) {
    console.log('Inserindo notebooks de exemplo...');
    await conn.query(`
      INSERT INTO notebooks (marca, modelo, patrimonio, estado, numero_serie, processador, memoria_ram, armazenamento, ano_aquisicao) VALUES
      ('Dell', 'Inspiron 15 3000', 'NB001', 'Bom', 'DL-INSP-001', 'Intel Core i5', '8GB', '256GB SSD', 2023),
      ('Dell', 'Inspiron 15 3000', 'NB002', 'Bom', 'DL-INSP-002', 'Intel Core i5', '8GB', '256GB SSD', 2023),
      ('HP', 'ProBook 450 G8', 'NB003', 'Regular', 'HP-PROB-003', 'Intel Core i5', '8GB', '512GB SSD', 2022),
      ('Lenovo', 'ThinkPad E14', 'NB004', 'Bom', 'LE-TP-004', 'AMD Ryzen 5', '16GB', '512GB SSD', 2024),
      ('Acer', 'Aspire 5', 'NB005', 'Em Manutenção', 'AC-ASP-005', 'Intel Core i3', '4GB', '128GB SSD', 2021),
      ('Dell', 'Latitude 5420', 'NB006', 'Bom', 'DL-LAT-006', 'Intel Core i7', '16GB', '512GB SSD', 2023),
      ('Samsung', 'Galaxy Book', 'NB007', 'Regular', 'SM-GB-007', 'Intel Core i5', '8GB', '256GB SSD', 2022),
      ('Positivo', 'Motion Q464C', 'NB008', 'Bom', 'PO-MOT-008', 'Intel Celeron', '4GB', '128GB SSD', 2024)
    `);
  }

  console.log('\n==============================================');
  console.log('SETUP CONCLUÍDO COM SUCESSO!');
  console.log('Inicie o servidor com: npm start');
  console.log('Acesse: http://localhost:3000/api/test');
  console.log('==============================================\n');

  await conn.end();
}

main().catch((error) => {
  console.error('\nERRO NO SETUP:', error.message);
  console.error('Verifique se o MySQL está ativo e as credenciais em backend/.env');
  process.exit(1);
});