// ============================================
// FIREBASE SYNC - Sistema de Sincronização
// ============================================

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
        currentUser = result.user;
        mostrarToast('✅ Login realizado com sucesso!', 'success');
        atualizarUIUsuario(currentUser);
        await sincronizarDadosInicial();
    } catch (error) {
        console.error('Erro no login:', error);
        mostrarToast('❌ Erro ao fazer login: ' + error.message, 'error');
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
        atualizarUIUsuario(null);
        mostrarToast('✅ Logout realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no logout:', error);
        mostrarToast('❌ Erro ao fazer logout', 'error');
    }
}

/**
 * Monitora mudanças de autenticação
 */
if (isFirebaseEnabled) {
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        atualizarUIUsuario(user);
        
        if (user) {
            console.log('Usuário autenticado:', user.email);
            sincronizarDadosInicial();
            iniciarListenersSincronizacao();
        } else {
            console.log('Usuário não autenticado');
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

/**
 * Sincronização inicial quando o usuário faz login
 */
async function sincronizarDadosInicial() {
    if (!currentUser || !isFirebaseEnabled) return;

    try {
        mostrarToast('🔄 Sincronizando dados compartilhados...', 'info');
        
        // Buscar dados compartilhados do Firebase
        const snapshot = await database.ref('dados-compartilhados').once('value');
        const dadosFirebase = snapshot.val();

        if (dadosFirebase) {
            // Se há dados no Firebase, mesclar com dados locais
            mesclarDados(dadosFirebase);
            mostrarToast('✅ Dados compartilhados sincronizados!', 'success');
        } else {
            // Se não há dados no Firebase, enviar dados locais
            await enviarTodosDadosParaFirebase();
            mostrarToast('✅ Dados enviados para área compartilhada!', 'success');
        }
    } catch (error) {
        console.error('Erro na sincronização inicial:', error);
        mostrarToast('⚠️ Erro ao sincronizar: ' + error.message, 'warning');
    }
}

/**
 * Mescla dados do Firebase com dados locais
 */
function mesclarDados(dadosFirebase) {
    // Mesclar categorias
    if (dadosFirebase.categorias) {
        const categoriasLocal = carregarCategorias();
        const categoriasFirebase = dadosFirebase.categorias;
        
        // Combinar categorias únicas
        const categoriasSet = new Set([...categoriasLocal, ...categoriasFirebase]);
        categorias = Array.from(categoriasSet);
        salvarCategorias();
        renderizarCategorias();
    }

    // Mesclar dados mensais
    if (dadosFirebase.meses) {
        Object.keys(dadosFirebase.meses).forEach(mes => {
            const dadosMesFirebase = dadosFirebase.meses[mes];
            const dadosMesLocal = carregarMes(mes);

            if (dadosMesLocal) {
                // Mesclar entradas e despesas por ID
                const entradas = mesclarArraysPorId(dadosMesLocal.entradas || [], dadosMesFirebase.entradas || []);
                const despesas = mesclarArraysPorId(dadosMesLocal.despesas || [], dadosMesFirebase.despesas || []);
                
                salvarMes(mes, { entradas, despesas });
            } else {
                // Se não existe localmente, salvar direto
                salvarMes(mes, dadosMesFirebase);
            }
        });
        
        // Recarregar o mês atual
        carregarMes(mesAtual);
        renderizarTudo();
    }
}

/**
 * Mescla arrays por ID, mantendo a versão mais recente
 */
function mesclarArraysPorId(arrayLocal, arrayFirebase) {
    const mapa = new Map();
    
    // Adicionar itens locais
    arrayLocal.forEach(item => {
        if (item.id) {
            mapa.set(item.id, item);
        }
    });
    
    // Sobrescrever/adicionar itens do Firebase
    arrayFirebase.forEach(item => {
        if (item.id) {
            const itemLocal = mapa.get(item.id);
            // Usar o timestamp mais recente se ambos existirem
            if (!itemLocal || (item.timestamp && item.timestamp > (itemLocal.timestamp || 0))) {
                mapa.set(item.id, item);
            }
        }
    });
    
    return Array.from(mapa.values());
}

/**
 * Envia todos os dados locais para o Firebase (área compartilhada)
 */
async function enviarTodosDadosParaFirebase() {
    if (!currentUser || !isFirebaseEnabled) return;

    // Buscar dados atuais para mesclar
    const snapshot = await database.ref('dados-compartilhados').once('value');
    const dadosAtuais = snapshot.val() || { categorias: [], meses: {} };

    const dadosLocais = {
        categorias: carregarCategorias(),
        meses: {}
    };

    // Coletar dados de todos os meses do localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-')) {
            const mes = key.replace('contas-', '');
            if (mes !== 'categorias' && mes !== 'dark-mode') {
                const dadosMes = localStorage.getItem(key);
                if (dadosMes) {
                    dadosLocais.meses[mes] = JSON.parse(dadosMes);
                }
            }
        }
    }

    // Mesclar categorias
    const categoriasSet = new Set([...dadosAtuais.categorias, ...dadosLocais.categorias]);
    const categoriasMescladas = Array.from(categoriasSet);

    // Mesclar meses
    const mesesMesclados = { ...dadosAtuais.meses };
    Object.keys(dadosLocais.meses).forEach(mes => {
        if (mesesMesclados[mes]) {
            // Mesclar entradas e despesas
            const entradas = mesclarArraysPorId(
                mesesMesclados[mes].entradas || [],
                dadosLocais.meses[mes].entradas || []
            );
            const despesas = mesclarArraysPorId(
                mesesMesclados[mes].despesas || [],
                dadosLocais.meses[mes].despesas || []
            );
            mesesMesclados[mes] = { entradas, despesas };
        } else {
            mesesMesclados[mes] = dadosLocais.meses[mes];
        }
    });

    try {
        await database.ref('dados-compartilhados').set({
            categorias: categoriasMescladas,
            meses: mesesMesclados
        });
        console.log('Dados enviados para área compartilhada do Firebase');
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        throw error;
    }
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
        if (categoriasFirebase && JSON.stringify(categoriasFirebase) !== JSON.stringify(categorias)) {
            categorias = categoriasFirebase;
            salvarCategorias();
            renderizarCategorias();
            console.log('Categorias compartilhadas atualizadas');
        }
    });

    // Listener para mudanças no mês atual compartilhado
    const refMesAtual = database.ref(`dados-compartilhados/meses/${mesAtual}`);
    listenersAtivos.mesAtual = refMesAtual.on('value', (snapshot) => {
        const dadosMesFirebase = snapshot.val();
        if (dadosMesFirebase) {
            const dadosLocaisStr = localStorage.getItem(getChaveMes(mesAtual));
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                salvarMes(mesAtual, { entradas, despesas });
                renderizarTudo();
                console.log('Dados compartilhados do mês atual atualizados');
            }
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
        if (dadosMesFirebase) {
            const dadosLocaisStr = localStorage.getItem(getChaveMes(novoMes));
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                renderizarTudo();
                console.log(`Dados compartilhados de ${novoMes} atualizados`);
            }
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

