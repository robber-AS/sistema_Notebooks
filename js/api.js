// ============================================================
// CLIENTE DA API - Node.js + Express + MySQL
// ============================================================

// Endereço do backend Express.
// Pode ser alterado caso o servidor rode em outra máquina/porta.
const API_BASE_URL = 'http://localhost:3000/api/';

const API = {
  baseUrl: API_BASE_URL,

  // Token JWT do usuário logado (salvo no login)
  get token() {
    return localStorage.getItem('token');
  },

  // Requisição genérica
  async request(endpoint, method = 'GET', data = null) {
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    // Adiciona token de autenticação
    if (this.token) {
      options.headers['Authorization'] = 'Bearer ' + this.token;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(this.baseUrl + endpoint, options);
      const result = await response.json();

      if (!response.ok) {
        // Se token expirado, força novo login
        if (response.status === 401 && !endpoint.includes('auth/login')) {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
          }
          throw new Error(result.message || 'Sessão expirada.');
        }
        throw new Error(result.message || 'Erro na requisição');
      }

      return result;
    } catch (error) {
      throw error;
    }
  },

  // ============================================================
  // Autenticação
  // ============================================================

  async login(usuario, senha) {
    const result = await this.request('auth/login', 'POST', { usuario, senha });
    if (result.token) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('usuario', result.data.usuario || usuario);
      localStorage.setItem('nome', result.data.nome || usuario);
    }
    return result;
  },

  async register(nome, usuario, senha, email) {
    const result = await this.request('auth/register', 'POST', { nome, usuario, senha, email });
    if (result.token) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('usuario', result.data.usuario || usuario);
      localStorage.setItem('nome', result.data.nome || usuario);
    }
    return result;
  },

  async logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('usuario');
    localStorage.removeItem('nome');
  },

  // ============================================================
  // Notebooks
  // ============================================================

  async getNotebooks(disponiveis = false) {
    const suffix = disponiveis ? '?disponiveis=true' : '';
    return this.request('notebooks' + suffix);
  },

  async getNotebook(id) {
    return this.request(`notebooks/${id}`);
  },

  async createNotebook(data) {
    return this.request('notebooks', 'POST', data);
  },

  async updateNotebook(id, data) {
    return this.request(`notebooks/${id}`, 'PUT', data);
  },

  async deleteNotebook(id) {
    return this.request(`notebooks/${id}`, 'DELETE');
  },

  // ============================================================
  // Professores
  // ============================================================

  async getTeachers() {
    return this.request('teachers');
  },

  async createTeacher(data) {
    return this.request('teachers', 'POST', data);
  },

  async updateTeacher(id, data) {
    return this.request(`teachers/${id}`, 'PUT', data);
  },

  async deleteTeacher(id) {
    return this.request(`teachers/${id}`, 'DELETE');
  },

  // ============================================================
  // Empréstimos
  // ============================================================

  async getLoans(status = '') {
    const suffix = status ? `?status=${status}` : '';
    return this.request('loans' + suffix);
  },

  async createLoan(data) {
    return this.request('loans', 'POST', data);
  },

  async registerReturn(data) {
    const { id, ...campos } = data;
    return this.request(`loans/${id}/return`, 'POST', campos);
  },

  async deleteLoan(id) {
    return this.request(`loans/${id}`, 'DELETE');
  },

  // ============================================================
  // Devoluções
  // ============================================================

  async getReturns(condicao = '') {
    const suffix = condicao ? `?condicao=${encodeURIComponent(condicao)}` : '';
    return this.request('returns' + suffix);
  },

  async deleteReturn(id) {
    return this.request(`returns/${id}`, 'DELETE');
  },

  // ============================================================
  // Relatórios
  // ============================================================

  async getDashboard() {
    return this.request('reports?tipo=dashboard');
  },

  async getReport(tipo) {
    return this.request(`reports?tipo=${tipo}`);
  },
};