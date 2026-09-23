// ============================================================
// LÓGICA DO SISTEMA - Versão MySQL (via PHP API)
// ============================================================

// Estado em memória (sincronizado com o MySQL)
const store = {
    notebooks: [],
    teachers: [],
    loans: [],
    returns: [],
    dashboard: null,
};

// Estado de busca/filtro
let currentSearchTerm = '';
let currentFilterStatus = 'all';
let currentReturnSearchTerm = '';
let currentReturnFilterCondition = 'all';
let currentDeleteCallback = null;

// Elementos DOM
const elements = {
    sections: document.querySelectorAll('.content-section'),
    navItems: document.querySelectorAll('.nav-item'),
    pageTitle: document.getElementById('pageTitle'),
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.querySelector('.sidebar'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Dashboard
    totalNotebooks: document.getElementById('totalNotebooks'),
    totalTeachers: document.getElementById('totalTeachers'),
    availableNotebooks: document.getElementById('availableNotebooks'),
    loanedNotebooks: document.getElementById('loanedNotebooks'),
    recentLoansList: document.getElementById('recentLoansList'),

    // Tabelas
    notebooksTableBody: document.getElementById('notebooksTableBody'),
    teachersTableBody: document.getElementById('teachersTableBody'),
    loansTableBody: document.getElementById('loansTableBody'),
    returnsTableBody: document.getElementById('returnsTableBody'),
    noNotebooksMsg: document.getElementById('noNotebooksMsg'),
    noTeachersMsg: document.getElementById('noTeachersMsg'),
    noLoansMsg: document.getElementById('noLoansMsg'),
    noReturnsMsg: document.getElementById('noReturnsMsg'),

    // Relatórios
    notebookStateReport: document.getElementById('notebookStateReport'),
    loansByTeacherReport: document.getElementById('loansByTeacherReport'),
    overdueLoansReport: document.getElementById('overdueLoansReport'),
    monthlyActivityReport: document.getElementById('monthlyActivityReport'),
    fullLoansReportBody: document.getElementById('fullLoansReportBody'),
    noReportMsg: document.getElementById('noReportMsg'),
    returnConditionsReportBody: document.getElementById('returnConditionsReportBody'),
    noReturnConditionsMsg: document.getElementById('noReturnConditionsMsg'),

    // Botões
    addNotebookBtn: document.getElementById('addNotebookBtn'),
    addTeacherBtn: document.getElementById('addTeacherBtn'),
    newLoanBtn: document.getElementById('newLoanBtn'),
    newReturnBtn: document.getElementById('newReturnBtn'),
    exportReportBtn: document.getElementById('exportReportBtn'),

    // Modais
    notebookModal: document.getElementById('notebookModal'),
    teacherModal: document.getElementById('teacherModal'),
    loanModal: document.getElementById('loanModal'),
    returnModal: document.getElementById('returnModal'),
    selectLoanModal: document.getElementById('selectLoanModal'),
    viewReturnModal: document.getElementById('viewReturnModal'),
    confirmModal: document.getElementById('confirmModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

    // Formulários
    notebookForm: document.getElementById('notebookForm'),
    teacherForm: document.getElementById('teacherForm'),
    loanForm: document.getElementById('loanForm'),
    returnForm: document.getElementById('returnForm'),
    confirmMessage: document.getElementById('confirmMessage'),
};

// ============================================================
// FUNÇÕES DE FORMATO
// ============================================================

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR');
}

function getStatus(loan) {
    if (loan.data_devolucao) return 'returned';
    if (new Date(loan.data_prevista_devolucao) < new Date()) return 'overdue';
    return 'pending';
}

function getStatusLabel(status) {
    const labels = { returned: 'Devolvido', pending: 'Pendente', overdue: 'Atrasado' };
    return labels[status] || status;
}

function getStateClass(state) {
    const classes = {
        'Bom': 'good',
        'Regular': 'regular',
        'Ruim': 'bad',
        'Em Manutenção': 'maintenance',
    };
    return classes[state] || 'regular';
}

function getConditionClass(condition) {
    const classes = {
        'Bom': 'bom',
        'Regular': 'regular',
        'Danificado': 'danificado',
        'Manutenção Necessária': 'manutenção-necessária',
    };
    return classes[condition] || 'regular';
}

function truncateText(text, maxLength = 30) {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function navigateTo(section) {
    elements.sections.forEach(s => s.classList.remove('active'));
    elements.navItems.forEach(n => n.classList.remove('active'));

    document.getElementById(`${section}-section`).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        notebooks: 'Gerenciar Notebooks',
        teachers: 'Gerenciar Professores',
        loans: 'Gerenciar Empréstimos',
        returns: 'Devoluções',
        reports: 'Relatórios',
    };
    elements.pageTitle.textContent = titles[section];

    refreshAll();
}

// ============================================================
// CARREGAMENTO DE DADOS
// ============================================================

async function loadAllData() {
    try {
        const [notebooks, teachers, loans, returns, dashboard] = await Promise.all([
            API.getNotebooks(),
            API.getTeachers(),
            API.getLoans(),
            API.getReturns(),
            API.getDashboard(),
        ]);

        store.notebooks = notebooks.data;
        store.teachers = teachers.data;
        store.loans = loans.data;
        store.returns = returns.data;
        store.dashboard = dashboard.data;

        renderAll();
    } catch (error) {
        showError('Erro ao carregar dados: ' + error.message);
    }
}

async function refreshAll() {
    try {
        const [notebooks, teachers, loans, returns, dashboard] = await Promise.all([
            API.getNotebooks(),
            API.getTeachers(),
            API.getLoans(),
            API.getReturns(),
            API.getDashboard(),
        ]);

        store.notebooks = notebooks.data;
        store.teachers = teachers.data;
        store.loans = loans.data;
        store.returns = returns.data;
        store.dashboard = dashboard.data;

        renderAll();
    } catch (error) {
        showError('Erro ao atualizar dados: ' + error.message);
    }
}

function renderAll() {
    renderDashboard();
    renderNotebooks();
    renderTeachers();
    renderLoans();
    renderReturns();
    renderReports();
}

// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {
    const res = store.dashboard;

    elements.totalNotebooks.textContent = res ? res.total_notebooks : 0;
    elements.totalTeachers.textContent = res ? res.total_professores : 0;
    elements.availableNotebooks.textContent = res ? res.notebooks_disponiveis : 0;
    elements.loanedNotebooks.textContent = res ? res.notebooks_emprestados : 0;

    // Empréstimos recentes
    const recentes = store.dashboard && store.dashboard.recentes ? store.dashboard.recentes : [];

    if (recentes.length === 0) {
        elements.recentLoansList.innerHTML = '<p class="empty-state">Nenhum empréstimo registrado</p>';
    } else {
        elements.recentLoansList.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Notebook</th>
                        <th>Professor</th>
                        <th>Data Saída</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentes.map(loan => `
                        <tr>
                            <td>${loan.notebook_nome || 'N/A'}</td>
                            <td>${loan.professor_nome || 'N/A'}</td>
                            <td>${formatDate(loan.data_saida)}</td>
                            <td><span class="badge badge-small badge-${loan.status === 'Devolvido' ? 'returned' : loan.status === 'Atrasado' ? 'overdue' : 'pending'}">${loan.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// ============================================================
// NOTEBOOKS
// ============================================================

function renderNotebooks() {
    const notebooks = store.notebooks;

    if (notebooks.length === 0) {
        elements.noNotebooksMsg.style.display = 'block';
        elements.notebooksTableBody.innerHTML = '';
        return;
    }

    elements.noNotebooksMsg.style.display = 'none';

    elements.notebooksTableBody.innerHTML = notebooks.map(notebook => {
        const isLoaned = (notebook.emprestado > 0);

        return `
            <tr>
                <td>${notebook.id}</td>
                <td>${notebook.marca}</td>
                <td>${notebook.modelo}</td>
                <td>${notebook.patrimonio}</td>
                <td><span class="badge badge-${getStateClass(notebook.estado)}">${notebook.estado}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon edit" onclick="editNotebook(${notebook.id})" title="Editar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" onclick="confirmDeleteNotebook(${notebook.id})" title="Excluir" ${isLoaned ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function editNotebook(id) {
    const notebook = store.notebooks.find(n => n.id === id);
    if (!notebook) return;

    document.getElementById('notebookModalTitle').textContent = 'Editar Notebook';
    document.getElementById('notebookId').value = notebook.id;
    document.getElementById('notebookBrand').value = notebook.marca;
    document.getElementById('notebookModel').value = notebook.modelo;
    document.getElementById('notebookPatrimony').value = notebook.patrimonio;
    document.getElementById('notebookState').value = notebook.estado;
    document.getElementById('notebookObservations').value = notebook.observacoes || '';
    openModal(elements.notebookModal);
}

function confirmDeleteNotebook(id) {
    elements.confirmMessage.textContent = 'Tem certeza que deseja excluir este notebook?';
    currentDeleteCallback = async () => {
        try {
            await API.deleteNotebook(id);
            showSuccess('Notebook excluído com sucesso');
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    };
    openModal(elements.confirmModal);
}

// ============================================================
// PROFESSORES
// ============================================================

function renderTeachers() {
    const teachers = store.teachers;

    if (teachers.length === 0) {
        elements.noTeachersMsg.style.display = 'block';
        elements.teachersTableBody.innerHTML = '';
        return;
    }

    elements.noTeachersMsg.style.display = 'none';

    elements.teachersTableBody.innerHTML = teachers.map(teacher => {
        const hasLoans = teacher.total_emprestimos > 0;
        return `
            <tr>
                <td>${teacher.id}</td>
                <td>${teacher.nome}</td>
                <td>${teacher.matricula}</td>
                <td>${teacher.disciplina}</td>
                <td>${teacher.telefone}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon edit" onclick="editTeacher(${teacher.id})" title="Editar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" onclick="confirmDeleteTeacher(${teacher.id})" title="${hasLoans ? 'Possui empréstimos' : 'Excluir'}" ${hasLoans ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function editTeacher(id) {
    const teacher = store.teachers.find(t => t.id === id);
    if (!teacher) return;

    document.getElementById('teacherModalTitle').textContent = 'Editar Professor';
    document.getElementById('teacherId').value = teacher.id;
    document.getElementById('teacherName').value = teacher.nome;
    document.getElementById('teacherRegistration').value = teacher.matricula;
    document.getElementById('teacherSubject').value = teacher.disciplina;
    document.getElementById('teacherPhone').value = teacher.telefone;
    openModal(elements.teacherModal);
}

function confirmDeleteTeacher(id) {
    const teacher = store.teachers.find(t => t.id === id);
    if (teacher && teacher.total_emprestimos > 0) {
        showError(`Não é possível excluir "${teacher.nome}". Possui ${teacher.total_emprestimos} empréstimo(s). Finalize ou exclua os empréstimos antes.`);
        return;
    }
    elements.confirmMessage.textContent = 'Tem certeza que deseja excluir este professor?';
    currentDeleteCallback = async () => {
        try {
            await API.deleteTeacher(id);
            showSuccess('Professor excluído com sucesso');
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    };
    openModal(elements.confirmModal);
}

// ============================================================
// EMPRÉSTIMOS
// ============================================================

function renderLoans() {
    let loans = store.loans;

    // Filtro por texto
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        loans = loans.filter(loan =>
            (loan.notebook_nome || '').toLowerCase().includes(term) ||
            (loan.professor_nome || '').toLowerCase().includes(term) ||
            loan.id.toString().includes(term)
        );
    }

    // Filtro por status
    if (currentFilterStatus !== 'all') {
        loans = loans.filter(loan => getStatus(loan) === currentFilterStatus);
    }

    if (loans.length === 0) {
        elements.noLoansMsg.style.display = 'block';
        elements.loansTableBody.innerHTML = '';
        return;
    }

    elements.noLoansMsg.style.display = 'none';

    elements.loansTableBody.innerHTML = loans.map(loan => {
        const status = getStatus(loan);
        const canDelete = !loan.data_devolucao;

        return `
            <tr>
                <td>${loan.id}</td>
                <td>${loan.notebook_nome || 'N/A'}</td>
                <td>${loan.professor_nome || 'N/A'}</td>
                <td>${formatDate(loan.data_saida)}</td>
                <td>${formatDate(loan.data_prevista_devolucao)}</td>
                <td>${formatDate(loan.data_devolucao)}</td>
                <td><span class="badge badge-${status}">${getStatusLabel(status)}</span></td>
                <td>
                    <div class="table-actions">
                        ${!loan.data_devolucao ? `
                            <button class="btn-icon return" onclick="returnNotebook(${loan.id})" title="Devolver">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="1 4 1 10 7 10"></polyline>
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="btn-icon delete" onclick="confirmDeleteLoan(${loan.id})" title="Excluir" ${!canDelete ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function populateLoanSelects() {
    try {
        const available = await API.getNotebooks(true);
        const teachers = await API.getTeachers();

        const loanNotebook = document.getElementById('loanNotebook');
        const loanTeacher = document.getElementById('loanTeacher');

        loanNotebook.innerHTML = '<option value="">Selecione um notebook</option>' +
            available.data.map(n => `<option value="${n.id}">${n.marca} ${n.modelo} (${n.patrimonio})</option>`).join('');

        loanTeacher.innerHTML = '<option value="">Selecione um professor</option>' +
            teachers.data.filter(t => t.ativo == 1).map(t => `<option value="${t.id}">${t.nome}</option>`).join('');

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('loanDate').value = today;
        document.getElementById('loanDate').min = today;

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('returnDate').value = nextWeek.toISOString().split('T')[0];
        document.getElementById('returnDate').min = today;
    } catch (error) {
        showError('Erro ao carregar opções: ' + error.message);
    }
}

function returnNotebook(loanId) {
    const loan = store.loans.find(l => l.id === loanId);
    if (!loan) return;

    document.getElementById('returnLoanId').value = loan.id;
    document.getElementById('returnNotebookInfo').value = loan.notebook_nome || 'N/A';
    document.getElementById('returnTeacherInfo').value = loan.professor_nome || 'N/A';
    document.getElementById('returnLoanDateInfo').value = formatDate(loan.data_saida);
    document.getElementById('returnPlannedDate').value = formatDate(loan.data_prevista_devolucao);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('returnActualDate').value = today;
    document.getElementById('returnActualDate').max = today;

    document.getElementById('returnCondition').value = '';
    document.getElementById('returnObservations').value = '';

    openModal(elements.returnModal);
}

function populateReturnLoanSelect(term) {
    const activeLoans = store.loans.filter(l => !l.data_devolucao);
    const select = document.getElementById('returnLoanSelect');
    const countEl = document.getElementById('returnLoanSearchCount');

    const termLower = (term || '').toLowerCase().trim();
    const filtered = termLower
        ? activeLoans.filter(l =>
            (l.professor_nome || '').toLowerCase().includes(termLower) ||
            (l.notebook_nome || '').toLowerCase().includes(termLower) ||
            String(l.id).includes(termLower)
        )
        : activeLoans;

    select.innerHTML = '<option value="">Selecione o empréstimo...</option>' +
        filtered.map(l =>
            `<option value="${l.id}">${l.professor_nome} — ${l.notebook_nome} (ID ${l.id})</option>`
        ).join('');

    if (countEl) {
        countEl.textContent = filtered.length > 0
            ? `${filtered.length} empréstimo(s) encontrado(s)`
            : 'Nenhum empréstimo encontrado com esse termo.';
    }
}

function confirmDeleteLoan(id) {
    elements.confirmMessage.textContent = 'Tem certeza que deseja excluir este registro de empréstimo?';
    currentDeleteCallback = async () => {
        try {
            await API.deleteLoan(id);
            showSuccess('Empréstimo excluído com sucesso');
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    };
    openModal(elements.confirmModal);
}

// ============================================================
// DEVOLUÇÕES
// ============================================================

function renderReturns() {
    let returns = store.returns;

    // Filtro por texto
    if (currentReturnSearchTerm) {
        const term = currentReturnSearchTerm.toLowerCase();
        returns = returns.filter(ret =>
            (ret.notebook_nome || '').toLowerCase().includes(term) ||
            (ret.professor_nome || '').toLowerCase().includes(term) ||
            (ret.observacoes || '').toLowerCase().includes(term)
        );
    }

    // Filtro por condição
    if (currentReturnFilterCondition !== 'all') {
        returns = returns.filter(ret => ret.condicao === currentReturnFilterCondition);
    }

    if (returns.length === 0) {
        elements.noReturnsMsg.style.display = 'block';
        elements.returnsTableBody.innerHTML = '';
        return;
    }

    elements.noReturnsMsg.style.display = 'none';

    elements.returnsTableBody.innerHTML = returns.map(ret => `
        <tr>
            <td>${ret.id}</td>
            <td>${ret.notebook_nome || 'N/A'}</td>
            <td>${ret.professor_nome || 'N/A'}</td>
            <td>${formatDate(ret.data_devolucao)}</td>
            <td><span class="badge badge-${getConditionClass(ret.condicao)}">${ret.condicao}</span></td>
            <td title="${ret.observacoes || ''}">${truncateText(ret.observacoes)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" onclick="viewReturn(${ret.id})" title="Ver Detalhes">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon delete" onclick="confirmDeleteReturn(${ret.id})" title="Excluir">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewReturn(id) {
    const ret = store.returns.find(r => r.id === id);
    if (!ret) return;

    document.getElementById('viewReturnNotebook').textContent = ret.notebook_nome || 'N/A';
    document.getElementById('viewReturnTeacher').textContent = ret.professor_nome || 'N/A';
    document.getElementById('viewReturnLoanDate').textContent = formatDate(ret.data_saida);
    document.getElementById('viewReturnDate').textContent = formatDate(ret.data_devolucao);
    document.getElementById('viewReturnCondition').textContent = ret.condicao;
    document.getElementById('viewReturnObservations').textContent = ret.observacoes || 'Sem observações';

    openModal(elements.viewReturnModal);
}

function confirmDeleteReturn(id) {
    elements.confirmMessage.textContent = 'Tem certeza que deseja excluir este registro de devolução?';
    currentDeleteCallback = async () => {
        try {
            await API.deleteReturn(id);
            showSuccess('Registro de devolução excluído com sucesso');
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    };
    openModal(elements.confirmModal);
}

// ============================================================
// RELATÓRIOS
// ============================================================

function renderReports() {
    renderNotebookStateReport();
    renderLoansByTeacherReport();
    renderOverdueLoansReport();
    renderMonthlyActivityReport();
    renderFullLoansReport();
    renderReturnConditionsReport();
}

function renderNotebookStateReport() {
    const counts = {};
    store.notebooks.forEach(nb => {
        counts[nb.estado] = (counts[nb.estado] || 0) + 1;
    });

    elements.notebookStateReport.innerHTML = Object.entries(counts).map(([state, count]) => `
        <div class="report-stat-item">
            <span class="report-stat-label">${state}</span>
            <span class="report-stat-value">${count}</span>
        </div>
    `).join('') || '<p class="empty-state">Nenhum dado disponível</p>';
}

function renderLoansByTeacherReport() {
    const counts = {};
    store.loans.forEach(loan => {
        const name = loan.professor_nome;
        if (name) counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    elements.loansByTeacherReport.innerHTML = sorted.map(([name, count]) => `
        <div class="report-stat-item">
            <span class="report-stat-label">${name}</span>
            <span class="report-stat-value">${count}</span>
        </div>
    `).join('') || '<p class="empty-state">Nenhum dado disponível</p>';
}

function renderOverdueLoansReport() {
    const overdue = store.loans.filter(loan =>
        !loan.data_devolucao && new Date(loan.data_prevista_devolucao) < new Date()
    );

    if (overdue.length === 0) {
        elements.overdueLoansReport.innerHTML = '<p class="empty-state">Nenhum empréstimo atrasado</p>';
    } else {
        elements.overdueLoansReport.innerHTML = overdue.slice(0, 5).map(loan => {
            const days = Math.floor((new Date() - new Date(loan.data_prevista_devolucao)) / (1000 * 60 * 60 * 24));
            return `
                <div class="report-stat-item">
                    <span class="report-stat-label">${loan.notebook_nome || 'N/A'}</span>
                    <span class="report-stat-value" style="color: var(--danger);">${days} dias</span>
                </div>
            `;
        }).join('');
    }
}

function renderMonthlyActivityReport() {
    const counts = {};
    store.loans.forEach(loan => {
        const date = new Date(loan.data_saida);
        const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => {
        const [mA, yA] = a[0].split('/');
        const [mB, yB] = b[0].split('/');
        return yB - yA || mB - mA;
    });

    elements.monthlyActivityReport.innerHTML = sorted.slice(0, 5).map(([month, count]) => `
        <div class="report-stat-item">
            <span class="report-stat-label">${month}</span>
            <span class="report-stat-value">${count}</span>
        </div>
    `).join('') || '<p class="empty-state">Nenhum dado disponível</p>';
}

function renderFullLoansReport() {
    const loans = store.loans;

    if (loans.length === 0) {
        elements.noReportMsg.style.display = 'block';
        elements.fullLoansReportBody.innerHTML = '';
        return;
    }

    elements.noReportMsg.style.display = 'none';

    elements.fullLoansReportBody.innerHTML = loans.map(loan => {
        const status = getStatus(loan);
        const duration = loan.data_devolucao
            ? Math.ceil((new Date(loan.data_devolucao) - new Date(loan.data_saida)) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - new Date(loan.data_saida)) / (1000 * 60 * 60 * 24));

        return `
            <tr>
                <td>${loan.id}</td>
                <td>${loan.notebook_nome || 'N/A'}</td>
                <td>${loan.professor_nome || 'N/A'}</td>
                <td>${formatDate(loan.data_saida)}</td>
                <td>${formatDate(loan.data_devolucao)}</td>
                <td>${duration} dias</td>
                <td><span class="badge badge-${status}">${getStatusLabel(status)}</span></td>
            </tr>
        `;
    }).join('');
}

function renderReturnConditionsReport() {
    const returns = store.returns;

    if (returns.length === 0) {
        elements.noReturnConditionsMsg.style.display = 'block';
        elements.returnConditionsReportBody.innerHTML = '';
        return;
    }

    elements.noReturnConditionsMsg.style.display = 'none';

    elements.returnConditionsReportBody.innerHTML = returns.map(ret => `
        <tr>
            <td>${ret.id}</td>
            <td>${ret.notebook_nome || 'N/A'}</td>
            <td>${ret.professor_nome || 'N/A'}</td>
            <td>${formatDate(ret.data_devolucao)}</td>
            <td><span class="badge badge-${getConditionClass(ret.condicao)}">${ret.condicao}</span></td>
            <td title="${ret.observacoes || ''}">${truncateText(ret.observacoes, 40)}</td>
        </tr>
    `).join('');
}

function exportReport() {
    const escXml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const cell = (value) => {
        const type = typeof value === 'number' ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${escXml(value)}</Data></Cell>`;
    };

    const row = (cells) => `<Row>${cells.map(cell).join('')}</Row>`;

    const headerRow = (headers) => row(headers);

    const sheet = (name, rowsXml) =>
        `<Worksheet ss:Name="${escXml(name)}"><Table>${rowsXml}</Table></Worksheet>`;

    const hoje = new Date().toLocaleDateString('pt-BR');

    // Resumo
    const resumoRows = [
        headerRow(['Métrica', 'Valor']),
        row(['Data de Geração', hoje]),
        row(['Total de Notebooks', store.notebooks.length]),
        row(['Total de Professores', store.teachers.length]),
        row(['Total de Empréstimos', store.loans.length]),
        row(['Empréstimos Ativos', store.loans.filter(l => !l.data_devolucao).length]),
        row(['Empréstimos Atrasados', store.loans.filter(l => !l.data_devolucao && new Date(l.data_prevista_devolucao) < new Date()).length]),
        row(['Total de Devoluções', store.returns.length])
    ].join('');

    // Empréstimos
    let loansRows = headerRow(['ID', 'Notebook', 'Professor', 'Data Saída', 'Data Prevista', 'Data Devolução', 'Status', 'Condição', 'Observações']);
    if (store.loans.length === 0) {
        loansRows += row(['Nenhum empréstimo registrado.']);
    } else {
        loansRows += store.loans.map(loan => row([
            loan.id,
            loan.notebook_nome || 'N/A',
            loan.professor_nome || 'N/A',
            formatDate(loan.data_saida),
            formatDate(loan.data_prevista_devolucao),
            loan.data_devolucao ? formatDate(loan.data_devolucao) : 'Pendente',
            getStatusLabel(getStatus(loan)),
            loan.condicao_devolucao || 'N/A',
            loan.observacoes || ''
        ])).join('');
    }

    // Devoluções
    let returnsRows = '';
    if (store.returns.length > 0) {
        returnsRows += headerRow(['ID', 'Notebook', 'Professor', 'Data Devolução', 'Condição', 'Observações']);
        returnsRows += store.returns.map(ret => row([
            ret.id,
            ret.notebook_nome || 'N/A',
            ret.professor_nome || 'N/A',
            formatDate(ret.data_devolucao),
            ret.condicao,
            ret.observacoes || ''
        ])).join('');
    }

    let sheets = '';
    sheets += sheet('Resumo', resumoRows);
    sheets += sheet('Empréstimos', loansRows);
    if (returnsRows) sheets += sheet('Devoluções', returnsRows);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheets}
</Workbook>`;

    const blob = new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-emprestimos-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// MODAIS
// ============================================================

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initEventListeners() {
    // Navegação
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.section);
        });
    });

    // Menu mobile
    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('active');
    });

    // Logout
    elements.logoutBtn.addEventListener('click', async () => {
        try {
            await API.logout();
        } catch (e) { /* ignora erros de logout */ }
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    });

    // Abrir modal de notebook
    elements.addNotebookBtn.addEventListener('click', () => {
        document.getElementById('notebookModalTitle').textContent = 'Adicionar Notebook';
        elements.notebookForm.reset();
        document.getElementById('notebookId').value = '';
        openModal(elements.notebookModal);
    });

    // Abrir modal de professor
    elements.addTeacherBtn.addEventListener('click', () => {
        document.getElementById('teacherModalTitle').textContent = 'Adicionar Professor';
        elements.teacherForm.reset();
        document.getElementById('teacherId').value = '';
        openModal(elements.teacherModal);
    });

    // Novo empréstimo
    elements.newLoanBtn.addEventListener('click', async () => {
        await populateLoanSelects();
        openModal(elements.loanModal);
    });

    // Registrar devolução
    elements.newReturnBtn.addEventListener('click', async () => {
        const activeLoans = store.loans.filter(l => !l.data_devolucao);
        if (activeLoans.length === 0) {
            showError('Não há empréstimos ativos para devolução.');
            return;
        }

        document.getElementById('returnLoanSearch').value = '';
        populateReturnLoanSelect('');
        openModal(elements.selectLoanModal);
    });

    // Busca de empréstimos para devolução por nome do professor/notebook
    const returnLoanSearch = document.getElementById('returnLoanSearch');
    if (returnLoanSearch) {
        returnLoanSearch.addEventListener('input', (e) => {
            populateReturnLoanSelect(e.target.value);
        });
    }

    document.getElementById('continueReturnBtn').addEventListener('click', () => {
        const select = document.getElementById('returnLoanSelect');
        const loanId = parseInt(select.value);
        if (!loanId) {
            showError('Selecione um empréstimo para continuar.');
            return;
        }
        closeModal(elements.selectLoanModal);
        returnNotebook(loanId);
    });

    // Exportar relatório
    elements.exportReportBtn.addEventListener('click', exportReport);

    // Fechar modais
    document.querySelectorAll('.modal-close, .btn-secondary[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(document.getElementById(btn.dataset.modal));
        });
    });

    // Fechar modal clicando fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Salvar notebook
    elements.notebookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('notebookId').value;

        const data = {
            marca: document.getElementById('notebookBrand').value,
            modelo: document.getElementById('notebookModel').value,
            patrimonio: document.getElementById('notebookPatrimony').value,
            estado: document.getElementById('notebookState').value,
            observacoes: document.getElementById('notebookObservations')?.value || '',
        };

        try {
            if (id) {
                await API.updateNotebook(id, data);
                showSuccess('Notebook atualizado com sucesso');
            } else {
                await API.createNotebook(data);
                showSuccess('Notebook cadastrado com sucesso');
            }
            closeModal(elements.notebookModal);
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    });

    // Salvar professor
    elements.teacherForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('teacherId').value;

        const data = {
            nome: document.getElementById('teacherName').value,
            matricula: document.getElementById('teacherRegistration').value,
            disciplina: document.getElementById('teacherSubject').value,
            telefone: document.getElementById('teacherPhone').value,
        };

        try {
            if (id) {
                await API.updateTeacher(id, data);
                showSuccess('Professor atualizado com sucesso');
            } else {
                await API.createTeacher(data);
                showSuccess('Professor cadastrado com sucesso');
            }
            closeModal(elements.teacherModal);
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    });

    // Registrar empréstimo
    elements.loanForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            notebook_id: parseInt(document.getElementById('loanNotebook').value),
            professor_id: parseInt(document.getElementById('loanTeacher').value),
            data_saida: document.getElementById('loanDate').value,
            data_prevista_devolucao: document.getElementById('returnDate').value,
        };

        try {
            await API.createLoan(data);
            showSuccess('Empréstimo registrado com sucesso');
            closeModal(elements.loanModal);
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    });

    // Registrar devolução
    elements.returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            id: parseInt(document.getElementById('returnLoanId').value),
            data_devolucao: document.getElementById('returnActualDate').value,
            condicao: document.getElementById('returnCondition').value,
            observacoes: document.getElementById('returnObservations').value,
        };

        try {
            await API.registerReturn(data);
            showSuccess('Devolução registrada com sucesso');
            closeModal(elements.returnModal);
            await refreshAll();
        } catch (error) {
            showError(error.message);
        }
    });

    // Confirmar exclusão
    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (currentDeleteCallback) {
            await currentDeleteCallback();
            currentDeleteCallback = null;
        }
        closeModal(elements.confirmModal);
    });

    // Busca de empréstimos
    const searchLoans = document.getElementById('searchLoans');
    if (searchLoans) {
        searchLoans.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            renderLoans();
        });
    }

    // Filtro de status de empréstimos
    const filterLoanStatus = document.getElementById('filterLoanStatus');
    if (filterLoanStatus) {
        filterLoanStatus.addEventListener('change', (e) => {
            currentFilterStatus = e.target.value;
            renderLoans();
        });
    }

    // Busca de devoluções
    const searchReturns = document.getElementById('searchReturns');
    if (searchReturns) {
        searchReturns.addEventListener('input', (e) => {
            currentReturnSearchTerm = e.target.value;
            renderReturns();
        });
    }

    // Filtro de condição de devoluções
    const filterReturnCondition = document.getElementById('filterReturnCondition');
    if (filterReturnCondition) {
        filterReturnCondition.addEventListener('change', (e) => {
            currentReturnFilterCondition = e.target.value;
            renderReturns();
        });
    }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    // Exibe nome do usuário
    const currentUser = document.getElementById('currentUser');
    if (currentUser) {
        currentUser.textContent = localStorage.getItem('usuario') || 'admin';
    }

    initEventListeners();
    await loadAllData();
    navigateTo('dashboard');
});