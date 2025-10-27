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

// Nota: Autenticação agora é gerenciada pelo auth-simple.js
// Firebase é usado apenas para sincronização de dados

// ===== SINCRONIZAÇÃO DE DADOS =====

let listenersAtivos = {};
let ignorarProximaAtualizacaoFirebase = false;

// Constantes para prefixos de armazenamento
const PREFIX_FIREBASE = 'contas-firebase-';
const CHAVE_CATEGORIAS_FIREBASE = 'contas-firebase-categorias';

/**
 * Sincronização inicial quando a página carrega
 */
async function sincronizarDadosInicial() {
    if (!isFirebaseEnabled) return;

    try {
        console.log('🔄 Carregando dados do Firebase...');
        
        // BUSCAR DADOS DO FIREBASE
        const snapshot = await database.ref('dados-compartilhados').once('value');
        const dadosFirebase = snapshot.val();

        if (dadosFirebase) {
            // CARREGAR DADOS DO FIREBASE
            carregarDadosDoFirebase(dadosFirebase);
            console.log('✅ Dados do Firebase carregados!');
        } else {
            // Se não há dados no Firebase, inicializar vazio
            inicializarDadosVazios();
            console.log('✅ Dados inicializados (Firebase vazio)');
        }
    } catch (error) {
        console.error('Erro na sincronização inicial:', error);
        // Se houver erro, inicializar dados vazios para não travar
        inicializarDadosVazios();
    }
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
    
    // Carregar poupança (GLOBAL - acumulativa)
    if (dadosFirebase.poupanca && Array.isArray(dadosFirebase.poupanca)) {
        poupanca = dadosFirebase.poupanca;
        localStorage.setItem('contas-firebase-poupanca', JSON.stringify(poupanca));
        if (typeof renderizarPoupanca === 'function') {
            renderizarPoupanca();
        }
    }
    
    // Carregar dados do mês atual
    if (dadosFirebase.meses && dadosFirebase.meses[mesAtual]) {
        const dadosMes = dadosFirebase.meses[mesAtual];
        entradas = dadosMes.entradas || [];
        despesas = dadosMes.despesas || [];
        
        // Carregar gastos avulsos do mês
        if (dadosMes.gastosAvulsos && Array.isArray(dadosMes.gastosAvulsos)) {
            // Atualizar array global mantendo gastos de outros meses
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
            gastosAvulsos.push(...dadosMes.gastosAvulsos);
        }
    } else {
        entradas = [];
        despesas = [];
        // Remover gastos avulsos deste mês se não há dados
        gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
    }
    
    // Salvar no localStorage com prefixo Firebase
    const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
    const gastosAvulsosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
    localStorage.setItem(chaveMesFirebase, JSON.stringify({ 
        entradas, 
        despesas,
        gastosAvulsos: gastosAvulsosMes
    }));
    
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
    gastosAvulsos = [];
    const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
    localStorage.setItem(chaveMesFirebase, JSON.stringify({ 
        entradas, 
        despesas,
        gastosAvulsos: []
    }));
    
    renderizarTudo();
}


/**
 * Sincroniza um mês específico para o Firebase (área compartilhada)
 */
async function sincronizarMesParaFirebase(mes, dados) {
    if (!isFirebaseEnabled) return;

    try {
        // Ativar flag para ignorar a próxima atualização do listener
        ignorarProximaAtualizacaoFirebase = true;
        console.log('🔒 Bloqueando listener temporariamente...');
        
        await database.ref(`dados-compartilhados/meses/${mes}`).set(dados);
        console.log(`✅ Mês ${mes} sincronizado com Firebase`);
        
        // Desativar o flag após 2 segundos (tempo suficiente para o Firebase processar)
        setTimeout(() => {
            ignorarProximaAtualizacaoFirebase = false;
            console.log('🔓 Listener desbloqueado');
        }, 2000);
    } catch (error) {
        console.error('❌ Erro ao sincronizar mês:', error);
        ignorarProximaAtualizacaoFirebase = false; // Desbloquear em caso de erro
    }
}

/**
 * Sincroniza categorias para o Firebase (área compartilhada)
 */
async function sincronizarCategoriasParaFirebase(cats) {
    if (!isFirebaseEnabled) return;

    try {
        await database.ref('dados-compartilhados/categorias').set(cats);
        console.log('Categorias sincronizadas');
    } catch (error) {
        console.error('Erro ao sincronizar categorias:', error);
    }
}

/**
 * Sincroniza poupança para o Firebase (área compartilhada - GLOBAL)
 */
async function sincronizarPoupancaParaFirebase(poupancaData) {
    if (!isFirebaseEnabled) return;

    try {
        await database.ref('dados-compartilhados/poupanca').set(poupancaData);
        console.log('Poupança sincronizada');
    } catch (error) {
        console.error('Erro ao sincronizar poupança:', error);
    }
}

// ===== LISTENERS EM TEMPO REAL =====

/**
 * Inicia listeners para mudanças em tempo real (área compartilhada)
 */
function iniciarListenersSincronizacao() {
    if (!isFirebaseEnabled) return;

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
    
    // Listener para poupança compartilhada (GLOBAL - acumulativa)
    const refPoupanca = database.ref('dados-compartilhados/poupanca');
    listenersAtivos.poupanca = refPoupanca.on('value', (snapshot) => {
        const poupancaFirebase = snapshot.val();
        if (poupancaFirebase && Array.isArray(poupancaFirebase)) {
            if (JSON.stringify(poupancaFirebase) !== JSON.stringify(poupanca)) {
                poupanca = poupancaFirebase;
                localStorage.setItem('contas-firebase-poupanca', JSON.stringify(poupanca));
                if (typeof renderizarPoupanca === 'function') {
                    renderizarPoupanca();
                }
                console.log('☁️ Poupança compartilhada atualizada');
            }
        }
    });

    // Listener para mudanças no mês atual compartilhado
    const refMesAtual = database.ref(`dados-compartilhados/meses/${mesAtual}`);
    listenersAtivos.mesAtual = refMesAtual.on('value', (snapshot) => {
        // Se estamos ignorando atualizações (acabamos de salvar localmente), pular
        if (ignorarProximaAtualizacaoFirebase) {
            console.log('⏭️ Ignorando atualização do Firebase (salvamento local recente)');
            return;
        }
        
        const dadosMesFirebase = snapshot.val();
        if (dadosMesFirebase) {
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
            const dadosLocaisStr = localStorage.getItem(chaveMesFirebase);
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                console.log('☁️ Recebendo atualização do Firebase...');
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                
                // Atualizar gastos avulsos do mês
                if (dadosMesFirebase.gastosAvulsos && Array.isArray(dadosMesFirebase.gastosAvulsos)) {
                    gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
                    gastosAvulsos.push(...dadosMesFirebase.gastosAvulsos);
                } else {
                    gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
                }
                
                localStorage.setItem(chaveMesFirebase, dadosFirebaseStr);
                renderizarTudo();
                console.log('☁️ Dados compartilhados do mês atual atualizados');
            }
        } else {
            // Se não há dados no Firebase para este mês, mostrar vazio
            entradas = [];
            despesas = [];
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
            localStorage.setItem(chaveMesFirebase, JSON.stringify({ 
                entradas: [], 
                despesas: [],
                gastosAvulsos: []
            }));
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
    if (listenersAtivos.poupanca) {
        database.ref('dados-compartilhados/poupanca').off('value', listenersAtivos.poupanca);
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
    if (!isFirebaseEnabled) return;
    
    // Parar listener anterior
    if (listenersAtivos.mesAtual) {
        database.ref(`dados-compartilhados/meses/${mesAtual}`).off('value', listenersAtivos.mesAtual);
    }

    // Iniciar novo listener
    const refNovoMes = database.ref(`dados-compartilhados/meses/${novoMes}`);
    listenersAtivos.mesAtual = refNovoMes.on('value', (snapshot) => {
        // Se estamos ignorando atualizações (acabamos de salvar localmente), pular
        if (ignorarProximaAtualizacaoFirebase) {
            console.log('⏭️ Ignorando atualização do Firebase (salvamento local recente)');
            return;
        }
        
        const dadosMesFirebase = snapshot.val();
        const chaveMesFirebase = `${PREFIX_FIREBASE}${novoMes}`;
        
        if (dadosMesFirebase) {
            const dadosLocaisStr = localStorage.getItem(chaveMesFirebase);
            const dadosFirebaseStr = JSON.stringify(dadosMesFirebase);
            
            if (dadosLocaisStr !== dadosFirebaseStr) {
                console.log(`☁️ Recebendo atualização do Firebase para ${novoMes}...`);
                entradas = dadosMesFirebase.entradas || [];
                despesas = dadosMesFirebase.despesas || [];
                
                // Atualizar gastos avulsos do novo mês
                if (dadosMesFirebase.gastosAvulsos && Array.isArray(dadosMesFirebase.gastosAvulsos)) {
                    gastosAvulsos = gastosAvulsos.filter(g => g.mes !== novoMes);
                    gastosAvulsos.push(...dadosMesFirebase.gastosAvulsos);
                } else {
                    gastosAvulsos = gastosAvulsos.filter(g => g.mes !== novoMes);
                }
                
                localStorage.setItem(chaveMesFirebase, dadosFirebaseStr);
                renderizarTudo();
                console.log(`☁️ Dados compartilhados de ${novoMes} atualizados`);
            }
        } else {
            // Se não há dados no Firebase para este mês, mostrar vazio
            entradas = [];
            despesas = [];
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== novoMes);
            localStorage.setItem(chaveMesFirebase, JSON.stringify({ 
                entradas: [], 
                despesas: [],
                gastosAvulsos: []
            }));
            renderizarTudo();
        }
    });
}

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
// Iniciar sincronização quando a página carregar
if (isFirebaseEnabled) {
    // Esperar um pouco para garantir que o auth-simple.js carregou
    setTimeout(() => {
        if (window.authSimple && window.authSimple.verificarSessao()) {
            sincronizarDadosInicial();
            iniciarListenersSincronizacao();
        }
    }, 100);
}

// ===== EXPORTAR FUNÇÕES =====
window.firebaseSync = {
    sincronizarMesParaFirebase,
    sincronizarCategoriasParaFirebase,
    sincronizarPoupancaParaFirebase,
    atualizarListenerMes,
    isEnabled: () => isFirebaseEnabled,
    iniciarSincronizacao: () => {
        sincronizarDadosInicial();
        iniciarListenersSincronizacao();
    }
};

