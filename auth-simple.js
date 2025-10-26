// ============================================
// SISTEMA DE AUTENTICAÇÃO SIMPLES
// ============================================

// ===== CONFIGURAÇÃO DE CREDENCIAIS =====
// IMPORTANTE: Altere estas credenciais para as suas!
const CREDENCIAIS = {
    usuario: 'admin',
    senha: 'caminhoneir@s'  // ✅ SENHA ALTERADA!
};

// Chave para armazenar sessão
const CHAVE_SESSAO = 'contas-sessao-ativa';

// ===== VERIFICAÇÃO DE SESSÃO =====

/**
 * Verifica se existe uma sessão ativa
 */
function verificarSessao() {
    const sessaoAtiva = sessionStorage.getItem(CHAVE_SESSAO);
    return sessaoAtiva === 'true';
}

/**
 * Cria uma sessão ativa
 */
function criarSessao() {
    sessionStorage.setItem(CHAVE_SESSAO, 'true');
}

/**
 * Encerra a sessão
 */
function encerrarSessao() {
    sessionStorage.removeItem(CHAVE_SESSAO);
}

// ===== CONTROLE DE TELA =====

/**
 * Mostra a tela de login e oculta o app
 */
function mostrarTelaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
    }
    if (mainApp) {
        mainApp.style.display = 'none';
    }
}

/**
 * Oculta a tela de login e mostra o app
 */
function mostrarApp() {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) {
        loginScreen.classList.add('hidden');
    }
    if (mainApp) {
        mainApp.style.display = 'block';
    }
}

// ===== AUTENTICAÇÃO =====

/**
 * Valida as credenciais do usuário
 */
function validarCredenciais(usuario, senha) {
    return usuario === CREDENCIAIS.usuario && senha === CREDENCIAIS.senha;
}

/**
 * Processa o login
 */
function realizarLogin(usuario, senha) {
    if (validarCredenciais(usuario, senha)) {
        criarSessao();
        mostrarApp();
        
        // Carregar dados
        if (typeof carregarCategorias === 'function') {
            carregarCategorias();
        }
        if (typeof carregarDados === 'function' && mesAtual) {
            carregarDados(mesAtual);
        }
        
        mostrarToast('✅ Login realizado com sucesso!', 'success');
        return true;
    } else {
        mostrarErroLogin();
        return false;
    }
}

/**
 * Processa o logout
 */
function realizarLogout() {
    encerrarSessao();
    
    // Limpar dados da interface
    if (typeof entradas !== 'undefined') entradas = [];
    if (typeof despesas !== 'undefined') despesas = [];
    if (typeof renderizarTudo === 'function') {
        renderizarTudo();
    }
    
    mostrarTelaLogin();
    mostrarToast('✅ Você saiu do sistema!', 'success');
}

/**
 * Mostra erro de login
 */
function mostrarErroLogin() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.classList.remove('hidden');
        
        // Ocultar após 3 segundos
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 3000);
    }
}

// ===== INICIALIZAÇÃO =====

/**
 * Inicializa o sistema de autenticação
 */
function inicializarAuth() {
    // Verificar se já tem sessão ativa
    if (verificarSessao()) {
        mostrarApp();
    } else {
        mostrarTelaLogin();
    }
    
    // Adicionar listener ao formulário de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const usuario = document.getElementById('login-usuario').value.trim();
            const senha = document.getElementById('login-senha').value;
            
            if (realizarLogin(usuario, senha)) {
                // Limpar campos
                loginForm.reset();
            }
        });
    }
    
    // Adicionar listener ao botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('Deseja sair do sistema?')) {
                realizarLogout();
            }
        });
    }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAuth);
} else {
    inicializarAuth();
}

// Exportar funções para uso global
window.authSimple = {
    verificarSessao,
    realizarLogout,
    mostrarApp,
    mostrarTelaLogin
};

