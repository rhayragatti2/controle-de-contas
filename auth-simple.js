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
    // Salvar timestamp da sessão
    sessionStorage.setItem('contas-sessao-timestamp', Date.now().toString());
}

/**
 * Encerra a sessão
 */
function encerrarSessao() {
    sessionStorage.removeItem(CHAVE_SESSAO);
    sessionStorage.removeItem('contas-sessao-timestamp');
    sessionStorage.removeItem('contas-usuario');
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
    mostrarLoadingLogin(true);
    
    // Simular pequeno delay para melhor UX
    setTimeout(() => {
        if (validarCredenciais(usuario, senha)) {
            criarSessao();
            
            // Atualizar indicador de usuário
            atualizarIndicadorUsuario(usuario);
            
            mostrarApp();
            
            // Carregar dados
            if (typeof carregarCategorias === 'function') {
                carregarCategorias();
            }
            if (typeof carregarDados === 'function' && mesAtual) {
                carregarDados(mesAtual);
            }
            
            // Iniciar sincronização Firebase se disponível
            if (window.firebaseSync && window.firebaseSync.iniciarSincronizacao) {
                window.firebaseSync.iniciarSincronizacao();
            }
            
            mostrarToast('✅ Login realizado com sucesso!', 'success');
            mostrarLoadingLogin(false);
        } else {
            mostrarLoadingLogin(false);
            mostrarErroLogin();
        }
    }, 300);
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
 * Mostra erro de login com animação
 */
function mostrarErroLogin() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.classList.remove('hidden');
        errorDiv.classList.add('shake');
        
        // Remover animação após completar
        setTimeout(() => {
            errorDiv.classList.remove('shake');
        }, 500);
        
        // Ocultar após 3 segundos
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 3000);
    }
}

/**
 * Mostra loading no botão de login
 */
function mostrarLoadingLogin(mostrar) {
    const btnSubmit = document.getElementById('btn-login-submit');
    const btnText = document.getElementById('login-btn-text');
    const spinner = document.getElementById('login-spinner');
    
    if (btnSubmit && btnText && spinner) {
        if (mostrar) {
            btnSubmit.disabled = true;
            btnText.textContent = 'Entrando';
            spinner.classList.remove('hidden');
        } else {
            btnSubmit.disabled = false;
            btnText.textContent = '🔓 Entrar';
            spinner.classList.add('hidden');
        }
    }
}

/**
 * Atualiza o indicador de usuário logado
 */
function atualizarIndicadorUsuario(usuario) {
    const userInitial = document.getElementById('user-initial');
    const userNameDisplay = document.getElementById('user-name-display');
    
    if (userInitial && userNameDisplay) {
        // Pegar primeira letra do usuário em maiúscula
        const inicial = usuario.charAt(0).toUpperCase();
        userInitial.textContent = inicial;
        userNameDisplay.textContent = usuario;
    }
}

// ===== INICIALIZAÇÃO =====

/**
 * Inicializa o sistema de autenticação
 */
function inicializarAuth() {
    // Verificar se já tem sessão ativa
    if (verificarSessao()) {
        // Recuperar usuário do sessionStorage se disponível
        const usuarioSalvo = sessionStorage.getItem('contas-usuario');
        if (usuarioSalvo) {
            atualizarIndicadorUsuario(usuarioSalvo);
        }
        mostrarApp();
        
        // Iniciar sincronização Firebase
        if (window.firebaseSync && window.firebaseSync.iniciarSincronizacao) {
            window.firebaseSync.iniciarSincronizacao();
        }
    } else {
        mostrarTelaLogin();
        
        // Auto-foco no campo de usuário após pequeno delay
        setTimeout(() => {
            const inputUsuario = document.getElementById('login-usuario');
            if (inputUsuario) {
                inputUsuario.focus();
            }
        }, 100);
    }
    
    // Adicionar listener ao formulário de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const usuario = document.getElementById('login-usuario').value.trim();
            const senha = document.getElementById('login-senha').value;
            
            // Salvar usuário para recuperar depois
            sessionStorage.setItem('contas-usuario', usuario);
            
            realizarLogin(usuario, senha);
            
            // Limpar apenas a senha por segurança
            document.getElementById('login-senha').value = '';
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

