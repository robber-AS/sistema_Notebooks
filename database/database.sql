-- ============================================================
-- BANCO DE DADOS: Sistema de Empréstimo de Notebooks
-- Turma: Técnico em Administração
-- SGBD: MySQL 8.0+
-- ============================================================

-- 1. CRIAR O BANCO DE DADOS
-- ============================================================
CREATE DATABASE IF NOT EXISTS sistema_notebooks
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sistema_notebooks;

-- ============================================================
-- 2. TABELA: USUÁRIOS (acesso administrativo)
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(150) UNIQUE,
    ativo TINYINT(1) DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 3. TABELA: PROFESSORES
-- ============================================================

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
) ENGINE=InnoDB;

-- ============================================================
-- 4. TABELA: NOTEBOOKS
-- ============================================================

CREATE TABLE IF NOT EXISTS notebooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    patrimonio VARCHAR(30) NOT NULL UNIQUE,
    -- Estados: Bom, Regular, Ruim, Em_Manutencao, Baixado
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
) ENGINE=InnoDB;

-- ============================================================
-- 5. TABELA: EMPRÉSTIMOS
-- ============================================================

CREATE TABLE IF NOT EXISTS emprestimos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notebook_id INT NOT NULL,
    professor_id INT NOT NULL,
    data_saida DATE NOT NULL,
    data_prevista_devolucao DATE NOT NULL,
    data_devolucao DATE NULL,
    -- Condição na devolução: Bom, Regular, Danificado, Manutencao_Necessaria
    condicao_devolucao ENUM('Bom', 'Regular', 'Danificado', 'Manutenção Necessária') NULL,
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_emprestimo_notebook
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    
    CONSTRAINT fk_emprestimo_professor
        FOREIGN KEY (professor_id) REFERENCES professores(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    
    INDEX idx_emprestimos_datas (data_saida, data_prevista_devolucao),
    INDEX idx_emprestimos_professor (professor_id),
    INDEX idx_emprestimos_notebook (notebook_id),
    INDEX idx_emprestimos_status (data_devolucao)
) ENGINE=InnoDB;

-- OBS: O campo status não é uma coluna gerada (MySQL não permite
-- CURDATE() em colunas geradas). O status é calculado nas views
-- (Pendente / Atrasado / Devolvido).

-- ============================================================
-- 6. TABELA: DEVOLUÇÕES (registro histórico de cada devolução)
-- ============================================================

CREATE TABLE IF NOT EXISTS devolucoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emprestimo_id INT NOT NULL,
    notebook_id INT NOT NULL,
    professor_id INT NOT NULL,
    data_devolucao DATE NOT NULL,
    condicao ENUM('Bom', 'Regular', 'Danificado', 'Manutenção Necessária') NOT NULL,
    -- Campo OBSERVAÇÕES exigido pela tela de devoluções
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alterado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_devolucao_emprestimo
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    CONSTRAINT fk_devolucao_notebook
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    
    CONSTRAINT fk_devolucao_professor
        FOREIGN KEY (professor_id) REFERENCES professores(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    
    INDEX idx_devolucoes_data (data_devolucao),
    INDEX idx_devolucoes_condicao (condicao),
    INDEX idx_devolucoes_emprestimo (emprestimo_id)
) ENGINE=InnoDB;

-- ============================================================
-- 7. TABELA: HISTÓRICO DE MANUTENÇÃO
-- ============================================================

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
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    INDEX idx_manutencoes_data (data_inicio),
    INDEX idx_manutencoes_notebook (notebook_id)
) ENGINE=InnoDB;

-- ============================================================
-- 8. TRIGGER: ATUALIZAR ESTADO DO NOTEBOOK NA DEVOLUÇÃO
-- Se devolvido danificado -> estado Ruim
-- Se devolvido com manutenção necessária -> Em Manutenção
-- ============================================================

DELIMITER //

CREATE TRIGGER trg_devolucao_atualiza_notebook
AFTER INSERT ON devolucoes
FOR EACH ROW
BEGIN
    IF NEW.condicao = 'Danificado' THEN
        UPDATE notebooks SET estado = 'Ruim' WHERE id = NEW.notebook_id;
    ELSEIF NEW.condicao = 'Manutenção Necessária' THEN
        UPDATE notebooks SET estado = 'Em Manutenção' WHERE id = NEW.notebook_id;
    END IF;
END//

-- Trigger: impedir empréstimo de notebook indisponível
CREATE TRIGGER trg_emprestimo_notebook_disponivel
BEFORE INSERT ON emprestimos
FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_emprestado INT;
    
    SELECT estado INTO v_estado FROM notebooks WHERE id = NEW.notebook_id;
    SELECT COUNT(*) INTO v_emprestado
    FROM emprestimos
    WHERE notebook_id = NEW.notebook_id AND data_devolucao IS NULL;
    
    IF v_estado IN ('Em Manutenção', 'Baixado', 'Ruim') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Notebook não está disponível para empréstimo.';
    END IF;
    
    IF v_emprestado > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Notebook já está emprestado.';
    END IF;
END//

-- Trigger: impedir duplicidade de devolução
CREATE TRIGGER trg_devolucao_nao_duplicada
BEFORE INSERT ON devolucoes
FOR EACH ROW
BEGIN
    DECLARE v_ja_devolvido INT;
    DECLARE v_emprestimo_existe INT;
    
    SELECT COUNT(*) INTO v_ja_devolvido
    FROM devolucoes WHERE emprestimo_id = NEW.emprestimo_id;
    
    SELECT COUNT(*) INTO v_emprestimo_existe
    FROM emprestimos WHERE id = NEW.emprestimo_id;
    
    IF v_ja_devolvido > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Este empréstimo já foi devolvido.';
    END IF;
    
    IF v_emprestimo_existe = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Empréstimo não encontrado.';
    END IF;
END//

DELIMITER ;

-- ============================================================
-- 9. VIEWS PARA RELATÓRIOS
-- ============================================================

-- View: Resumo do dashboard
CREATE OR REPLACE VIEW vw_dashboard_resumo AS
SELECT
    (SELECT COUNT(*) FROM notebooks WHERE ativo = 1) AS total_notebooks,
    (SELECT COUNT(*) FROM professores WHERE ativo = 1) AS total_professores,
    (
        SELECT COUNT(*) FROM notebooks n
        WHERE n.ativo = 1
          AND n.estado NOT IN ('Em Manutenção', 'Baixado', 'Ruim')
          AND n.id NOT IN (
              SELECT notebook_id FROM emprestimos WHERE data_devolucao IS NULL
          )
    ) AS notebooks_disponiveis,
    (SELECT COUNT(*) FROM emprestimos WHERE data_devolucao IS NULL) AS notebooks_emprestados;

-- View: Empréstimos com detalhes
CREATE OR REPLACE VIEW vw_emprestimos_detalhes AS
SELECT
    e.id AS emprestimo_id,
    e.data_saida,
    e.data_prevista_devolucao,
    e.data_devolucao,
    e.condicao_devolucao,
    e.observacoes,
    CASE
        WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
        WHEN e.data_prevista_devolucao < CURDATE() THEN 'Atrasado'
        ELSE 'Pendente'
    END AS status,
    n.id AS notebook_id,
    CONCAT(n.marca, ' ', n.modelo) AS notebook,
    n.patrimonio,
    n.estado AS estado_notebook,
    p.id AS professor_id,
    p.nome AS professor,
    p.matricula,
    p.disciplina,
    DATEDIFF(COALESCE(e.data_devolucao, CURDATE()), e.data_saida) AS dias_duracao
FROM emprestimos e
INNER JOIN notebooks n ON n.id = e.notebook_id
INNER JOIN professores p ON p.id = e.professor_id;

-- View: Devoluções com detalhes
CREATE OR REPLACE VIEW vw_devolucoes_detalhes AS
SELECT
    d.id AS devolucao_id,
    d.data_devolucao,
    d.condicao,
    d.observacoes,
    e.id AS emprestimo_id,
    e.data_saida,
    e.data_prevista_devolucao,
    n.id AS notebook_id,
    CONCAT(n.marca, ' ', n.modelo) AS notebook,
    n.patrimonio,
    p.id AS professor_id,
    p.nome AS professor
FROM devolucoes d
INNER JOIN emprestimos e ON e.id = d.emprestimo_id
INNER JOIN notebooks n ON n.id = d.notebook_id
INNER JOIN professores p ON p.id = d.professor_id;

-- View: Empréstimos atrasados
CREATE OR REPLACE VIEW vw_emprestimos_atrasados AS
SELECT
    e.id AS emprestimo_id,
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
  AND e.data_prevista_devolucao < CURDATE();

-- View: Ranking de professores por empréstimos
CREATE OR REPLACE VIEW vw_ranking_professores AS
SELECT
    p.id AS professor_id,
    p.nome AS professor,
    COUNT(e.id) AS total_emprestimos
FROM professores p
LEFT JOIN emprestimos e ON e.professor_id = p.id
GROUP BY p.id, p.nome
ORDER BY total_emprestimos DESC;

-- View: Uso mensal de empréstimos
CREATE OR REPLACE VIEW vw_atividade_mensal AS
SELECT
    DATE_FORMAT(data_saida, '%m/%Y') AS mes_ano,
    YEAR(data_saida) AS ano,
    MONTH(data_saida) AS mes,
    COUNT(*) AS total_emprestimos
FROM emprestimos
GROUP BY YEAR(data_saida), MONTH(data_saida), DATE_FORMAT(data_saida, '%m/%Y')
ORDER BY ano DESC, mes DESC;

-- View: Condição dos notebooks nas devoluções
CREATE OR REPLACE VIEW vw_condicao_devolucoes AS
SELECT condicao, COUNT(*) AS total
FROM devolucoes
GROUP BY condicao;

-- View: Notebooks mais utilizados
CREATE OR REPLACE VIEW vw_notebooks_mais_utilizados AS
SELECT
    n.id AS notebook_id,
    CONCAT(n.marca, ' ', n.modelo) AS notebook,
    n.patrimonio,
    COUNT(e.id) AS total_emprestimos
FROM notebooks n
LEFT JOIN emprestimos e ON e.notebook_id = n.id
GROUP BY n.id, n.marca, n.modelo, n.patrimonio
ORDER BY total_emprestimos DESC;

-- ============================================================
-- 10. DADOS DE EXEMPLO (SEED)
-- ============================================================

-- Usuário administrador
-- Senha: admin123 (hash MD5 para simplicidade; em produção use bcrypt)
INSERT INTO usuarios (nome, usuario, senha, email) VALUES
('Administrador do Sistema', 'admin', MD5('admin123'), 'admin@escola.edu.br');

-- Professores
INSERT INTO professores (nome, matricula, disciplina, telefone, email) VALUES
('Maria Silva', 'PROF001', 'Matemática', '(11) 99999-1234', 'maria.silva@escola.edu.br'),
('João Santos', 'PROF002', 'Português', '(11) 99999-5678', 'joao.santos@escola.edu.br'),
('Ana Oliveira', 'PROF003', 'Administração', '(11) 98888-9123', 'ana.oliveira@escola.edu.br'),
('Carlos Pereira', 'PROF004', 'Informática', '(11) 97777-4567', 'carlos.pereira@escola.edu.br'),
('Fernanda Costa', 'PROF005', 'Inglês', '(11) 96666-7890', 'fernanda.costa@escola.edu.br');

-- Notebooks
INSERT INTO notebooks (marca, modelo, patrimonio, estado, numero_serie, processador, memoria_ram, armazenamento, ano_aquisicao) VALUES
('Dell', 'Inspiron 15 3000', 'NB001', 'Bom', 'DL-INSP-001', 'Intel Core i5', '8GB', '256GB SSD', 2023),
('Dell', 'Inspiron 15 3000', 'NB002', 'Bom', 'DL-INSP-002', 'Intel Core i5', '8GB', '256GB SSD', 2023),
('HP', 'ProBook 450 G8', 'NB003', 'Regular', 'HP-PROB-003', 'Intel Core i5', '8GB', '512GB SSD', 2022),
('Lenovo', 'ThinkPad E14', 'NB004', 'Bom', 'LE-TP-004', 'AMD Ryzen 5', '16GB', '512GB SSD', 2024),
('Acer', 'Aspire 5', 'NB005', 'Em Manutenção', 'AC-ASP-005', 'Intel Core i3', '4GB', '128GB SSD', 2021),
('Dell', 'Latitude 5420', 'NB006', 'Bom', 'DL-LAT-006', 'Intel Core i7', '16GB', '512GB SSD', 2023),
('Samsung', 'Galaxy Book', 'NB007', 'Regular', 'SM-GB-007', 'Intel Core i5', '8GB', '256GB SSD', 2022),
('Positivo', 'Motion Q464C', 'NB008', 'Bom', 'PO-MOT-008', 'Intel Celeron', '4GB', '128GB SSD', 2024);

-- Empréstimos (exemplos)
INSERT INTO emprestimos (notebook_id, professor_id, data_saida, data_prevista_devolucao, data_devolucao) VALUES
(1, 1, '2026-08-10', '2026-08-14', '2026-08-14'),
(2, 2, '2026-08-12', '2026-08-20', '2026-08-19'),
(3, 3, '2026-08-15', '2026-08-22', NULL),
(4, 4, '2026-08-18', '2026-08-25', NULL),
(6, 5, '2026-08-05', '2026-08-08', '2026-08-07');

-- Devoluções (exemplos)
INSERT INTO devolucoes (emprestimo_id, notebook_id, professor_id, data_devolucao, condicao, observacoes) VALUES
(1, 1, 1, '2026-08-14', 'Bom', 'Notebook devolvido em perfeito estado, carregador e mochila inclusos.'),
(2, 2, 2, '2026-08-19', 'Regular', 'Teclado com algumas teclas desgastadas pelo uso, funcionando normalmente.'),
(5, 6, 5, '2026-08-07', 'Danificado', 'Tela apresentou rachadura na borda inferior. Necessário avaliação técnica.');

-- Manutenções (exemplos)
INSERT INTO manutencoes (notebook_id, data_inicio, data_fim, tipo, descricao, custo, tecnico) VALUES
(5, '2026-08-01', '2026-08-10', 'Corretiva', 'Substituição da tela e limpeza interna', 350.00, 'Técnico João'),
(2, '2026-08-25', NULL, 'Preventiva', 'Limpeza preventiva do sistema e atualização de drivers', 0.00, 'Técnico João');

-- ============================================================
-- 11. CONSULTAS ÚTEIS PARA O SISTEMA
-- ============================================================

-- Verificar empréstimos ativos
-- SELECT * FROM vw_emprestimos_detalhes WHERE data_devolucao IS NULL;

-- Verificar empréstimos atrasados
-- SELECT * FROM vw_emprestimos_atrasados;

-- Buscar notebook por patrimônio
-- SELECT * FROM notebooks WHERE patrimonio = 'NB001';

-- Ver dashboard
-- SELECT * FROM vw_dashboard_resumo;

-- Ver ranking de professores
-- SELECT * FROM vw_ranking_professores;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================