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
let rafRenderId = null; // debounce de render

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
 * Gera um ID único para transações
 */
function gerarIdUnico() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Adiciona IDs únicos aos itens se ainda não tiverem
 */
function garantirIdsUnicos(array) {
    if (!Array.isArray(array)) return [];
    return array.map(item => {
        if (!item.id) {
            item.id = gerarIdUnico();
        }
        return item;
    });
}

/**
 * Mescla dois arrays de transações evitando duplicatas
 * Prioriza itens existentes (do Firebase) e adiciona novos (locais)
 */
function mesclarTransacoes(existentes, novas) {
    existentes = garantirIdsUnicos(existentes || []);
    novas = garantirIdsUnicos(novas || []);
    
    // Criar mapa de IDs existentes
    const mapaExistentes = new Map(existentes.map(item => [item.id, item]));
    
    // Adicionar ou atualizar itens
    novas.forEach(novoItem => {
        mapaExistentes.set(novoItem.id, novoItem);
    });
    
    return Array.from(mapaExistentes.values());
}

/**
 * Sincroniza um mês específico para o Firebase (área compartilhada)
 * Agora com MERGE inteligente para evitar sobrescrita de dados
 */
async function sincronizarMesParaFirebase(mes, dados) {
    if (!isFirebaseEnabled) return;

    try {
        // Ativar flag para ignorar a próxima atualização do listener
        ignorarProximaAtualizacaoFirebase = true;
        console.log('🔒 Bloqueando listener temporariamente...');
        console.log('🔄 Iniciando merge de dados...');
        
        // 1. Buscar dados existentes no Firebase
        const snapshot = await database.ref(`dados-compartilhados/meses/${mes}`).once('value');
        const dadosExistentes = snapshot.val() || { entradas: [], despesas: [], gastosAvulsos: [] };
        
        console.log('📊 Dados existentes no Firebase:', {
            entradas: dadosExistentes.entradas?.length || 0,
            despesas: dadosExistentes.despesas?.length || 0,
            gastosAvulsos: dadosExistentes.gastosAvulsos?.length || 0
        });
        
        console.log('📊 Dados locais a mesclar:', {
            entradas: dados.entradas?.length || 0,
            despesas: dados.despesas?.length || 0,
            gastosAvulsos: dados.gastosAvulsos?.length || 0
        });
        
        // 2. Mesclar dados (mantém existentes + adiciona novos)
        const dadosMesclados = {
            entradas: mesclarTransacoes(dadosExistentes.entradas, dados.entradas),
            despesas: mesclarTransacoes(dadosExistentes.despesas, dados.despesas),
            gastosAvulsos: mesclarTransacoes(dadosExistentes.gastosAvulsos, dados.gastosAvulsos)
        };
        
        console.log('✅ Dados mesclados:', {
            entradas: dadosMesclados.entradas.length,
            despesas: dadosMesclados.despesas.length,
            gastosAvulsos: dadosMesclados.gastosAvulsos.length
        });
        
        // 3. Salvar dados mesclados no Firebase
        await database.ref(`dados-compartilhados/meses/${mes}`).set(dadosMesclados);
        console.log(`✅ Mês ${mes} sincronizado com merge bem-sucedido!`);
        
        // 4. Atualizar dados locais com os dados mesclados
        if (mes === mesAtual) {
            entradas = dadosMesclados.entradas;
            despesas = dadosMesclados.despesas;
            
            // Atualizar gastos avulsos mantendo outros meses
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mes);
            gastosAvulsos.push(...dadosMesclados.gastosAvulsos);
            
            // Salvar no localStorage
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mes}`;
            localStorage.setItem(chaveMesFirebase, JSON.stringify(dadosMesclados));
            
            // Re-renderizar interface
            if (typeof renderizarTudo === 'function') {
                renderizarTudo();
            }
            
            console.log('✅ Interface atualizada com dados mesclados');
        }
        
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

    // Utilitário: agendar render para o próximo frame (evita flicker)
    const agendarRender = () => {
        if (typeof renderizarTudo !== 'function') return;
        if (rafRenderId) cancelAnimationFrame(rafRenderId);
        rafRenderId = requestAnimationFrame(() => {
            rafRenderId = null;
            renderizarTudo();
        });
    };

    // Listener para mudanças no mês atual compartilhado (merge, sem limpar em snapshot vazio)
    const refMesAtual = database.ref(`dados-compartilhados/meses/${mesAtual}`);
    listenersAtivos.mesAtual = refMesAtual.on('value', (snapshot) => {
        // Se estamos ignorando atualizações (acabamos de salvar localmente), pular
        if (ignorarProximaAtualizacaoFirebase) {
            console.log('⏭️ Ignorando atualização do Firebase (salvamento local recente)');
            return;
        }
        
        if (!snapshot.exists()) {
            console.warn('📭 Snapshot vazio; mantendo estado atual (sem limpar)');
            return;
        }

        const dadosMesFirebase = snapshot.val() || { entradas: [], despesas: [], gastosAvulsos: [] };
        console.log('☁️ Atualização do Firebase (merge em tempo real)...');

        // Mesclar com estado atual (lado cliente)
        entradas = mesclarTransacoes(entradas || [], dadosMesFirebase.entradas || []);
        despesas = mesclarTransacoes(despesas || [], dadosMesFirebase.despesas || []);

        // Atualizar gastos avulsos mantendo outros meses
        const gastosMesNovos = garantirIdsUnicos(dadosMesFirebase.gastosAvulsos || []).map(g => ({ ...g, mes: mesAtual }));
        gastosAvulsos = (gastosAvulsos || []).filter(g => g.mes !== mesAtual).concat(gastosMesNovos);

        // Persistir localmente o estado MERGIDO do mês atual
        const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
        const snapshotMes = {
            entradas,
            despesas,
            gastosAvulsos: gastosAvulsos.filter(g => g.mes === mesAtual)
        };
        localStorage.setItem(chaveMesFirebase, JSON.stringify(snapshotMes));

        // Agendar render (debounced)
        agendarRender();
        console.log('✅ Merge em tempo real aplicado (mês atual)');
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

    // Utilitário local de agendamento
    const agendarRender = () => {
        if (typeof renderizarTudo !== 'function') return;
        if (rafRenderId) cancelAnimationFrame(rafRenderId);
        rafRenderId = requestAnimationFrame(() => {
            rafRenderId = null;
            renderizarTudo();
        });
    };

    // Iniciar novo listener (merge, sem limpar em snapshot vazio)
    const refNovoMes = database.ref(`dados-compartilhados/meses/${novoMes}`);
    listenersAtivos.mesAtual = refNovoMes.on('value', (snapshot) => {
        // Se estamos ignorando atualizações (acabamos de salvar localmente), pular
        if (ignorarProximaAtualizacaoFirebase) {
            console.log('⏭️ Ignorando atualização do Firebase (salvamento local recente)');
            return;
        }
        
        if (!snapshot.exists()) {
            console.warn(`📭 Snapshot vazio para ${novoMes}; mantendo estado atual`);
            return;
        }

        const dadosMesFirebase = snapshot.val() || { entradas: [], despesas: [], gastosAvulsos: [] };
        console.log(`☁️ Atualização do Firebase (merge) para ${novoMes}...`);

        // Mesclar com estado atual
        entradas = mesclarTransacoes(entradas || [], dadosMesFirebase.entradas || []);
        despesas = mesclarTransacoes(despesas || [], dadosMesFirebase.despesas || []);

        // Atualizar gastos avulsos do novo mês
        const gastosMesNovos = garantirIdsUnicos(dadosMesFirebase.gastosAvulsos || []).map(g => ({ ...g, mes: novoMes }));
        gastosAvulsos = (gastosAvulsos || []).filter(g => g.mes !== novoMes).concat(gastosMesNovos);

        // Persistir localmente o estado MERGIDO do mês
        const chaveMesFirebase = `${PREFIX_FIREBASE}${novoMes}`;
        const snapshotMes = {
            entradas,
            despesas,
            gastosAvulsos: gastosAvulsos.filter(g => g.mes === novoMes)
        };
        localStorage.setItem(chaveMesFirebase, JSON.stringify(snapshotMes));

        // Agendar render
        agendarRender();
        console.log(`✅ Merge em tempo real aplicado (${novoMes})`);
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

/**
 * Força resincronização completa - busca TODOS os dados do Firebase
 * e mescla com os dados locais. Útil para recuperar dados perdidos.
 */
async function forcarResincronizacaoCompleta() {
    if (!isFirebaseEnabled) {
        alert('Firebase não está habilitado');
        return;
    }

    try {
        console.log('🔄 Iniciando resincronização completa...');
        
        // Buscar TODOS os dados do Firebase
        const snapshot = await database.ref('dados-compartilhados').once('value');
        const dadosFirebase = snapshot.val();
        
        if (!dadosFirebase) {
            alert('Nenhum dado encontrado no Firebase');
            return;
        }
        
        // Mesclar dados do mês atual
        if (dadosFirebase.meses && dadosFirebase.meses[mesAtual]) {
            const dadosMesFirebase = dadosFirebase.meses[mesAtual];
            
            // Mesclar com dados locais
            const dadosLocais = {
                entradas: entradas || [],
                despesas: despesas || [],
                gastosAvulsos: gastosAvulsos.filter(g => g.mes === mesAtual) || []
            };
            
            const dadosMesclados = {
                entradas: mesclarTransacoes(dadosMesFirebase.entradas, dadosLocais.entradas),
                despesas: mesclarTransacoes(dadosMesFirebase.despesas, dadosLocais.despesas),
                gastosAvulsos: mesclarTransacoes(dadosMesFirebase.gastosAvulsos, dadosLocais.gastosAvulsos)
            };
            
            // Atualizar variáveis globais
            entradas = dadosMesclados.entradas;
            despesas = dadosMesclados.despesas;
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mesAtual);
            gastosAvulsos.push(...dadosMesclados.gastosAvulsos);
            
            // Salvar localmente
            const chaveMesFirebase = `${PREFIX_FIREBASE}${mesAtual}`;
            localStorage.setItem(chaveMesFirebase, JSON.stringify(dadosMesclados));
            
            // Salvar de volta no Firebase (garantir que todos os dados estão lá)
            await database.ref(`dados-compartilhados/meses/${mesAtual}`).set(dadosMesclados);
            
            console.log('✅ Dados do mês atual mesclados:', {
                entradas: dadosMesclados.entradas.length,
                despesas: dadosMesclados.despesas.length,
                gastosAvulsos: dadosMesclados.gastosAvulsos.length
            });
        }
        
        // Atualizar categorias
        if (dadosFirebase.categorias) {
            categorias = dadosFirebase.categorias;
            localStorage.setItem(CHAVE_CATEGORIAS_FIREBASE, JSON.stringify(categorias));
            renderizarCategorias();
        }
        
        // Atualizar poupança
        if (dadosFirebase.poupanca) {
            poupanca = dadosFirebase.poupanca;
            localStorage.setItem('contas-firebase-poupanca', JSON.stringify(poupanca));
            if (typeof renderizarPoupanca === 'function') {
                renderizarPoupanca();
            }
        }
        
        // Re-renderizar tudo
        if (typeof renderizarTudo === 'function') {
            renderizarTudo();
        }
        
        alert('✅ Resincronização completa realizada!\n\nTodos os dados foram recuperados e mesclados.');
        console.log('✅ Resincronização completa finalizada!');
        
    } catch (error) {
        console.error('❌ Erro na resincronização completa:', error);
        alert('❌ Erro ao resincronizar: ' + error.message);
    }
}

// ===== EXPORTAR FUNÇÕES =====
window.firebaseSync = {
    sincronizarMesParaFirebase,
    sincronizarCategoriasParaFirebase,
    sincronizarPoupancaParaFirebase,
    atualizarListenerMes,
    forcarResincronizacaoCompleta,
    isEnabled: () => isFirebaseEnabled,
    iniciarSincronizacao: () => {
        sincronizarDadosInicial();
        iniciarListenersSincronizacao();
    }
};

