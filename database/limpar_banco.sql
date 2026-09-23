-- ============================================================
-- LIMPAR BANCO - Manter apenas Charles D Bronx (ID 7)
-- ATENÇÃO: Execute com cuidado! Remove dados permanentemente.
-- ============================================================

USE sistema_notebooks;

-- 1. Deletar devoluções de outros professores
DELETE FROM devolucoes
WHERE professor_id != 7;

-- 2. Deletar empréstimos de outros professores
DELETE FROM emprestimos
WHERE professor_id != 7;

-- 3. Deletar outros professores
DELETE FROM professores
WHERE id != 7;

-- Verificar resultado
SELECT 'Professores restantes:' AS info;
SELECT id, nome, matricula FROM professores;

SELECT 'Empréstimos restantes:' AS info;
SELECT id, professor_id, notebook_id, data_saida FROM emprestimos;

SELECT 'Devoluções restantes:' AS info;
SELECT id, emprestimo_id, professor_id FROM devolucoes;