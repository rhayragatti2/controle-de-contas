// ============================================
// SISTEMA DE RECUPERAÇÃO DE DADOS - EMERGÊNCIA
// ============================================

/**
 * DIAGNÓSTICO COMPLETO - Mostra TODOS os dados disponíveis
 */
async function diagnosticoCompleto() {
    console.log('🔍 ===== DIAGNÓSTICO COMPLETO =====');
    
    const diagnostico = {
        localStorage: {},
        firebase: {},
        timestamp: new Date().toISOString()
    };
    
    // 1. VERIFICAR LOCALSTORAGE
    console.log('\n📦 LocalStorage:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('contas-firebase')) {
            try {
                const value = JSON.parse(localStorage.getItem(key));
                diagnostico.localStorage[key] = value;
                
                if (key.includes('contas-firebase-2024')) {
                    console.log(`  ${key}:`, {
                        entradas: value.entradas?.length || 0,
                        despesas: value.despesas?.length || 0,
                        gastosAvulsos: value.gastosAvulsos?.length || 0
                    });
                }
            } catch (e) {
                console.log(`  ${key}: [erro ao parsear]`);
            }
        }
    }
    
    // 2. VERIFICAR FIREBASE
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        console.log('\n☁️ Firebase:');
        try {
            const snapshot = await firebase.database().ref('dados-compartilhados').once('value');
            const dadosFirebase = snapshot.val();
            diagnostico.firebase = dadosFirebase;
            
            if (dadosFirebase && dadosFirebase.meses) {
                Object.keys(dadosFirebase.meses).forEach(mes => {
                    const dados = dadosFirebase.meses[mes];
                    console.log(`  ${mes}:`, {
                        entradas: dados.entradas?.length || 0,
                        despesas: dados.despesas?.length || 0,
                        gastosAvulsos: dados.gastosAvulsos?.length || 0
                    });
                });
            }
        } catch (error) {
            console.error('❌ Erro ao buscar Firebase:', error);
        }
    }
    
    console.log('\n✅ Diagnóstico completo!');
    console.log('Dados completos salvos em: window.__diagnostico');
    window.__diagnostico = diagnostico;
    
    return diagnostico;
}

/**
 * CRIAR BACKUP COMPLETO DE EMERGÊNCIA
 */
function criarBackupEmergencia() {
    const backup = {
        timestamp: new Date().toISOString(),
        localStorage: {},
        usuario: 'backup-emergencia'
    };
    
    // Copiar TODO o localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('contas')) {
            backup.localStorage[key] = localStorage.getItem(key);
        }
    }
    
    // Salvar em arquivo
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-emergencia-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('✅ Backup de emergência criado!');
    mostrarToast('✅ Backup criado e baixado!', 'success');
}

/**
 * LIMPAR TUDO E RECARREGAR DO FIREBASE
 */
async function limparERecarregarFirebase() {
    if (!confirm('⚠️ ATENÇÃO!\n\nEsta ação vai:\n1. LIMPAR todo o localStorage\n2. RECARREGAR do Firebase\n\nAntes disso, um backup será criado.\n\nContinuar?')) {
        return;
    }
    
    try {
        // 1. Criar backup primeiro
        console.log('📦 Criando backup...');
        criarBackupEmergencia();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. Limpar localStorage (dados de contas)
        console.log('🧹 Limpando localStorage...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('contas-firebase')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // 3. Recarregar do Firebase
        console.log('☁️ Recarregando do Firebase...');
        if (window.firebaseSync && window.firebaseSync.isEnabled()) {
            await window.firebaseSync.iniciarSincronizacao();
        }
        
        // 4. Recarregar página
        console.log('✅ Recarregando página...');
        mostrarToast('✅ Dados recarregados! Atualizando página...', 'success');
        setTimeout(() => {
            location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('❌ Erro ao recarregar: ' + error.message);
    }
}

/**
 * MOSTRAR DADOS DO FIREBASE EM MODAL
 */
async function mostrarDadosFirebase() {
    if (!window.firebaseSync || !window.firebaseSync.isEnabled()) {
        alert('❌ Firebase não está habilitado');
        return;
    }
    
    try {
        mostrarToast('🔍 Buscando dados do Firebase...', 'info');
        
        const snapshot = await firebase.database().ref('dados-compartilhados').once('value');
        const dadosFirebase = snapshot.val();
        
        if (!dadosFirebase) {
            alert('⚠️ Firebase está VAZIO!\n\nNão há dados salvos na nuvem.');
            return;
        }
        
        let mensagem = '☁️ DADOS NO FIREBASE:\n\n';
        
        // Categorias
        if (dadosFirebase.categorias) {
            mensagem += `📁 Categorias: ${dadosFirebase.categorias.length}\n`;
        }
        
        // Poupança
        if (dadosFirebase.poupanca) {
            mensagem += `💰 Poupança: ${dadosFirebase.poupanca.length} movimentações\n`;
        }
        
        // Meses
        mensagem += '\n📅 MESES:\n';
        if (dadosFirebase.meses) {
            Object.keys(dadosFirebase.meses).sort().forEach(mes => {
                const dados = dadosFirebase.meses[mes];
                mensagem += `\n${mes}:\n`;
                mensagem += `  • Entradas: ${dados.entradas?.length || 0}\n`;
                mensagem += `  • Despesas: ${dados.despesas?.length || 0}\n`;
                mensagem += `  • Gastos Avulsos: ${dados.gastosAvulsos?.length || 0}\n`;
            });
        } else {
            mensagem += '  (nenhum mês salvo)\n';
        }
        
        alert(mensagem);
        console.log('📊 Dados completos do Firebase:', dadosFirebase);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('❌ Erro ao buscar dados: ' + error.message);
    }
}

/**
 * ENVIAR DADOS LOCAIS PARA FIREBASE (FORÇAR UPLOAD)
 */
async function forcarUploadLocal() {
    if (!confirm('⚠️ UPLOAD FORÇADO\n\nEsta ação vai:\n• Pegar TODOS os dados do seu localStorage\n• MESCLAR com o que está no Firebase\n• Salvar tudo junto\n\nContinuar?')) {
        return;
    }
    
    try {
        mostrarToast('📤 Iniciando upload...', 'info');
        
        // Buscar todos os meses do localStorage
        const mesesLocal = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('contas-firebase-2024')) {
                const mes = key.replace('contas-firebase-', '');
                try {
                    mesesLocal[mes] = JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    console.error(`Erro ao parsear ${key}:`, e);
                }
            }
        }
        
        console.log('📦 Dados locais encontrados:', Object.keys(mesesLocal));
        
        // Upload para Firebase (usando a função de merge)
        for (const mes of Object.keys(mesesLocal)) {
            console.log(`📤 Enviando ${mes}...`);
            if (window.firebaseSync) {
                await window.firebaseSync.sincronizarMesParaFirebase(mes, mesesLocal[mes]);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        mostrarToast('✅ Upload concluído!', 'success');
        alert('✅ Upload concluído!\n\nTodos os seus dados locais foram enviados e mesclados com o Firebase.');
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('❌ Erro no upload: ' + error.message);
    }
}

// ===== ADICIONAR BOTÕES DE RECUPERAÇÃO NO MENU =====
window.recuperacaoDados = {
    diagnosticoCompleto,
    criarBackupEmergencia,
    limparERecarregarFirebase,
    mostrarDadosFirebase,
    forcarUploadLocal
};

console.log('🆘 Sistema de Recuperação carregado!');
console.log('📝 Comandos disponíveis no console:');
console.log('  • window.recuperacaoDados.diagnosticoCompleto()');
console.log('  • window.recuperacaoDados.mostrarDadosFirebase()');
console.log('  • window.recuperacaoDados.forcarUploadLocal()');
console.log('  • window.recuperacaoDados.criarBackupEmergencia()');
console.log('  • window.recuperacaoDados.limparERecarregarFirebase()');

