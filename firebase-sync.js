// ============================================
// FIREBASE SYNC - Sistema de Sincronização
// ============================================

// ===== CONFIGURAÇÃO DE ACESSO =====
// IMPORTANTE: Adicione aqui os emails das pessoas autorizadas a acessar o sistema
const EMAILS_AUTORIZADOS = [
    // Adicione seus emails aqui:
    // 'rhayra@yahoo.com.br',
    // 'rhayragdg@gmail.com',
    // 'amarylima@hotmail.com'
];

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAUE8OUVtat1eYnu7o_UK5sKDz06CntJmU",
    authDomain: "controle-financeiro-2f875.firebaseapp.com",
    databaseURL: "https://controle-financeiro-2f875-default-rtdb.firebaseio.com",
    projectId: "controle-financeiro-2f875",
    storageBucket: "controle-financeiro-2f875.firebasestorage.app",
    messagingSenderId: "700647503137",
    appId: "1:700647503137:web:410281fe93431dec3c3a60"
  };

// Inicializar Firebase
let firebaseApp;
let auth;
let database;
let currentUser = null;
let isFirebaseEnabled = false;

try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    isFirebaseEnabled = true;
    console.log('Firebase inicializado com sucesso');
} catch (error) {
    console.warn('Firebase não configurado ou erro na inicialização:', error.message);
    isFirebaseEnabled = false;
}

// ===== AUTENTICAÇÃO =====

/**
 * Verifica se o email do usuário está autorizado
 */
function verificarAcessoAutorizado(email) {
    if (EMAILS_AUTORIZADOS.length === 0) {
        console.warn('⚠️ ATENÇÃO: Lista de emails autorizados está vazia! Configure EMAILS_AUTORIZADOS no firebase-sync.js');
        return true; // Permite acesso se a lista estiver vazia (para primeira configuração)
    }
    
    const emailLowerCase = email.toLowerCase();
    return EMAILS_AUTORIZADOS.some(emailAutorizado => 
        emailAutorizado.toLowerCase() === emailLowerCase
    );
}

/**
 * Faz login com Google
 */
async function loginComGoogle() {
    if (!isFirebaseEnabled) {
        mostrarToast('⚠️ Firebase não está configurado', 'warning');
        return;
    }

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Verificar se o usuário está autorizado
        if (!verificarAcessoAutorizado(user.email)) {
            // Usuário não autorizado - fazer logout imediatamente
            await auth.signOut();
            mostrarToast('❌ Acesso negado! Você não tem permissão para acessar este sistema.', 'error');
            mostrarTelaLogin();
            return;
        }
        
        currentUser = user;
        mostrarToast('✅ Login realizado com sucesso!', 'success');
        ocultarTelaLogin();
        atualizarUIUsuario(currentUser);
        await sincronizarDadosInicial();
    } catch (error) {
        console.error('Erro no login:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            mostrarToast('⚠️ Login cancelado', 'warning');
        } else {
            mostrarToast('❌ Erro ao fazer login: ' + error.message, 'error');
        }
    }
}

/**
 * Faz logout
 */
async function logout() {
    if (!isFirebaseEnabled) return;

    try {
        await auth.signOut();
        currentUser = null;
        
        // Limpar dados da interface
        entradas = [];
        despesas = [];
        categorias = [];
        if (typeof renderizarTudo === 'function') {
            renderizarTudo();
        }
        
        atualizarUIUsuario(null);
        mostrarTelaLogin();
        mostrarToast('✅ Logout realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no logout:', error);
        mostrarToast('❌ Erro ao fazer logout', 'error');
    }
}

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
function ocultarTelaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) {
        loginScreen.classList.add('hidden');
    }
    if (mainApp) {
        mainApp.style.display = 'block';
    }
}

/**
 * Monitora mudanças de autenticação
 */
if (isFirebaseEnabled) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Verificar se o usuário está autorizado
            if (!verificarAcessoAutorizado(user.email)) {
                console.warn('Tentativa de acesso não autorizado:', user.email);
                auth.signOut();
                mostrarTelaLogin();
                mostrarToast('❌ Acesso negado! Email não autorizado.', 'error');
                return;
            }
            
            currentUser = user;
            console.log('Usuário autenticado:', user.email);
            ocultarTelaLogin();
            atualizarUIUsuario(user);
            sincronizarDadosInicial();
            iniciarListenersSincronizacao();
        } else {
            console.log('Usuário não autenticado');
            currentUser = null;
            mostrarTelaLogin();
            atualizarUIUsuario(null);
            pararListenersSincronizacao();
        }
    });
}

/**
 * Atualiza a UI com informações do usuário
 */
function atualizarUIUsuario(user) {
    const btnLogin = document.getElementById('btn-login');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const syncIndicator = document.getElementById('sync-indicator');

    if (user) {
        btnLogin.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        userName.textContent = user.displayName || user.email;
        syncIndicator.innerHTML = '🌐 Dados Compartilhados';
        syncIndicator.classList.add('text-green-600');
    } else {
        btnLogin.classList.remove('hidden');
        userInfo.classList.add('hidden');
        userInfo.classList.remove('flex');
        syncIndicator.innerHTML = '💾 Modo Local';
        syncIndicator.classList.remove('text-green-600');
    }
}

// ===== SINCRONIZAÇÃO DE DADOS =====

let listenersAtivos = {};
let dadosLocaisBackup = null; // Backup dos dados locais quando logado

// Constantes para prefixos de armazenamento
const PREFIX_LOCAL = 'contas-local-';
const PREFIX_FIREBASE = 'contas-firebase-';
const CHAVE_CATEGORIAS_LOCAL = 'contas-categorias';
const CHAVE_CATEGORIAS_FIREBASE = 'contas-firebase-categorias';

/**
 * Sincronização inicial quando o usuário faz login
 */
async function sincronizarDadosInicial() {
    if (!currentUser || !isFirebaseEnabled) return;

    try {
        mostrarToast('🔄 Carregando dados compartilhados...', 'info');
        
        // 1. SALVAR DADOS LOCAIS EM BACKUP
        salvarDadosLocaisEmBackup();
        
        // 2. BUSCAR DADOS DO FIREBASE
        const snapshot = await database.ref('dados-compartilhados').once('value');
        const dadosFirebase = snapshot.val();

        if (dadosFirebase) {
            // 3. CARREGAR DADOS DO FIREBASE
            carregarDadosDoFirebase(dadosFirebase);
            mostrarToast('✅ Dados compartilhados carregados!', 'success');
        } else {
            // Se não há dados no Firebase, inicializar vazio
            inicializarDadosVazios();
            mostrarToast('✅ Pronto! Adicione dados compartilhados.', 'success');
        }
    } catch (error) {
        console.error('Erro na sincronização inicial:', error);
        console.error('Stack trace:', error.stack);
        mostrarToast('⚠️ Erro ao sincronizar: ' + error.message, 'warning');
        
        // Se houver erro, inicializar dados vazios para não travar
        inicializarDadosVazios();
    }
}

/**
 * Salva dados locais em backup antes de carregar dados do Firebase
 */
function salvarDadosLocaisEmBackup() {
    console.log('💾 Salvando dados locais em backup...');
    
    // Não fazer nada se já existe backup (já está logado)
    if (localStorage.getItem('contas-backup-ativo')) {
        return;
    }
    
    dadosLocaisBackup = {
        categorias: localStorage.getItem(CHAVE_CATEGORIAS_LOCAL),
        meses: {}
    };
    
    // Salvar todos os meses locais
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-') && !key.includes('firebase') && !key.includes('backup') && key !== 'contas-categorias' && key !== 'contas-dark-mode') {
            dadosLocaisBackup.meses[key] = localStorage.getItem(key);
        }
    }
    
    // Marcar que há backup ativo
    localStorage.setItem('contas-backup-ativo', 'true');
    console.log('✅ Backup dos dados locais criado');
}

/**
 * Carrega dados do Firebase na interface
 */
function carregarDadosDoFirebase(dadosFirebase) {
    console.log('☁️ Carregando dados do Firebase...');
    
    // Carregar categorias
    if (dadosFirebase.categorias && Array.isArray(dadosFirebase.categorias)) {
        categorias = dadosFirebase.categorias;
        localStorage.setItem(CHAVE_CATEGORIAS_FIREBASE, JSON.stringify(categorias));
    } else {
        // Categorias padrão se não houver
        categorias = [
            { nome: 'Salário', cor: PALETA_CORES[0] },
            { nome: 'Moradia', cor: PALETA_CORES[1] },
            { nome: 'Alimentação', cor: PALETA_CORES[2] },
            { nome: 'Transporte', cor: PALETA_CORES[3] },
            { nome: 'Lazer', cor: PALETA_CORES[4] }
        ];
        localStorage.setItem(CHAVE_CATEGORIAS_FIREBASE, JSON.stringify(categorias));
    }
    
    renderizarCategorias();
    
    // Carregar dados do mês atual
    if (dadosFirebase.meses && dadosFirebase.meses[mesAtual]) {
        const dadosMes = dadosFirebase.meses[mesAtual];
        entradas = dadosMes.entradas || [];
        despesas = dadosMes.despesas || [];
    } else {
        entradas = [];
        despesas = [];
    }
    
    // Salvar no localStorage com prefixo Firebase
    const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
    localStorage.setItem(chaveMesFirebase, JSON.stringify({ entradas, despesas }));
    
    renderizarTudo();
    console.log('✅ Dados do Firebase carregados na interface');
}

/**
 * Inicializa dados vazios quando não há dados no Firebase
 */
function inicializarDadosVazios() {
    // Categorias padrão
    categorias = [
        { nome: 'Salário', cor: PALETA_CORES[0] },
        { nome: 'Moradia', cor: PALETA_CORES[1] },
        { nome: 'Alimentação', cor: PALETA_CORES[2] },
        { nome: 'Transporte', cor: PALETA_CORES[3] },
        { nome: 'Lazer', cor: PALETA_CORES[4] }
    ];
    localStorage.setItem(CHAVE_CATEGORIAS_FIREBASE, JSON.stringify(categorias));
    renderizarCategorias();
    
    // Dados vazios
    entradas = [];
    despesas = [];
    const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
    localStorage.setItem(chaveMesFirebase, JSON.stringify({ entradas, despesas }));
    
    renderizarTudo();
}

/**
 * Restaura dados locais quando faz logout
 */
function restaurarDadosLocais() {
    console.log('🔄 Restaurando dados locais...');
    
    // Limpar dados do Firebase do localStorage
    const keysParaRemover = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(PREFIX_FIREBASE) || key === CHAVE_CATEGORIAS_FIREBASE)) {
            keysParaRemover.push(key);
        }
    }
    keysParaRemover.forEach(key => localStorage.removeItem(key));
    
    // Remover marcador de backup
    localStorage.removeItem('contas-backup-ativo');
    
    // Recarregar categorias locais
    const categoriasLocais = localStorage.getItem(CHAVE_CATEGORIAS_LOCAL);
    if (categoriasLocais) {
        try {
            const cats = JSON.parse(categoriasLocais);
            if (Array.isArray(cats)) {
                categorias = cats;
            } else {
                categorias = [];
            }
        } catch (e) {
            categorias = [];
        }
    } else {
        // Categorias padrão
        categorias = [
            { nome: 'Salário', cor: PALETA_CORES[0] },
            { nome: 'Moradia', cor: PALETA_CORES[1] },
            { nome: 'Alimentação', cor: PALETA_CORES[2] },
            { nome: 'Transporte', cor: PALETA_CORES[3] },
            { nome: 'Lazer', cor: PALETA_CORES[4] }
        ];
        localStorage.setItem(CHAVE_CATEGORIAS_LOCAL, JSON.stringify(categorias));
    }
    
    renderizarCategorias();
    
    // Recarregar dados do mês atual
    carregarDados(mesAtual);
    
    console.log('✅ Dados locais restaurados');
}

/**
 * Sincroniza um mês específico para o Firebase (área compartilhada)
 */
async function sincronizarMesParaFirebase(mes, dados) {
    if (!currentUser || !isFirebaseEnabled) return;

    try {
        await database.ref(`dados-compartilhados/meses/${mes}`).set(dados);
        console.log(`Mês ${mes} sincronizado para área compartilhada`);
    } catch (error) {
        console.error('Erro ao sincronizar mês:', error);
    }
}

/**
 * Sincroniza categorias para o Firebase (área compartilhada)
 */
async function sincronizarCategoriasParaFirebase(cats) {
    if (!currentUser || !isFirebaseEnabled) return;

    try {
        await database.ref('dados-compartilhados/categorias').set(cats);
        console.log('Categorias sincronizadas para área compartilhada');
    } catch (error) {
        console.error('Erro ao sincronizar categorias:', error);
    }
}

// ===== LISTENERS EM TEMPO REAL =====

/**
 * Inicia listeners para mudanças em tempo real (área compartilhada)
 */
function iniciarListenersSincronizacao() {
    if (!currentUser || !isFirebaseEnabled) return;

    // Listener para categorias compartilhadas
    const refCategorias = database.ref('dados-compartilhados/categorias');
    listenersAtivos.categorias = refCategorias.on('value', (snapshot) => {
        const categoriasFirebase = snapshot.val();
        if (categoriasFirebase && Array.isArray(categoriasFirebase)) {
            if (JSON.stringify(categoriasFirebase) !== JSON.stringify(categorias)) {
                categorias = categoriasFirebase;
                localStorage.setItem(CHAVE_CATEGORIAS_FIREBASE, JSON.stringify(categorias));
                renderizarCategorias();
                console.log('☁️ Categorias compartilhadas atualizadas');
            }
        }
    });

    // Listener para mudanças no mês atual compartilhado
    const refMesAtual = database.ref(`dados-compartilhados/meses/${mesAtual}`);
    listenersAtivos.mesAtual = refMesAtual.on('value', (snapshot) => {
        const dadosMesFirebase = snapshot.val();
        if (dadosMesFirebase) {
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
            const dadosLocaisStr = localStorage.getItem(chaveMesFirebase);
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                localStorage.setItem(chaveMesFirebase, dadosFirebaseStr);
                renderizarTudo();
                console.log('☁️ Dados compartilhados do mês atual atualizados');
            }
        } else {
            // Se não há dados no Firebase para este mês, mostrar vazio
            entradas = [];
            despesas = [];
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
            localStorage.setItem(chaveMesFirebase, JSON.stringify({ entradas: [], despesas: [] }));
            renderizarTudo();
        }
    });
}

/**
 * Para todos os listeners ativos
 */
function pararListenersSincronizacao() {
    if (!isFirebaseEnabled) return;

    if (listenersAtivos.categorias) {
        database.ref('dados-compartilhados/categorias').off('value', listenersAtivos.categorias);
    }
    if (listenersAtivos.mesAtual) {
        database.ref(`dados-compartilhados/meses/${mesAtual}`).off('value', listenersAtivos.mesAtual);
    }

    listenersAtivos = {};
    console.log('Listeners de sincronização parados');
}

/**
 * Atualiza o listener do mês quando o mês muda (área compartilhada)
 */
function atualizarListenerMes(novoMes) {
    if (!currentUser || !isFirebaseEnabled) return;
    
    // Parar listener anterior
    if (listenersAtivos.mesAtual) {
        database.ref(`dados-compartilhados/meses/${mesAtual}`).off('value', listenersAtivos.mesAtual);
    }

    // Iniciar novo listener
    const refNovoMes = database.ref(`dados-compartilhados/meses/${novoMes}`);
    listenersAtivos.mesAtual = refNovoMes.on('value', (snapshot) => {
        const dadosMesFirebase = snapshot.val();
        const chaveMesFirebase = `${PREFIX_FIREBASE}${novoMes}`;
        
        if (dadosMesFirebase) {
            const dadosLocaisStr = localStorage.getItem(chaveMesFirebase);
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                localStorage.setItem(chaveMesFirebase, dadosFirebaseStr);
                renderizarTudo();
                console.log(`☁️ Dados compartilhados de ${novoMes} atualizados`);
            }
        } else {
            // Se não há dados no Firebase para este mês, mostrar vazio
            entradas = [];
            despesas = [];
            localStorage.setItem(chaveMesFirebase, JSON.stringify({ entradas: [], despesas: [] }));
            renderizarTudo();
        }
    });
}

// ===== EXPORTAR FUNÇÕES =====
window.firebaseSync = {
    loginComGoogle,
    logout,
    sincronizarMesParaFirebase,
    sincronizarCategoriasParaFirebase,
    atualizarListenerMes,
    isEnabled: () => isFirebaseEnabled,
    getCurrentUser: () => currentUser
};

