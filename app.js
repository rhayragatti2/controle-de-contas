// ============================================
// CONTROLE DE CONTAS MENSAIS - App Principal V2.0
// ============================================

// ===== VARIÁVEIS GLOBAIS =====
let entradas = [];
let despesas = [];
let categorias = [];
let mesAtual = '';
let estadoEdicaoDespesa = -1;
let estadoEdicaoEntrada = -1;
let darkMode = false;

const CHAVE_CATEGORIAS = 'contas-categorias';
const CHAVE_DARK_MODE = 'contas-dark-mode';

// Paleta de cores Tailwind
const PALETA_CORES = [
    'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-fuchsia-500'
];

// Cores hexadecimais para gráficos
const PALETA_CORES_GRAFICO = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
    '#f97316', '#06b6d4', '#84cc16', '#d946ef'
];

// Variável global para o gráfico
let chartDespesas = null;

// ===== ELEMENTOS DO DOM =====
const formEntrada = document.getElementById('form-entrada');
const formDespesa = document.getElementById('form-despesa');
const tabelaEntradas = document.getElementById('tabela-entradas');
const tabelaDespesas = document.getElementById('tabela-despesas');
const seletorMes = document.getElementById('seletor-mes');
const formCategoria = document.getElementById('form-categoria');
const listaCategorias = document.getElementById('lista-categorias');
const entradaCategoria = document.getElementById('entrada-categoria');
const despesaCategoria = document.getElementById('despesa-categoria');
const btnRelatorio = document.getElementById('btn-relatorio');
const btnBackup = document.getElementById('btn-backup');
const btnExportar = document.getElementById('btn-exportar');
const btnSyncGastos = document.getElementById('btn-sync-gastos');
const alertasVencimento = document.getElementById('alertas-vencimento');

// Elementos de resumo
const totalEntradasEl = document.getElementById('total-entradas');
const totalPrevistoEl = document.getElementById('total-previsto');
const totalPagoEl = document.getElementById('total-pago');
const saldoEl = document.getElementById('saldo');

// ===== FUNÇÕES UTILITÁRIAS =====

/**
 * Formata valor para moeda brasileira
 */
const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};

/**
 * Formata data ISO para DD/MM
 */
const formatarData = (dataStr) => {
    if (!dataStr) return '---';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}`;
};

/**
 * Converte data DD/MM/AAAA para ISO (AAAA-MM-DD)
 */
const parseBRDateToISO = (brDateStr) => {
    if (!brDateStr) return '';
    const parts = brDateStr.split('/').map(p => p.trim());
    let dia, mes, ano;

    const [currentAno, currentMes] = mesAtual.split('-');

    if (parts.length === 1 && parts[0]) {
        dia = parts[0].padStart(2, '0');
        mes = currentMes;
        ano = currentAno;
    } else if (parts.length === 2) {
        dia = parts[0].padStart(2, '0');
        mes = parts[1].padStart(2, '0');
        ano = currentAno;
    } else if (parts.length === 3) {
        dia = parts[0].padStart(2, '0');
        mes = parts[1].padStart(2, '0');
        ano = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    } else {
        return '';
    }

    if (dia.length !== 2 || mes.length !== 2 || ano.length !== 4 || isNaN(new Date(`${ano}-${mes}-${dia}`))) {
        return '';
    }

    return `${ano}-${mes}-${dia}`;
};

/**
 * Converte data ISO para DD/MM/AAAA
 */
const formatISODateToBR = (isoDateStr) => {
    if (!isoDateStr) return '';
    const [ano, mes, dia] = isoDateStr.split('-');
    return `${dia}/${mes}/${ano}`;
};

/**
 * Parse tags de string separada por vírgula para array
 */
const parseTags = (tagsStr) => {
    if (!tagsStr || !tagsStr.trim()) return [];
    return tagsStr.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
};

/**
 * Cria despesas parceladas em múltiplos meses
 */
const criarDespesasParceladas = (despesa, parcelas) => {
    const [ano, mes, dia] = despesa.vencimento.split('-').map(Number);
    const valorParcela = despesa.previsto / parcelas;
    
    for (let i = 0; i < parcelas; i++) {
        let mesAtualParcela = mes + i;
        let anoAtualParcela = ano;
        
        // Ajusta ano se ultrapassar dezembro
        while (mesAtualParcela > 12) {
            mesAtualParcela -= 12;
            anoAtualParcela++;
        }
        
        const mesKey = `${anoAtualParcela}-${String(mesAtualParcela).padStart(2, '0')}`;
        const chave = getChaveMes(mesKey);
        
        // Carrega dados do mês
        const dadosMes = localStorage.getItem(chave);
        let dados = dadosMes ? JSON.parse(dadosMes) : { entradas: [], despesas: [] };
        
        // Cria parcela
        const novaDespesa = {
            descricao: `${despesa.descricao} (${i + 1}/${parcelas})`,
            vencimento: `${anoAtualParcela}-${String(mesAtualParcela).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
            dataPagamento: '',
            previsto: valorParcela,
            pago: 0,
            categoria: despesa.categoria,
            tags: despesa.tags || [],
            notas: despesa.notas || '',
            recorrente: false,
            parcelado: true,
            parcelaAtual: i + 1,
            totalParcelas: parcelas
        };
        
        dados.despesas.push(novaDespesa);
        localStorage.setItem(chave, JSON.stringify(dados));
    }
};

/**
 * Obtém cor Tailwind de uma categoria
 */
const getCorCategoria = (nomeCategoria) => {
    const cat = categorias.find(c => c.nome === nomeCategoria);
    return cat ? cat.cor : 'bg-gray-400';
};

/**
 * Obtém cor hexadecimal de uma categoria
 */
const getCorHexCategoria = (nomeCategoria) => {
    const index = categorias.findIndex(c => c.nome === nomeCategoria);
    return PALETA_CORES_GRAFICO[index % PALETA_CORES_GRAFICO.length] || '#9ca3af';
};

/**
 * Obtém nome do mês por extenso
 */
const obterNomeMes = (mesKey) => {
    if (!mesKey) return '---';
    const [ano, mes] = mesKey.split('-');
    const data = new Date(ano, mes - 1, 15);
    return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Sistema de notificação toast
 */
const mostrarToast = (mensagem, tipo = 'info') => {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMensagem = document.getElementById('toast-mensagem');

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toastIcon.textContent = icons[tipo] || icons.info;
    toastMensagem.textContent = mensagem;

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
};

// ===== MODO ESCURO =====

const toggleDarkMode = () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem(CHAVE_DARK_MODE, darkMode);
    
    // Atualiza ícone do botão
    const btn = document.getElementById('btn-dark-mode');
    if (btn) {
        btn.innerHTML = darkMode ? 
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>` :
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>`;
    }
};

const carregarDarkMode = () => {
    const saved = localStorage.getItem(CHAVE_DARK_MODE);
    darkMode = saved === 'true';
    document.body.classList.toggle('dark', darkMode);
    
    // Atualiza ícone do botão
    const btn = document.getElementById('btn-dark-mode');
    if (btn) {
        btn.innerHTML = darkMode ? 
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>` :
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>`;
    }
};

// ===== GERENCIAMENTO DE CATEGORIAS =====

const salvarCategorias = () => {
    const chave = 'contas-firebase-categorias';
    localStorage.setItem(chave, JSON.stringify(categorias));
    
    // Sincronizar com Firebase com indicador visual
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        mostrarIndicadorSincronizacao(true);
        window.firebaseSync.sincronizarCategoriasParaFirebase(categorias);
        setTimeout(() => mostrarIndicadorSincronizacao(false), 800);
    }
};

/**
 * Mostra/oculta indicador de sincronização
 */
const mostrarIndicadorSincronizacao = (mostrar) => {
    const indicator = document.getElementById('sync-indicator-firebase');
    const mainIndicator = document.getElementById('sync-indicator');
    
    if (indicator && mainIndicator) {
        if (mostrar) {
            indicator.classList.remove('hidden');
            mainIndicator.textContent = '';
        } else {
            indicator.classList.add('hidden');
            mainIndicator.textContent = '🌐 Sincronizado';
        }
    }
};

const carregarCategorias = () => {
    const chave = 'contas-firebase-categorias';
    const salvas = localStorage.getItem(chave);
    let categoriasCarregadas = [];

    if (salvas) {
        let carregadas = JSON.parse(salvas);

        if (carregadas.length > 0 && typeof carregadas[0] === 'string') {
            categoriasCarregadas = carregadas.map((nome, index) => ({
                nome: nome,
                cor: PALETA_CORES[index % PALETA_CORES.length]
            }));
        } else {
            categoriasCarregadas = carregadas;
        }
    } else {
        categoriasCarregadas = [
            { nome: 'Salário', cor: PALETA_CORES[0] },
            { nome: 'Moradia', cor: PALETA_CORES[1] },
            { nome: 'Alimentação', cor: PALETA_CORES[2] },
            { nome: 'Transporte', cor: PALETA_CORES[3] },
            { nome: 'Lazer', cor: PALETA_CORES[4] }
        ];
    }

    categorias = categoriasCarregadas;
    categorias.sort((a, b) => a.nome.localeCompare(b.nome));

    categorias = categorias.map((cat, index) => ({
        ...cat,
        cor: PALETA_CORES[index % PALETA_CORES.length]
    }));

    salvarCategorias();
    renderizarCategorias();
    popularDropdownsCategorias();
    popularFiltrosCategorias();
};

const atualizarCategoriaGlobalmente = (antigoNome, novoNome) => {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-') && key !== CHAVE_CATEGORIAS) {
            const dadosSalvos = localStorage.getItem(key);
            if (dadosSalvos) {
                let dados;
                try {
                    dados = JSON.parse(dadosSalvos);
                } catch (e) {
                    console.error(`Erro ao parsear dados para a chave ${key}`, e);
                    continue;
                }
                let dadosAlterados = false;
                if (dados.entradas) {
                    dados.entradas = dados.entradas.map(entrada => {
                        if (entrada.categoria === antigoNome) {
                            entrada.categoria = novoNome;
                            dadosAlterados = true;
                        }
                        return entrada;
                    });
                }
                if (dados.despesas) {
                    dados.despesas = dados.despesas.map(despesa => {
                        if (despesa.categoria === antigoNome) {
                            despesa.categoria = novoNome;
                            dadosAlterados = true;
                        }
                        return despesa;
                    });
                }
                if (dadosAlterados) {
                    localStorage.setItem(key, JSON.stringify(dados));
                }
            }
        }
    }
};

window.editarCategoria = (index) => {
    const antigoNome = categorias[index].nome;
    const itemEl = document.getElementById(`cat-item-${index}`);

    if (itemEl) {
        itemEl.classList.remove('ring-1', 'ring-inset');
        itemEl.classList.add('ring-2', 'ring-blue-500', 'shadow-md');

        itemEl.innerHTML = `
            <input type="text" id="cat-input-${index}" value="${antigoNome}" 
                   class="flex-grow p-1 border rounded focus:outline-none text-sm text-gray-800" 
                   onkeyup="if(event.key === 'Enter') salvarEdicaoCategoria(${index}, '${antigoNome}')" required>
            <button onclick="salvarEdicaoCategoria(${index}, '${antigoNome}')" 
                    class="text-green-600 font-semibold hover:text-green-800 text-sm ml-2">Salvar</button>
            <button onclick="renderizarCategorias()" 
                    class="text-red-500 font-semibold hover:text-red-700 text-sm ml-2">Cancelar</button>
        `;
        document.getElementById(`cat-input-${index}`).focus();
    }
};

window.salvarEdicaoCategoria = (index, antigoNome) => {
    const input = document.getElementById(`cat-input-${index}`);
    const itemEl = document.getElementById(`cat-item-${index}`);
    const novoNome = input.value.trim();

    if (!novoNome || novoNome === antigoNome) {
        renderizarCategorias();
        return;
    }

    const nomeExiste = categorias.some((cat, i) => cat.nome === novoNome && i !== index);

    if (nomeExiste) {
        mostrarToast('Esta categoria já existe!', 'error');
        renderizarCategorias();
        return;
    }

    categorias[index].nome = novoNome;
    categorias.sort((a, b) => a.nome.localeCompare(b.nome));
    salvarCategorias();

    atualizarCategoriaGlobalmente(antigoNome, novoNome);

    carregarDados(mesAtual);
    popularDropdownsCategorias();
    popularFiltrosCategorias();
    renderizarCategorias();

    mostrarToast(`Categoria '${antigoNome}' atualizada para '${novoNome}'`, 'success');
};

const renderizarCategorias = () => {
    listaCategorias.innerHTML = '';
    categorias.forEach((item, index) => {
        const tag = document.createElement('div');
        tag.id = `cat-item-${index}`;

        const baseColor = item.cor.split('-')[1];
        const bgColor = `bg-${baseColor}-100`;
        const textColor = `text-${baseColor}-800`;
        const ringColor = `ring-${baseColor}-300`;

        tag.className = `${bgColor} ${textColor} px-3 py-1 rounded-full flex items-center gap-2 transition-colors duration-200 ring-1 ring-inset ${ringColor} font-medium text-sm`;

        tag.innerHTML = `
            <span>${item.nome}</span>
            <button onclick="editarCategoria(${index})" 
                    class="text-${baseColor}-600 hover:text-${baseColor}-800 text-sm p-1 rounded-full transition-colors"
                    title="Editar Categoria">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
            </button>
            <button onclick="excluirCategoria(${index})" class="text-red-500 font-bold hover:text-red-700 text-sm ml-2" title="Excluir Categoria">
                ×
            </button>
        `;
        listaCategorias.appendChild(tag);
    });
};

const popularDropdownsCategorias = () => {
    entradaCategoria.innerHTML = '<option value="">Selecione uma categoria...</option>';
    despesaCategoria.innerHTML = '<option value="">Selecione uma categoria...</option>';

    categorias.forEach(item => {
        const optionEntrada = new Option(item.nome, item.nome);
        const optionDespesa = new Option(item.nome, item.nome);
        entradaCategoria.appendChild(optionEntrada);
        despesaCategoria.appendChild(optionDespesa);
    });
};

// Popular filtros de categoria
const popularFiltrosCategorias = () => {
    const filtroEntrada = document.getElementById('filtro-entrada-categoria');
    const filtroDespesa = document.getElementById('filtro-despesa-categoria');
    
    if (filtroEntrada) {
        const valorAtualEntrada = filtroEntrada.value;
        filtroEntrada.innerHTML = '<option value="">Todas categorias</option>';
        
        categorias.forEach(item => {
            const option = new Option(item.nome, item.nome);
            filtroEntrada.appendChild(option);
        });
        
        // Restaura valor selecionado se ainda existir
        if (valorAtualEntrada && categorias.some(c => c.nome === valorAtualEntrada)) {
            filtroEntrada.value = valorAtualEntrada;
        }
    }
    
    if (filtroDespesa) {
        const valorAtualDespesa = filtroDespesa.value;
        filtroDespesa.innerHTML = '<option value="">Todas categorias</option>';
        
        categorias.forEach(item => {
            const option = new Option(item.nome, item.nome);
            filtroDespesa.appendChild(option);
        });
        
        // Restaura valor selecionado se ainda existir
        if (valorAtualDespesa && categorias.some(c => c.nome === valorAtualDespesa)) {
            filtroDespesa.value = valorAtualDespesa;
        }
    }
};

formCategoria.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('categoria-nome');
    const nome = input.value.trim();
    const nomeExiste = categorias.some(cat => cat.nome === nome);

    if (nome && !nomeExiste) {
        const cor = PALETA_CORES[categorias.length % PALETA_CORES.length];

        categorias.push({ nome: nome, cor: cor });
        categorias.sort((a, b) => a.nome.localeCompare(b.nome));
        salvarCategorias();
        renderizarCategorias();
        popularDropdownsCategorias();
        popularFiltrosCategorias();
        input.value = '';
        mostrarToast(`Categoria '${nome}' adicionada!`, 'success');
    } else if (nomeExiste) {
        mostrarToast('Categoria já existe!', 'error');
    }
});

window.excluirCategoria = (index) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? As referências serão removidas de todas as transações.')) {
        return;
    }

    const nomeExcluido = categorias[index].nome;

    categorias.splice(index, 1);

    categorias = categorias.map((cat, idx) => ({
        ...cat,
        cor: PALETA_CORES[idx % PALETA_CORES.length]
    }));

    categorias.sort((a, b) => a.nome.localeCompare(b.nome));
    salvarCategorias();

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-') && key !== CHAVE_CATEGORIAS) {
            let dados = JSON.parse(localStorage.getItem(key));
            let dadosAlterados = false;

            if (dados.entradas) {
                dados.entradas = dados.entradas.map(entrada => {
                    if (entrada.categoria === nomeExcluido) {
                        entrada.categoria = '';
                        dadosAlterados = true;
                    }
                    return entrada;
                });
            }

            if (dados.despesas) {
                dados.despesas = dados.despesas.map(despesa => {
                    if (despesa.categoria === nomeExcluido) {
                        despesa.categoria = '';
                        dadosAlterados = true;
                    }
                    return despesa;
                });
            }
            if (dadosAlterados) {
                localStorage.setItem(key, JSON.stringify(dados));
            }
        }
    }

    popularDropdownsCategorias();
    popularFiltrosCategorias();
    renderizarCategorias();
    renderizarTudo();
    mostrarToast(`Categoria '${nomeExcluido}' excluída!`, 'success');
};

// ===== GERENCIAMENTO DE DADOS MENSAIS =====

const getChaveMes = (mes) => {
    return `contas-firebase-${mes}`;
};

const salvarDados = () => {
    if (!mesAtual) return;
    
    console.log('💾 Salvando dados...', {
        mesAtual,
        totalEntradas: entradas.length,
        totalDespesas: despesas.length,
        totalGastosAvulsos: gastosAvulsos.length
    });
    
    // Filtrar gastos avulsos do mês atual
    const gastosAvulsosMes = gastosAvulsos ? gastosAvulsos.filter(g => g.mes === mesAtual) : [];
    
    console.log('💾 Gastos avulsos do mês:', gastosAvulsosMes.length);
    
    const dados = {
        entradas: entradas,
        despesas: despesas,
        gastosAvulsos: gastosAvulsosMes
    };
    
    const chave = getChaveMes(mesAtual);
    localStorage.setItem(chave, JSON.stringify(dados));
    console.log('✅ Dados salvos no localStorage');
    
    // Sincronizar com Firebase com indicador visual
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        mostrarIndicadorSincronizacao(true);
        window.firebaseSync.sincronizarMesParaFirebase(mesAtual, dados);
        setTimeout(() => mostrarIndicadorSincronizacao(false), 800);
    }
};

// Salvar Poupança GLOBAL (acumulativa entre todos os meses)
const salvarPoupanca = () => {
    const chave = 'contas-firebase-poupanca';
    localStorage.setItem(chave, JSON.stringify(poupanca));
    
    // Sincronizar com Firebase
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        mostrarIndicadorSincronizacao(true);
        window.firebaseSync.sincronizarPoupancaParaFirebase(poupanca);
        setTimeout(() => mostrarIndicadorSincronizacao(false), 800);
    }
};

// Carregar Poupança GLOBAL
const carregarPoupanca = () => {
    const chave = 'contas-firebase-poupanca';
    const dadosSalvos = localStorage.getItem(chave);
    
    if (dadosSalvos) {
        poupanca = JSON.parse(dadosSalvos);
    } else {
        // Migração: buscar poupança antiga de todos os meses
        poupanca = [];
        const todasChaves = Object.keys(localStorage);
        const chavesMeses = todasChaves.filter(k => k.startsWith('contas-firebase-') && k.match(/\d{4}-\d{2}$/));
        
        chavesMeses.forEach(chaveMes => {
            try {
                const dadosMes = JSON.parse(localStorage.getItem(chaveMes));
                if (dadosMes.poupanca && Array.isArray(dadosMes.poupanca) && dadosMes.poupanca.length > 0) {
                    poupanca = poupanca.concat(dadosMes.poupanca);
                    
                    // Remove poupança do mês antigo
                    delete dadosMes.poupanca;
                    localStorage.setItem(chaveMes, JSON.stringify(dadosMes));
                }
            } catch (e) {
                console.error(`Erro ao migrar poupança de ${chaveMes}:`, e);
            }
        });
        
        // Salva poupança consolidada no formato global
        if (poupanca.length > 0) {
            salvarPoupanca();
            console.log(`✅ Migração concluída: ${poupanca.length} movimentações de poupança consolidadas`);
        }
    }
    
    renderizarPoupanca();
};

const carregarDados = (mes) => {
    if (!mes) return;
    mesAtual = mes;
    estadoEdicaoDespesa = -1;
    estadoEdicaoEntrada = -1;
    
    const chave = getChaveMes(mes);
    const dadosSalvos = localStorage.getItem(chave);

    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        entradas = dados.entradas || [];
        despesas = dados.despesas || [];
        
        // Carregar gastos avulsos da mesma estrutura de dados
        if (dados.gastosAvulsos && Array.isArray(dados.gastosAvulsos)) {
            // Atualizar o array global mantendo gastos de outros meses
            gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mes);
            gastosAvulsos.push(...dados.gastosAvulsos);
        }
    } else {
        entradas = [];
        despesas = [];
        // Remover gastos avulsos deste mês se não há dados salvos
        gastosAvulsos = gastosAvulsos.filter(g => g.mes !== mes);
    }
    
    // Adicionar IDs aos gastos avulsos antigos que não têm ID
    adicionarIDsGastosAvulsos();
    
    // Poupança é GLOBAL, não precisa carregar por mês
    // (será carregada uma única vez no início)

    renderizarTudo();
    verificarVencimentos();
    
    // Atualizar listener do Firebase para o novo mês
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        window.firebaseSync.atualizarListenerMes(mes);
    }
};

const renderizarTudo = () => {
    renderizarEntradas();
    renderizarPoupanca();
    renderizarDespesas();
    renderizarGastosAvulsos();
    atualizarResumo();
    atualizarDashboardEstatisticas();
};

// ===== RESUMO MENSAL =====

const atualizarResumo = () => {
    // 1. ENTRADAS (Receitas)
    const totalEntradas = entradas.reduce((acc, item) => acc + item.valor, 0);
    
    // 2. DESPESAS - Separar Fixos e Avulsos
    const totalPrevistoFixos = despesas.reduce((acc, item) => acc + item.previsto, 0);
    const totalPagoFixos = despesas.reduce((acc, item) => acc + item.pago, 0);
    
    // Gastos Avulsos (não planejados - entra direto no pago)
    let totalGastosAvulsos = 0;
    if (gastosAvulsos && gastosAvulsos.length > 0) {
        const gastosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
        totalGastosAvulsos = gastosMes.reduce((acc, g) => acc + g.valor, 0);
    }
    
    // Total Geral de Despesas
    const totalPrevisto = totalPrevistoFixos; // Gastos avulsos NÃO entram no previsto
    const totalPago = totalPagoFixos + totalGastosAvulsos; // Gastos avulsos SÓ entram no pago
    
    // 3. SALDO DISPONÍVEL (Entradas - Despesas Pagas)
    const saldoDisponivel = totalEntradas - totalPago;
    
    // 4. POUPANÇA (Movimentação)
    const totalDepositos = poupanca.filter(p => p.tipo === 'deposito').reduce((acc, p) => acc + p.valor, 0);
    const totalRetiradas = poupanca.filter(p => p.tipo === 'retirada').reduce((acc, p) => acc + p.valor, 0);
    const saldoPoupanca = totalDepositos - totalRetiradas;
    
    // 5. SALDO FINAL DO MÊS (Disponível - Depósitos + Retiradas)
    const saldoFinalMaos = saldoDisponivel - totalDepositos + totalRetiradas;
    
    // Atualizar elementos no DOM
    const totalEntradasEl = document.getElementById('total-entradas');
    const totalPrevistoEl = document.getElementById('total-previsto');
    const totalPagoEl = document.getElementById('total-pago');
    const totalPrevistoFixosEl = document.getElementById('total-previsto-fixos');
    const totalPagoFixosEl = document.getElementById('total-pago-fixos');
    const totalGastosAvulsosEl = document.getElementById('total-gastos-avulsos');
    const saldoDisponivelEl = document.getElementById('saldo-disponivel');
    const totalDepositosResumoEl = document.getElementById('total-depositos-poupanca-resumo');
    const totalRetiradasResumoEl = document.getElementById('total-retiradas-poupanca-resumo');
    const saldoPoupancaResumoEl = document.getElementById('saldo-poupanca-resumo');
    const saldoFinalMaosEl = document.getElementById('saldo-final-maos');
    
    if (totalEntradasEl) totalEntradasEl.textContent = formatarMoeda(totalEntradas);
    if (totalPrevistoEl) totalPrevistoEl.textContent = formatarMoeda(totalPrevisto);
    if (totalPagoEl) totalPagoEl.textContent = formatarMoeda(totalPago);
    if (totalPrevistoFixosEl) totalPrevistoFixosEl.textContent = formatarMoeda(totalPrevistoFixos);
    if (totalPagoFixosEl) totalPagoFixosEl.textContent = formatarMoeda(totalPagoFixos);
    if (totalGastosAvulsosEl) totalGastosAvulsosEl.textContent = formatarMoeda(totalGastosAvulsos);
    if (saldoDisponivelEl) {
        saldoDisponivelEl.textContent = formatarMoeda(saldoDisponivel);
        saldoDisponivelEl.classList.remove('text-purple-600', 'text-red-600', 'text-green-600');
        if (saldoDisponivel > 0) {
            saldoDisponivelEl.classList.add('text-purple-600');
        } else if (saldoDisponivel < 0) {
            saldoDisponivelEl.classList.add('text-red-600');
        } else {
            saldoDisponivelEl.classList.add('text-purple-600');
        }
    }
    if (totalDepositosResumoEl) totalDepositosResumoEl.textContent = formatarMoeda(totalDepositos);
    if (totalRetiradasResumoEl) totalRetiradasResumoEl.textContent = formatarMoeda(totalRetiradas);
    if (saldoPoupancaResumoEl) saldoPoupancaResumoEl.textContent = formatarMoeda(saldoPoupanca);
    if (saldoFinalMaosEl) {
        saldoFinalMaosEl.textContent = formatarMoeda(saldoFinalMaos);
        saldoFinalMaosEl.classList.remove('text-green-600', 'text-red-600', 'text-gray-800');
        if (saldoFinalMaos > 0) {
            saldoFinalMaosEl.classList.add('text-green-600');
        } else if (saldoFinalMaos < 0) {
            saldoFinalMaosEl.classList.add('text-red-600');
        } else {
            saldoFinalMaosEl.classList.add('text-gray-800');
        }
    }
};

// ===== DASHBOARD DE ESTATÍSTICAS =====

const atualizarDashboardEstatisticas = () => {
    console.log('📊 Atualizando Dashboard de Estatísticas...');
    
    // 1. MAIOR DESPESA
    let maiorDespesa = { descricao: '---', valor: 0 };
    if (despesas.length > 0) {
        maiorDespesa = despesas.reduce((max, despesa) => {
            return despesa.previsto > max.valor ? { descricao: despesa.descricao, valor: despesa.previsto } : max;
        }, { descricao: '---', valor: 0 });
    }
    
    const maiorDespesaEl = document.getElementById('maior-despesa');
    const maiorDespesaValorEl = document.getElementById('maior-despesa-valor');
    if (maiorDespesaEl && maiorDespesaValorEl) {
        maiorDespesaEl.textContent = maiorDespesa.descricao;
        maiorDespesaValorEl.textContent = maiorDespesa.valor > 0 ? formatarMoeda(maiorDespesa.valor) : '---';
    }
    
    // 2. CATEGORIA TOP (maior total de gastos por categoria)
    const gastoPorCategoria = {};
    
    // Somar despesas fixas por categoria
    despesas.forEach(despesa => {
        const cat = despesa.categoria || 'Sem categoria';
        gastoPorCategoria[cat] = (gastoPorCategoria[cat] || 0) + despesa.previsto;
    });
    
    // Somar gastos avulsos por categoria
    const gastosAvulsosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
    gastosAvulsosMes.forEach(gasto => {
        const cat = gasto.categoria || 'Sem categoria';
        gastoPorCategoria[cat] = (gastoPorCategoria[cat] || 0) + gasto.valor;
    });
    
    // Encontrar categoria com maior total
    let categoriaTop = { nome: '---', valor: 0 };
    Object.entries(gastoPorCategoria).forEach(([categoria, valor]) => {
        if (valor > categoriaTop.valor) {
            categoriaTop = { nome: categoria, valor: valor };
        }
    });
    
    const categoriaTopEl = document.getElementById('categoria-top');
    const categoriaTopValorEl = document.getElementById('categoria-top-valor');
    if (categoriaTopEl && categoriaTopValorEl) {
        categoriaTopEl.textContent = categoriaTop.nome;
        categoriaTopValorEl.textContent = categoriaTop.valor > 0 ? formatarMoeda(categoriaTop.valor) : '---';
    }
    
    // 3. MÉDIA DIÁRIA (Total gasto dividido pelos dias do mês até hoje)
    const totalDespesasPagas = despesas.reduce((acc, item) => acc + item.pago, 0);
    const totalGastosAvulsosMes = gastosAvulsosMes.reduce((acc, g) => acc + g.valor, 0);
    const totalGasto = totalDespesasPagas + totalGastosAvulsosMes;
    
    // Calcular dias decorridos no mês atual
    const hoje = new Date();
    const [anoMes, mesMes] = mesAtual.split('-').map(Number);
    const hojeMesmoMes = (hoje.getFullYear() === anoMes && (hoje.getMonth() + 1) === mesMes);
    const diasDecorridos = hojeMesmoMes ? hoje.getDate() : new Date(anoMes, mesMes, 0).getDate();
    
    const mediaDiaria = diasDecorridos > 0 ? totalGasto / diasDecorridos : 0;
    
    const mediaDiariaEl = document.getElementById('media-diaria');
    if (mediaDiariaEl) {
        mediaDiariaEl.textContent = formatarMoeda(mediaDiaria);
    }
    
    console.log('✅ Dashboard atualizado:', {
        maiorDespesa: maiorDespesa.descricao,
        categoriaTop: categoriaTop.nome,
        mediaDiaria: formatarMoeda(mediaDiaria)
    });
};

// ===== ENTRADAS =====

const renderizarEntradas = () => {
    console.log('🎨 Renderizando entradas:', entradas.length, 'itens');
    tabelaEntradas.innerHTML = '';
    entradas.forEach((item, index) => {
        const corCategoria = getCorCategoria(item.categoria);

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        
        // Modo de edição inline
        if (index === estadoEdicaoEntrada) {
            tr.classList.add('bg-blue-50', 'dark:bg-blue-900');
            tr.innerHTML = `
                <td class="p-2 text-center">
                    <button onclick="salvarEdicaoInlineEntrada(${index})" 
                            class="bg-green-600 text-white w-8 h-8 rounded hover:bg-green-700 flex items-center justify-center mx-auto" title="Salvar">
                        ✓
                    </button>
                </td>
                <td class="p-2">
                    <input type="text" id="edit-entrada-descricao-${index}" value="${item.descricao}" 
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2">
                    <input type="number" id="edit-entrada-valor-${index}" value="${item.valor}" 
                           step="0.01" min="0"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm text-right">
                </td>
                <td class="p-2">
                    <select id="edit-entrada-categoria-${index}" 
                            class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                        ${categorias.map(cat => `<option value="${typeof cat === 'object' ? cat.nome : cat}" ${item.categoria === (typeof cat === 'object' ? cat.nome : cat) ? 'selected' : ''}>${typeof cat === 'object' ? cat.nome : cat}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <input type="text" id="edit-entrada-data-${index}" value="${formatISODateToBR(item.data)}" 
                           placeholder="DD/MM/AAAA"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2">
                    <input type="text" id="edit-entrada-observacoes-${index}" value="${item.observacoes || ''}" 
                           placeholder="Observações"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2 text-center">
                    <button onclick="cancelarEdicaoInlineEntrada()" 
                            class="bg-gray-400 text-white w-8 h-8 rounded hover:bg-gray-500 flex items-center justify-center mx-auto" title="Cancelar">
                        ✕
                    </button>
                </td>
            `;
        } else {
            // Modo visualização normal
            tr.innerHTML = `
                <td class="p-3 text-center">
                    <button onclick="editarEntrada(${index})" class="text-blue-500 hover:text-blue-700 text-xl" title="Editar">
                        ✏️
                    </button>
                </td>
                <td class="p-3 dark:text-gray-300">${item.descricao}</td>
                <td class="p-3 text-right text-green-600 dark:text-green-400 font-bold text-lg">${formatarMoeda(item.valor)}</td>
                <td class="p-3 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                    <span>${item.categoria || '---'}</span>
                </td>
                <td class="p-3 text-gray-600 dark:text-gray-400">${formatarData(item.data)}</td>
                <td class="p-3 text-gray-500 dark:text-gray-400 text-sm">${item.observacoes || '---'}</td>
                <td class="p-3 text-center">
                    <button onclick="excluirEntrada(${index})" class="text-red-500 hover:text-red-700 text-xl" title="Excluir">
                        🗑️
                    </button>
                </td>
            `;
        }
        tabelaEntradas.appendChild(tr);
    });
};

window.editarEntrada = (index) => {
    estadoEdicaoEntrada = index;
    renderizarEntradas();
};

window.salvarEdicaoInlineEntrada = (index) => {
    const data = parseBRDateToISO(document.getElementById(`edit-entrada-data-${index}`).value);
    const descricao = document.getElementById(`edit-entrada-descricao-${index}`).value.trim();
    const categoria = document.getElementById(`edit-entrada-categoria-${index}`).value;
    const observacoes = document.getElementById(`edit-entrada-observacoes-${index}`).value.trim();
    const valor = parseFloat(document.getElementById(`edit-entrada-valor-${index}`).value);

    if (!descricao || valor <= 0 || !data) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    entradas[index] = { data, descricao, valor, categoria, observacoes };
    estadoEdicaoEntrada = -1;
    salvarDados();
    renderizarEntradas();
    atualizarResumo();
    mostrarToast('Entrada atualizada!', 'success');
};

window.cancelarEdicaoInlineEntrada = () => {
    estadoEdicaoEntrada = -1;
    renderizarEntradas();
};

formEntrada.addEventListener('submit', (e) => {
    e.preventDefault();
    const descricao = document.getElementById('entrada-descricao').value.trim();
    const data = parseBRDateToISO(document.getElementById('entrada-data').value);
    const valor = parseFloat(document.getElementById('entrada-valor').value);
    const categoria = document.getElementById('entrada-categoria').value;
    const idEdicao = document.getElementById('entrada-id-edicao').value;

    console.log('📝 Formulário de entrada submetido:', { descricao, data, valor, categoria });

    if (!descricao || valor <= 0 || !data) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    if (idEdicao !== '') {
        // Modo edição
        const index = parseInt(idEdicao);
        entradas[index] = { data, descricao, valor, categoria };
        console.log('✏️ Entrada editada no índice', index);
        mostrarToast('Entrada atualizada!', 'success');
        document.getElementById('entrada-btn-texto').textContent = 'Adicionar Entrada';
        document.getElementById('entrada-id-edicao').value = '';
        estadoEdicaoEntrada = -1;
    } else {
        // Modo adição
        const novaEntrada = { data, descricao, valor, categoria };
        entradas.push(novaEntrada);
        console.log('➕ Nova entrada adicionada:', novaEntrada);
        console.log('📊 Total de entradas agora:', entradas.length);
        mostrarToast('Entrada adicionada!', 'success');
    }

    console.log('💾 Chamando salvarDados()...');
    salvarDados();
    console.log('🎨 Chamando renderizarEntradas()...');
    renderizarEntradas();
    console.log('✅ Processo de entrada completo');
    formEntrada.reset();
});

window.excluirEntrada = (index) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return;

    entradas.splice(index, 1);
    salvarDados();
    renderizarEntradas();
    mostrarToast('Entrada excluída!', 'success');
};

// ===== DESPESAS =====

window.editarPagamento = (index) => {
    estadoEdicaoDespesa = index;
    renderizarDespesas();
};

window.cancelarEdicao = () => {
    estadoEdicaoDespesa = -1;
    renderizarDespesas();
};

window.salvarPagamento = (index) => {
    const dataInput = document.getElementById('input-pagamento-data');
    const valorInput = document.getElementById('input-pagamento-valor');

    let novaData = parseBRDateToISO(dataInput.value);
    let novoValor = parseFloat(valorInput.value);

    if (isNaN(novoValor) || novoValor < 0) {
        mostrarToast('Valor pago inválido!', 'error');
        return;
    }

    if (novoValor === 0 || !novaData) {
        despesas[index].dataPagamento = '';
        despesas[index].pago = 0;
    } else {
        despesas[index].dataPagamento = novaData;
        despesas[index].pago = novoValor;
    }

    salvarDados();
    estadoEdicaoDespesa = -1;
    renderizarDespesas();
    verificarVencimentos();
    mostrarToast('Pagamento registrado!', 'success');
};

let estadoEdicaoCompletaDespesa = -1;

window.editarDespesa = (index) => {
    estadoEdicaoCompletaDespesa = index;
    renderizarDespesas();
};

window.salvarEdicaoInlineDespesa = (index) => {
    const descricao = document.getElementById(`edit-despesa-descricao-${index}`).value.trim();
    const vencimento = parseBRDateToISO(document.getElementById(`edit-despesa-vencimento-${index}`).value);
    const previsto = parseFloat(document.getElementById(`edit-despesa-previsto-${index}`).value);
    const categoria = document.getElementById(`edit-despesa-categoria-${index}`).value;
    const notas = document.getElementById(`edit-despesa-notas-${index}`).value.trim();

    if (!descricao || previsto <= 0 || !vencimento) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    despesas[index].descricao = descricao;
    despesas[index].vencimento = vencimento;
    despesas[index].previsto = previsto;
    despesas[index].categoria = categoria;
    despesas[index].notas = notas;

    estadoEdicaoCompletaDespesa = -1;
    salvarDados();
    renderizarDespesas();
    atualizarResumo();
    verificarVencimentos();
    mostrarToast('Despesa atualizada!', 'success');
};

window.cancelarEdicaoInlineDespesa = () => {
    estadoEdicaoCompletaDespesa = -1;
    renderizarDespesas();
};

const renderizarDespesas = () => {
    console.log('🎨 Renderizando despesas:', despesas.length, 'itens');
    tabelaDespesas.innerHTML = '';
    despesas.forEach((item, index) => {
        const corCategoria = getCorCategoria(item.categoria);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';

        const estaPago = item.pago > 0 && item.dataPagamento;
        const pagoClasseDataValor = estaPago ? 'text-gray-400 line-through' : '';

        // Modo de edição completa (inline)
        if (index === estadoEdicaoCompletaDespesa) {
            tr.classList.add('bg-blue-50', 'dark:bg-blue-900');
            tr.innerHTML = `
                <td class="p-2 text-center">
                    <button onclick="salvarEdicaoInlineDespesa(${index})" 
                            class="bg-green-600 text-white w-8 h-8 rounded hover:bg-green-700 flex items-center justify-center mx-auto" title="Salvar">
                        ✓
                    </button>
                </td>
                <td class="p-2">
                    <input type="text" id="edit-despesa-descricao-${index}" value="${item.descricao}" 
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2">
                    <input type="number" id="edit-despesa-previsto-${index}" value="${item.previsto}" 
                           step="0.01" min="0"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm text-right">
                </td>
                <td class="p-2">
                    <input type="number" value="${item.pago}" 
                           disabled
                           class="w-full p-2 border rounded bg-gray-100 dark:bg-gray-600 text-gray-500 text-sm text-right">
                </td>
                <td class="p-2">
                    <select id="edit-despesa-categoria-${index}" 
                            class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                        ${categorias.map(cat => `<option value="${typeof cat === 'object' ? cat.nome : cat}" ${item.categoria === (typeof cat === 'object' ? cat.nome : cat) ? 'selected' : ''}>${typeof cat === 'object' ? cat.nome : cat}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <input type="text" id="edit-despesa-vencimento-${index}" value="${formatISODateToBR(item.vencimento)}" 
                           placeholder="DD/MM/AAAA"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2">
                    <input type="text" value="${formatISODateToBR(item.dataPagamento) || '---'}" 
                           disabled
                           class="w-full p-2 border rounded bg-gray-100 dark:bg-gray-600 text-gray-500 text-sm">
                </td>
                <td class="p-2">
                    <input type="text" id="edit-despesa-notas-${index}" value="${item.notas || ''}" 
                           placeholder="Observações"
                           class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm">
                </td>
                <td class="p-2 text-center" colspan="2">
                    <button onclick="cancelarEdicaoInlineDespesa()" 
                            class="bg-gray-400 text-white w-8 h-8 rounded hover:bg-gray-500 flex items-center justify-center mx-auto" title="Cancelar">
                        ✕
                    </button>
                </td>
            `;
        } else if (index === estadoEdicaoDespesa) {
            tr.classList.add('bg-yellow-50', 'shadow-inner');
            tr.innerHTML = `
                <td class="p-3 text-center">
                    <button onclick="salvarPagamento(${index})" 
                            class="bg-green-600 text-white w-8 h-8 rounded hover:bg-green-700 flex items-center justify-center mx-auto" title="Salvar Pagamento">
                        ✓
                    </button>
                </td>
                <td colspan="7" class="p-3">
                    <div class="flex flex-col md:flex-row gap-2 items-center w-full">
                        <span class="font-semibold mr-2">${item.descricao}</span>
                        <label class="font-medium text-sm text-gray-700 w-full md:w-auto flex-shrink-0">Pago em:</label>
                        <input type="text" id="input-pagamento-data" 
                               value="${formatISODateToBR(item.dataPagamento) || ''}" 
                               placeholder="DD/MM/AAAA"
                               class="p-1 border rounded w-full md:w-36 text-sm">
                        
                        <label class="font-medium text-sm text-gray-700 w-full md:w-auto flex-shrink-0">Valor Pago:</label>
                        <input type="number" id="input-pagamento-valor" value="${item.pago || item.previsto}" 
                               min="0" step="0.01" class="p-1 border rounded w-full md:w-28 text-sm text-right">
                    </div>
                </td>
                <td class="p-3 text-center" colspan="2">
                    <button onclick="cancelarEdicao()" 
                            class="bg-gray-400 text-white w-8 h-8 rounded hover:bg-gray-500 flex items-center justify-center mx-auto" title="Cancelar">
                        ✕
                    </button>
                </td>
            `;
        } else {
            // Criar badges
            let badges = '';
            if (item.debitoAutomatico) {
                badges += '<span class="badge-debito-automatico ml-2">🏦 Débito Automático</span>';
            }
            if (item.recorrente && !item.debitoAutomatico) {
                badges += '<span class="badge-recorrente ml-2" title="Recorrente">🔄</span>';
            }
            if (item.parcelado) {
                badges += '<span class="badge-parcelado ml-2">💳 Parcelado</span>';
            }
            
            tr.innerHTML = `
                <td class="p-3 text-center">
                    <button onclick="editarDespesa(${index})" class="text-blue-500 hover:text-blue-700 text-xl" title="Editar Despesa">
                        ✏️
                    </button>
                </td>
                <td class="p-3">
                    <div class="flex items-center flex-wrap gap-1">
                        <span>${item.descricao}</span>
                        ${badges}
                    </div>
                </td>
                <td class="p-3 text-right text-red-500 dark:text-red-400 ${pagoClasseDataValor} font-bold text-lg">
                    ${formatarMoeda(item.previsto)}
                </td>
                <td class="p-3 text-right font-bold text-lg ${item.pago > 0 ? 'text-red-700 dark:text-red-500' : 'text-gray-400'}">
                    ${formatarMoeda(item.pago)}
                </td>
                <td class="p-3 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                    <span>${item.categoria || '---'}</span>
                </td>
                <td class="p-3 font-medium text-gray-700 dark:text-gray-300 ${pagoClasseDataValor}">${formatarData(item.vencimento)}</td>
                <td class="p-3 ${estaPago ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 italic'}">${formatarData(item.dataPagamento)}</td>
                <td class="p-3 text-gray-500 dark:text-gray-400 text-sm">${item.observacoes || '---'}</td>
                <td class="p-3 text-center">
                    <button onclick="editarPagamento(${index})" 
                            class="bg-yellow-500 text-white w-8 h-8 rounded hover:bg-yellow-600 flex items-center justify-center mx-auto text-lg" 
                            title="${estaPago ? 'Editar Pagamento' : 'Registrar Pagamento'}">
                        💰
                    </button>
                </td>
                <td class="p-3 text-center">
                    <button onclick="excluirDespesa(${index})" class="text-red-500 hover:text-red-700 text-xl" title="Excluir">
                        🗑️
                    </button>
                </td>
            `;
        }
        tabelaDespesas.appendChild(tr);
    });
    
    // Calcular e atualizar totais dos gastos fixos
    const totalPrevisto = despesas.reduce((acc, item) => acc + item.previsto, 0);
    const totalPago = despesas.reduce((acc, item) => acc + item.pago, 0);
    
    const totalPrevistoEl = document.getElementById('total-previsto-fixos');
    const totalPagoEl = document.getElementById('total-pago-fixos');
    
    if (totalPrevistoEl) totalPrevistoEl.textContent = formatarMoeda(totalPrevisto);
    if (totalPagoEl) totalPagoEl.textContent = formatarMoeda(totalPago);
};

formDespesa.addEventListener('submit', (e) => {
    e.preventDefault();
    const descricao = document.getElementById('despesa-descricao').value.trim();
    const vencimento = parseBRDateToISO(document.getElementById('despesa-vencimento').value);
    const previsto = parseFloat(document.getElementById('despesa-previsto').value);
    const categoria = document.getElementById('despesa-categoria').value;
    const tags = parseTags(document.getElementById('despesa-tags').value);
    const notas = document.getElementById('despesa-notas').value.trim();
    let recorrente = document.getElementById('despesa-recorrente').checked;
    const debitoAutomatico = document.getElementById('despesa-debito-automatico').checked;
    const parcelada = document.getElementById('despesa-parcelada').checked;
    const parcelas = parseInt(document.getElementById('despesa-parcelas').value) || 0;
    const idEdicao = document.getElementById('despesa-id-edicao').value;
    
    // Lógica do Débito Automático: deve ser sempre recorrente
    if (debitoAutomatico) {
        recorrente = true;
    }

    if (!descricao || !vencimento || previsto <= 0) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    if (parcelada && (parcelas < 2 || parcelas > 48)) {
        mostrarToast('Para parcelamento, informe entre 2 e 48 parcelas!', 'error');
        return;
    }

    if (idEdicao !== '') {
        // Modo edição
        const index = parseInt(idEdicao);
        despesas[index].descricao = descricao;
        despesas[index].vencimento = vencimento;
        despesas[index].previsto = previsto;
        despesas[index].categoria = categoria;
        despesas[index].tags = tags;
        despesas[index].notas = notas;
        despesas[index].recorrente = recorrente;
        despesas[index].debitoAutomatico = debitoAutomatico;
        
        // Lógica do Débito Automático: marca como pago automaticamente
        if (debitoAutomatico) {
            despesas[index].pago = previsto;
            despesas[index].dataPagamento = vencimento;
        }
        
        // Não altera parcelamento em edição
        mostrarToast('Despesa atualizada!', 'success');
        document.getElementById('despesa-btn-texto').textContent = 'Adicionar Despesa (Planejamento)';
        document.getElementById('despesa-id-edicao').value = '';
        salvarDados();
        renderizarDespesas();
    } else {
        // Modo adição
        if (parcelada && parcelas > 0) {
            // Criar despesas parceladas
            const despesaBase = {
                descricao,
                vencimento,
                dataPagamento: '',
                previsto,
                pago: 0,
                categoria,
                tags,
                notas,
                recorrente: false // Parcelas não podem ser recorrentes
            };
            criarDespesasParceladas(despesaBase, parcelas);
            mostrarToast(`${parcelas} parcelas criadas com sucesso!`, 'success');
            carregarDados(mesAtual); // Recarrega para mostrar a primeira parcela
        } else {
            // Despesa normal, recorrente ou débito automático
            const novaDespesa = {
                descricao,
                vencimento,
                dataPagamento: debitoAutomatico ? vencimento : '',
                previsto,
                pago: debitoAutomatico ? previsto : 0,
                categoria,
                tags,
                notas,
                recorrente,
                parcelado: false,
                debitoAutomatico
            };
            
            despesas.push(novaDespesa);
            
            if (debitoAutomatico) {
                mostrarToast('💳 Débito Automático adicionado! Já marcado como pago e recorrente.', 'success');
            } else if (recorrente) {
                mostrarToast('Despesa recorrente adicionada! Use o botão roxo para copiar para o próximo mês.', 'success');
            } else {
                mostrarToast('Despesa adicionada!', 'success');
            }
            
            salvarDados();
            renderizarDespesas();
        }
    }

    verificarVencimentos();
    formDespesa.reset();
    // Reseta o campo de parcelas
    document.getElementById('despesa-parcelas').disabled = true;
    document.getElementById('despesa-parcelas').value = '';
});

window.excluirDespesa = (index) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

    despesas.splice(index, 1);
    salvarDados();
    renderizarDespesas();
    verificarVencimentos();
    mostrarToast('Despesa excluída!', 'success');
};

// ===== ALERTAS DE VENCIMENTO =====

const verificarVencimentos = () => {
    if (!mesAtual) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const despesasVencendo = despesas.filter(d => {
        if (d.pago > 0) return false; // Já paga

        const dataVencimento = new Date(d.vencimento + 'T00:00:00');
        const diffDias = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

        return diffDias >= 0 && diffDias <= 5; // Vence em até 5 dias
    });

    alertasVencimento.innerHTML = '';

    if (despesasVencendo.length > 0) {
        despesasVencendo.forEach(despesa => {
            const dataVencimento = new Date(despesa.vencimento + 'T00:00:00');
            const diffDias = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

            let corAlerta = 'border-yellow-500 bg-yellow-50';
            let textoAlerta = `Vence em ${diffDias} dia(s)`;

            if (diffDias === 0) {
                corAlerta = 'border-red-500 bg-red-50 pulse';
                textoAlerta = 'Vence HOJE!';
            } else if (diffDias === 1) {
                corAlerta = 'border-orange-500 bg-orange-50';
                textoAlerta = 'Vence AMANHÃ!';
            }

            const alerta = document.createElement('div');
            alerta.className = `alerta-vencimento ${corAlerta} p-4 rounded-lg mb-2 flex justify-between items-center`;
            alerta.innerHTML = `
                <div>
                    <span class="font-semibold text-gray-800">${despesa.descricao}</span>
                    <span class="text-gray-600 ml-2">${formatarMoeda(despesa.previsto)}</span>
                </div>
                <span class="font-bold text-gray-800">${textoAlerta}</span>
            `;
            alertasVencimento.appendChild(alerta);
        });
    }
};

// ===== RELATÓRIOS =====

let relatorioMesPrincipal = '';
let modoRelatorio = 'unico';

const obterTodosMesesSalvos = () => {
    const meses = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-')) {
            const mesKey = key.replace('contas-', '');
            if (mesKey.match(/^\d{4}-\d{2}$/)) {
                meses.add(mesKey);
            }
        }
    }
    return Array.from(meses).sort().reverse();
};

const calcularResumoParaMes = (mesKey) => {
    const chave = getChaveMes(mesKey);
    const dadosSalvos = localStorage.getItem(chave);

    let dados = { entradas: [], despesas: [], gastosAvulsos: [] };
    if (dadosSalvos) {
        try {
            dados = JSON.parse(dadosSalvos);
        } catch (e) {
            console.error(`Erro ao carregar dados para ${mesKey}`, e);
        }
    }

    const totalEntradas = (dados.entradas || []).reduce((acc, item) => acc + item.valor, 0);
    const totalPrevisto = (dados.despesas || []).reduce((acc, item) => acc + item.previsto, 0);
    
    // Total Pago = Despesas Pagas + Gastos Avulsos
    const totalPagoDespesas = (dados.despesas || []).reduce((acc, item) => acc + item.pago, 0);
    const totalGastosAvulsos = (dados.gastosAvulsos || []).reduce((acc, item) => acc + item.valor, 0);
    const totalPago = totalPagoDespesas + totalGastosAvulsos;
    
    const saldo = totalEntradas - totalPago;

    return {
        mesKey,
        nomeMes: obterNomeMes(mesKey),
        totalEntradas,
        totalPrevisto,
        totalPago,
        saldo,
        despesas: dados.despesas || [],
        gastosAvulsos: dados.gastosAvulsos || []
    };
};

const renderizarLinhaResumo = (titulo, valor, corClass) => `
    <div class="flex justify-between items-center py-2 border-b">
        <span class="text-gray-700">${titulo}</span>
        <span class="font-bold text-lg ${corClass}">${formatarMoeda(valor)}</span>
    </div>
`;

const renderizarGraficoMensal = (despesasDoMes, gastosAvulsosDoMes = []) => {
    const canvasEl = document.getElementById('grafico-despesas');
    if (!canvasEl) return;

    if (chartDespesas) {
        chartDespesas.destroy();
    }

    // Inicializar objeto com todas as despesas pagas
    const despesasPorCategoria = despesasDoMes
        .filter(d => d.pago > 0)
        .reduce((acc, item) => {
            const cat = item.categoria || 'Sem categoria';
            acc[cat] = (acc[cat] || 0) + item.pago;
            return acc;
        }, {});
    
    // Adicionar gastos avulsos do mês
    (gastosAvulsosDoMes || []).forEach(gasto => {
        const cat = gasto.categoria || 'Sem categoria';
        despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + gasto.valor;
    });

    const categoriasOrdenadas = Object.keys(despesasPorCategoria).sort((a, b) => despesasPorCategoria[b] - despesasPorCategoria[a]);
    const labels = categoriasOrdenadas;
    const data = categoriasOrdenadas.map(cat => despesasPorCategoria[cat]);
    const backgroundColors = labels.map(getCorHexCategoria);

    const msgSemGrafico = document.getElementById('msg-sem-grafico');

    if (data.length === 0) {
        canvasEl.style.display = 'none';
        if (msgSemGrafico) msgSemGrafico.classList.remove('hidden');
        return;
    } else {
        canvasEl.style.display = 'block';
        if (msgSemGrafico) msgSemGrafico.classList.add('hidden');
    }

    const totalGasto = data.reduce((sum, val) => sum + val, 0);

    const dataConfig = {
        labels: labels,
        datasets: [{
            label: 'Despesas Pagas',
            data: data,
            backgroundColor: backgroundColors,
            hoverOffset: 16,
        }]
    };

    const config = {
        type: 'doughnut',
        data: dataConfig,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = totalGasto > 0 ? ((value / totalGasto) * 100).toFixed(1) : 0;

                                    return {
                                        text: `${label}: ${formatarMoeda(value)} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].borderColor,
                                        lineWidth: data.datasets[0].borderWidth,
                                        hidden: chart.getDatasetMeta(0).data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribuição das Despesas Pagas por Categoria',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed;
                            const percentage = totalGasto > 0 ? ((value / totalGasto) * 100).toFixed(1) : 0;
                            return `${label} ${formatarMoeda(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    };

    chartDespesas = new Chart(canvasEl, config);
};

const renderizarRelatorioUnico = (mesKey) => {
    const resumo = calcularResumoParaMes(mesKey);
    const container = document.getElementById('conteudo-relatorio');

    document.getElementById('relatorio-mes-unico-nome').textContent = obterNomeMes(mesKey);

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xl font-semibold mb-4 text-blue-600">Detalhes Financeiros</h3>
                <div class="bg-gray-50 p-4 rounded-lg shadow-inner">
                    ${renderizarLinhaResumo('Total de Entradas', resumo.totalEntradas, 'text-green-600')}
                    ${renderizarLinhaResumo('Total Previsto (Despesas)', resumo.totalPrevisto, 'text-yellow-600')}
                    ${renderizarLinhaResumo('Total Pago (Despesas)', resumo.totalPago, 'text-red-600')}
                </div>
                <div class="mt-6 bg-blue-100 p-4 rounded-lg shadow-md">
                    ${renderizarLinhaResumo('Saldo Final (Entradas - Pago)', resumo.saldo, resumo.saldo >= 0 ? 'text-blue-800' : 'text-red-800')}
                </div>
            </div>
            
            <div class="text-center">
                <h3 class="text-xl font-semibold mb-4 text-blue-600">Distribuição de Gastos</h3>
                <div id="chart-container" class="w-full p-4 bg-white rounded-lg shadow-md" style="max-width: 100%; overflow: hidden; box-sizing: border-box;">
                    <canvas id="grafico-despesas" style="max-width: 100%; height: auto;"></canvas>
                </div>
                <p id="msg-sem-grafico" class="hidden mt-4 text-gray-500 italic">Nenhuma despesa paga neste mês para gerar o gráfico.</p>
            </div>
        </div>
    `;

    renderizarGraficoMensal(resumo.despesas, resumo.gastosAvulsos);
};

const renderizarLinhaComparacao = (metrica, val1, val2, corClasse, bgClasse, isSaldo = false) => {
    const diferenca = val1 - val2;
    let difClasse = diferenca >= 0 ? 'text-green-600' : 'text-red-600';

    if (metrica === 'Previsto' || metrica === 'Pago') {
        difClasse = diferenca <= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (isSaldo) {
        difClasse = diferenca >= 0 ? 'text-blue-800' : 'text-red-800';
    }

    return `
        <tr class="hover:bg-gray-50 border-t border-gray-200 ${bgClasse}">
            <td class="p-3 text-left font-medium text-gray-800">${metrica}</td>
            <td class="p-3 text-right ${corClasse}">${formatarMoeda(val1)}</td>
            <td class="p-3 text-right ${corClasse}">${formatarMoeda(val2)}</td>
            <td class="p-3 text-right font-bold ${difClasse}">
                ${diferenca > 0 ? '+' : ''}${formatarMoeda(diferenca)}
            </td>
        </tr>
    `;
};

const renderizarComparacao = (mesKey1, mesKey2) => {
    const resumo1 = calcularResumoParaMes(mesKey1);
    const resumo2 = mesKey2 ? calcularResumoParaMes(mesKey2) : null;
    const container = document.getElementById('conteudo-relatorio');

    if (chartDespesas) {
        chartDespesas.destroy();
        chartDespesas = null;
    }

    const mesesDisponiveis = obterTodosMesesSalvos();
    const optionsHtml = mesesDisponiveis
        .filter(m => m !== mesKey1)
        .map(m =>
            `<option value="${m}" ${m === mesKey2 ? 'selected' : ''}>${obterNomeMes(m)}</option>`
        ).join('');

    container.innerHTML = `
        <div class="mb-4 flex flex-col md:flex-row items-center gap-4 p-4 bg-gray-100 rounded-lg">
            <label for="seletor-mes-comparacao" class="font-medium text-gray-700 flex-shrink-0">Comparar <span class="font-bold">${resumo1.nomeMes}</span> com:</label>
            <select id="seletor-mes-comparacao" class="p-2 border rounded-lg w-full md:w-auto bg-white">
                <option value="">Selecione um mês para comparar</option>
                ${optionsHtml}
            </select>
        </div>

        ${resumo2 ? `
        <div class="overflow-x-auto">
            <table class="w-full min-w-[600px] border-collapse">
                <thead>
                    <tr class="bg-indigo-100 text-indigo-800">
                        <th class="p-3 text-left border border-indigo-200">Métrica</th>
                        <th class="p-3 text-right border border-indigo-200">${resumo1.nomeMes}</th>
                        <th class="p-3 text-right border border-indigo-200">${resumo2.nomeMes}</th>
                        <th class="p-3 text-right border border-indigo-200">Diferença</th>
                    </tr>
                </thead>
                <tbody>
                    ${renderizarLinhaComparacao('Total Entradas', resumo1.totalEntradas, resumo2.totalEntradas, 'text-green-600', 'bg-green-50')}
                    ${renderizarLinhaComparacao('Total Previsto', resumo1.totalPrevisto, resumo2.totalPrevisto, 'text-yellow-600', 'bg-yellow-50')}
                    ${renderizarLinhaComparacao('Total Pago', resumo1.totalPago, resumo2.totalPago, 'text-red-600', 'bg-red-50')}
                    ${renderizarLinhaComparacao('Saldo Final', resumo1.saldo, resumo2.saldo, resumo1.saldo >= 0 ? 'text-blue-800' : 'text-red-800', 'bg-blue-50', true)}
                </tbody>
            </table>
        </div>
        ` : `<p class="text-center py-8 text-gray-500 font-medium">Selecione um mês no menu acima para ver a comparação.</p>`}
    `;

    const seletorComparacao = document.getElementById('seletor-mes-comparacao');
    if (seletorComparacao) {
        seletorComparacao.addEventListener('change', (e) => {
            const novoMesKey2 = e.target.value;
            renderizarComparacao(mesKey1, novoMesKey2);
        });
    }
};

window.abrirRelatorio = () => {
    relatorioMesPrincipal = seletorMes.value;
    if (!relatorioMesPrincipal) {
        mostrarToast('Selecione um mês válido!', 'error');
        return;
    }
    document.getElementById('modal-relatorio').classList.remove('hidden');

    const tabUnico = document.getElementById('tab-resumo-unico');
    const tabComparacao = document.getElementById('tab-comparacao');

    tabUnico.onclick = () => alternarModoRelatorio('unico');
    tabComparacao.onclick = () => alternarModoRelatorio('comparacao');

    alternarModoRelatorio(modoRelatorio);
};

window.fecharRelatorio = (event = null) => {
    if (event && event.target.id !== 'modal-relatorio') return;
    document.getElementById('modal-relatorio').classList.add('hidden');

    if (chartDespesas) {
        chartDespesas.destroy();
        chartDespesas = null;
    }

    modoRelatorio = 'unico';
};

const alternarModoRelatorio = (modo) => {
    modoRelatorio = modo;
    const tabUnico = document.getElementById('tab-resumo-unico');
    const tabComparacao = document.getElementById('tab-comparacao');

    if (modo === 'unico') {
        tabUnico.classList.remove('bg-indigo-100', 'text-indigo-600', 'hover:bg-indigo-200');
        tabUnico.classList.add('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');

        tabComparacao.classList.remove('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');
        tabComparacao.classList.add('bg-indigo-100', 'text-indigo-600', 'hover:bg-indigo-200');

        renderizarRelatorioUnico(relatorioMesPrincipal);
    } else {
        tabComparacao.classList.remove('bg-indigo-100', 'text-indigo-600', 'hover:bg-indigo-200');
        tabComparacao.classList.add('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');

        tabUnico.classList.remove('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');
        tabUnico.classList.add('bg-indigo-100', 'text-indigo-600', 'hover:bg-indigo-200');

        const mesesSalvos = obterTodosMesesSalvos();
        const mesAnterior = mesesSalvos
            .filter(m => m !== relatorioMesPrincipal)
            .sort((a, b) => a.localeCompare(b))
            .find((m, index, arr) => arr[index + 1] === relatorioMesPrincipal || index === arr.length - 1 && relatorioMesPrincipal > arr[index]);

        renderizarComparacao(relatorioMesPrincipal, mesAnterior || '');
    }
};

// ===== EXPORTAÇÃO =====

window.exportarCSV = () => {
    if (!mesAtual) {
        mostrarToast('Selecione um mês válido!', 'error');
        return;
    }

    const nomeMes = obterNomeMes(mesAtual).replace(/ /g, '_');
    
    // CSV de Entradas
    let csvEntradas = 'Tipo,Data,Descrição,Categoria,Valor\n';
    entradas.forEach(e => {
        csvEntradas += `Entrada,${formatISODateToBR(e.data)},${e.descricao},${e.categoria || 'Sem Categoria'},${e.valor}\n`;
    });

    // CSV de Despesas
    let csvDespesas = 'Tipo,Descrição,Categoria,Vencimento,Data Pagamento,Valor Previsto,Valor Pago\n';
    despesas.forEach(d => {
        csvDespesas += `Despesa,${d.descricao},${d.categoria || 'Sem Categoria'},${formatISODateToBR(d.vencimento)},${formatISODateToBR(d.dataPagamento)},${d.previsto},${d.pago}\n`;
    });

    const csvCompleto = csvEntradas + '\n' + csvDespesas;

    const blob = new Blob([csvCompleto], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Controle_Financeiro_${nomeMes}.csv`;
    link.click();

    mostrarToast('Arquivo CSV exportado!', 'success');
    fecharModalExportar();
};

window.exportarJSON = () => {
    if (!mesAtual) {
        mostrarToast('Selecione um mês válido!', 'error');
        return;
    }

    const nomeMes = obterNomeMes(mesAtual).replace(/ /g, '_');
    const dados = {
        mes: mesAtual,
        nomeMes: obterNomeMes(mesAtual),
        entradas: entradas,
        despesas: despesas
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Controle_Financeiro_${nomeMes}.json`;
    link.click();

    mostrarToast('Arquivo JSON exportado!', 'success');
    fecharModalExportar();
};

window.abrirModalExportar = () => {
    if (!mesAtual) {
        mostrarToast('Selecione um mês válido!', 'error');
        return;
    }
    document.getElementById('mes-exportacao').textContent = obterNomeMes(mesAtual);
    document.getElementById('modal-exportar').classList.remove('hidden');
};

window.fecharModalExportar = (event = null) => {
    if (event && event.target.id !== 'modal-exportar') return;
    document.getElementById('modal-exportar').classList.add('hidden');
};

// ===== BACKUP E RESTAURAÇÃO =====

window.exportarBackup = () => {
    const todosOsDados = {};

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-')) {
            todosOsDados[key] = localStorage.getItem(key);
        }
    }

    const dataAtual = new Date().toISOString().split('T')[0];
    const blob = new Blob([JSON.stringify(todosOsDados, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Backup_Completo_${dataAtual}.json`;
    link.click();

    mostrarToast('Backup completo realizado!', 'success');
};

// ===== DESPESAS RECORRENTES =====

/**
 * Gera despesas recorrentes para o próximo mês
 */
window.gerarDespesasRecorrentes = () => {
    if (!mesAtual) {
        mostrarToast('Selecione um mês primeiro!', 'error');
        return;
    }

    const despesasRecorrentes = despesas.filter(d => d.recorrente);
    
    if (despesasRecorrentes.length === 0) {
        mostrarToast('Nenhuma despesa recorrente encontrada no mês atual!', 'warning');
        return;
    }

    // Calcula próximo mês
    const [ano, mes] = mesAtual.split('-').map(Number);
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const proximoAno = mes === 12 ? ano + 1 : ano;
    const proximoMesKey = `${proximoAno}-${String(proximoMes).padStart(2, '0')}`;
    
    // Carrega dados do próximo mês
    const chaveProximoMes = getChaveMes(proximoMesKey);
    const dadosProximoMes = localStorage.getItem(chaveProximoMes);
    let despesasProximoMes = dadosProximoMes ? JSON.parse(dadosProximoMes).despesas || [] : [];
    
    // Copia despesas recorrentes
    let contador = 0;
    despesasRecorrentes.forEach(d => {
        // Ajusta data de vencimento para o próximo mês
        const [anoVenc, mesVenc, diaVenc] = d.vencimento.split('-');
        const novoVencimento = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-${diaVenc}`;
        
        const novaDespesa = {
            ...d,
            vencimento: novoVencimento,
            dataPagamento: '',
            pago: 0
        };
        
        despesasProximoMes.push(novaDespesa);
        contador++;
    });
    
    // Salva no próximo mês
    const entradasProximoMes = dadosProximoMes ? JSON.parse(dadosProximoMes).entradas || [] : [];
    localStorage.setItem(chaveProximoMes, JSON.stringify({
        entradas: entradasProximoMes,
        despesas: despesasProximoMes
    }));
    
    const nomeMesProximo = obterNomeMes(proximoMesKey);
    mostrarToast(`✅ ${contador} despesa(s) recorrente(s) copiada(s) para ${nomeMesProximo}!`, 'success');
};

window.importarBackup = () => {
    const input = document.getElementById('input-backup');
    const file = input.files[0];

    if (!file) {
        mostrarToast('Selecione um arquivo de backup!', 'error');
        return;
    }

    if (!confirm('ATENÇÃO: Isso substituirá TODOS os dados atuais. Deseja continuar?')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result);

            // Limpa dados antigos
            const keysParaRemover = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('contas-')) {
                    keysParaRemover.push(key);
                }
            }
            keysParaRemover.forEach(k => localStorage.removeItem(k));

            // Importa novos dados
            for (const [key, value] of Object.entries(dados)) {
                localStorage.setItem(key, value);
            }

            carregarCategorias();
            carregarPoupanca();
            carregarDados(mesAtual);
            mostrarToast('Backup restaurado com sucesso!', 'success');
            fecharModalBackup();
        } catch (error) {
            console.error('Erro ao importar backup:', error);
            mostrarToast('Erro ao importar backup. Verifique o arquivo.', 'error');
        }
    };
    reader.readAsText(file);
};

window.abrirModalBackup = () => {
    document.getElementById('modal-backup').classList.remove('hidden');
};

window.fecharModalBackup = (event = null) => {
    if (event && event.target.id !== 'modal-backup') return;
    document.getElementById('modal-backup').classList.add('hidden');
};

// ===== RECUPERAÇÃO DE DADOS =====

/**
 * Função para recuperar dados do localStorage
 * Útil caso os dados pareçam ter sido perdidos
 */
window.verificarDadosLocalStorage = () => {
    console.log('🔍 Verificando dados no localStorage...');
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-firebase-')) {
            chaves.push(key);
        }
    }
    
    console.log(`📦 Encontradas ${chaves.length} chaves de dados:`, chaves);
    
    const todosOsDados = {};
    chaves.forEach(chave => {
        try {
            const dados = JSON.parse(localStorage.getItem(chave));
            todosOsDados[chave] = dados;
            console.log(`\n📋 ${chave}:`, dados);
            
            // Mostrar resumo
            if (dados.entradas) {
                console.log(`  💰 Entradas: ${dados.entradas.length} itens`);
            }
            if (dados.despesas) {
                console.log(`  💸 Despesas: ${dados.despesas.length} itens`);
            }
            if (dados.gastosAvulsos) {
                console.log(`  🛒 Gastos Avulsos: ${dados.gastosAvulsos.length} itens`);
            }
        } catch (e) {
            console.error(`❌ Erro ao ler ${chave}:`, e);
        }
    });
    
    return todosOsDados;
};

/**
 * Função para recuperar entradas de todos os meses no localStorage
 */
window.recuperarTodasEntradas = () => {
    console.log('🔄 Buscando todas as entradas no localStorage...');
    
    const todasEntradas = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-firebase-') && key.match(/\d{4}-\d{2}/)) {
            try {
                const dados = JSON.parse(localStorage.getItem(key));
                if (dados.entradas && Array.isArray(dados.entradas) && dados.entradas.length > 0) {
                    const mes = key.replace('contas-firebase-', '');
                    console.log(`✅ Encontradas ${dados.entradas.length} entradas em ${mes}:`, dados.entradas);
                    todasEntradas.push({ mes, entradas: dados.entradas });
                }
            } catch (e) {
                console.error(`❌ Erro ao ler ${key}:`, e);
            }
        }
    }
    
    if (todasEntradas.length === 0) {
        console.log('⚠️ Nenhuma entrada encontrada no localStorage');
    } else {
        console.log(`\n📊 RESUMO: Encontradas entradas em ${todasEntradas.length} mês(es)`);
        todasEntradas.forEach(({ mes, entradas }) => {
            console.log(`  ${mes}: ${entradas.length} entradas`);
            entradas.forEach(e => {
                console.log(`    - ${e.descricao}: R$ ${e.valor.toFixed(2)}`);
            });
        });
    }
    
    return todasEntradas;
};

/**
 * Função para restaurar entradas de um mês específico
 */
window.restaurarEntradasDoMes = (mes) => {
    if (!mes) {
        console.error('❌ Informe o mês no formato YYYY-MM (ex: 2025-10)');
        return;
    }
    
    const chave = `contas-firebase-${mes}`;
    const dadosSalvos = localStorage.getItem(chave);
    
    if (!dadosSalvos) {
        console.log(`⚠️ Nenhum dado encontrado para ${mes}`);
        return;
    }
    
    try {
        const dados = JSON.parse(dadosSalvos);
        if (dados.entradas && Array.isArray(dados.entradas) && dados.entradas.length > 0) {
            console.log(`✅ Encontradas ${dados.entradas.length} entradas em ${mes}`);
            
            // Se é o mês atual, restaurar
            if (mes === mesAtual) {
                entradas = dados.entradas;
                renderizarEntradas();
                atualizarResumo();
                console.log(`✅ Entradas restauradas para o mês atual (${mes})`);
                mostrarToast(`✅ ${dados.entradas.length} entradas restauradas!`, 'success');
            } else {
                console.log(`ℹ️ Mês ${mes} não é o mês atual. Mude para ${mes} e tente novamente.`);
            }
            
            return dados.entradas;
        } else {
            console.log(`⚠️ Nenhuma entrada encontrada em ${mes}`);
            return [];
        }
    } catch (e) {
        console.error(`❌ Erro ao restaurar entradas:`, e);
    }
};

// ===== INICIALIZAÇÃO =====

seletorMes.addEventListener('change', (e) => {
    const novoMes = e.target.value;
    if (novoMes) {
        carregarDados(novoMes);
    }
});

btnRelatorio.addEventListener('click', abrirRelatorio);
btnBackup.addEventListener('click', abrirModalBackup);
btnExportar.addEventListener('click', abrirModalExportar);

// Listener do botão de sincronização de Gastos Avulsos
if (btnSyncGastos) {
    btnSyncGastos.addEventListener('click', () => {
        if (confirm('Deseja forçar a sincronização de todos os Gastos Avulsos com o Firebase?\n\nIsso enviará todos os gastos locais para a nuvem.')) {
            // Remover flag de migração para forçar nova execução
            localStorage.removeItem('contas-migracao-gastos-avulsos-v2');
            migrarESincronizarGastosAvulsos();
        }
    });
}

// Listener do botão de modo escuro
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
    btnDarkMode.addEventListener('click', toggleDarkMode);
}

// ===== GASTOS AVULSOS COM LINGUAGEM NATURAL =====

let gastosAvulsos = [];
let estadoEdicaoGastoAvulso = null;

// Trocar entre tabs
window.trocarTabDespesa = (tab) => {
    const tabFixos = document.getElementById('tab-gastos-fixos');
    const tabAvulsos = document.getElementById('tab-gastos-avulsos');
    const contentFixos = document.getElementById('tab-content-fixos');
    const contentAvulsos = document.getElementById('tab-content-avulsos');
    
    if (tab === 'fixos') {
        // Ativa tab fixos
        tabFixos.classList.add('border-red-600', 'text-red-600', 'dark:text-red-400');
        tabFixos.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        
        tabAvulsos.classList.remove('border-red-600', 'text-red-600', 'dark:text-red-400');
        tabAvulsos.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        
        contentFixos.classList.remove('hidden');
        contentAvulsos.classList.add('hidden');
    } else {
        // Ativa tab avulsos
        tabAvulsos.classList.add('border-red-600', 'text-red-600', 'dark:text-red-400');
        tabAvulsos.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        
        tabFixos.classList.remove('border-red-600', 'text-red-600', 'dark:text-red-400');
        tabFixos.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        
        contentAvulsos.classList.remove('hidden');
        contentFixos.classList.add('hidden');
        
        // Popula categorias no preview
        popularCategoriasPreview();
    }
};

// Popular categorias no preview
const popularCategoriasPreview = () => {
    const select = document.getElementById('preview-categoria');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione uma categoria...</option>';
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nome;
        option.textContent = cat.nome;
        select.appendChild(option);
    });
};

// Processar linguagem natural
window.processarGastoNatural = () => {
    const input = document.getElementById('input-gasto-natural');
    const texto = input.value.trim().toLowerCase();
    
    if (!texto) {
        mostrarToast('Digite uma descrição do gasto!', 'error');
        return;
    }
    
    // Regex para extrair informações
    // Padrão: "{gastei|comprei} {valor} {reais} no {débito|crédito} no {local}"
    
    // Extrair pessoa (Mary ou Rhayra)
    let pessoa = 'Mary'; // Padrão
    if (texto.includes('rhayra')) {
        pessoa = 'Rhayra';
    } else if (texto.includes('mary')) {
        pessoa = 'Mary';
    }
    
    // Extrair valor (números inteiros ou decimais)
    const regexValor = /(\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?/i;
    const matchValor = texto.match(regexValor);
    const valor = matchValor ? parseFloat(matchValor[1].replace(',', '.')) : 0;
    
    // Extrair forma de pagamento
    let formaPagamento = 'débito';
    if (texto.includes('crédito') || texto.includes('credito')) {
        formaPagamento = 'crédito';
    } else if (texto.includes('pix')) {
        formaPagamento = 'pix';
    } else if (texto.includes('dinheiro')) {
        formaPagamento = 'dinheiro';
    } else if (texto.includes('vale refeição') || texto.includes('vale refeicao') || texto.includes('vr')) {
        formaPagamento = 'vale-refeição';
    } else if (texto.includes('vale alimentação') || texto.includes('vale alimentacao') || texto.includes('va')) {
        formaPagamento = 'vale-alimentação';
    }
    
    // Extrair local/descrição (após "no" ou "na")
    let local = '';
    const regexLocal = /n[oa]\s+(?:débito|crédito|pix|dinheiro|vale refeição|vale refeicao|vr|vale alimentação|vale alimentacao|va)\s+n[oa]\s+(.+?)$/i;
    const matchLocal = texto.match(regexLocal);
    
    if (matchLocal && matchLocal[1]) {
        local = matchLocal[1].trim();
        // Capitalizar primeira letra
        local = local.charAt(0).toUpperCase() + local.slice(1);
    } else {
        // Tentar extrair após última ocorrência de "no" ou "na"
        const palavras = texto.split(/\s+/);
        const indexUltimoNo = Math.max(
            texto.lastIndexOf(' no '),
            texto.lastIndexOf(' na ')
        );
        if (indexUltimoNo > 0) {
            local = texto.slice(indexUltimoNo + 4).trim();
            local = local.charAt(0).toUpperCase() + local.slice(1);
        }
    }
    
    // Se não encontrou local, usar uma parte do texto
    if (!local) {
        const palavrasLimpas = texto.replace(/gastei|comprei|paguei|reais?|débito|crédito|pix|dinheiro|vale refeição|vale refeicao|vr|vale alimentação|vale alimentacao|va|n[oa]/gi, '').trim();
        const primeiras = palavrasLimpas.split(/\s+/).slice(0, 3).join(' ');
        local = primeiras.charAt(0).toUpperCase() + primeiras.slice(1);
    }
    
    // Validação
    if (valor <= 0) {
        mostrarToast('Não consegui identificar o valor! Verifique o texto.', 'error');
        return;
    }
    
    if (!local) {
        local = 'Gasto não especificado';
    }
    
    // Extrair e processar data
    let dataProcessada = new Date();
    
    if (texto.includes('hoje')) {
        // Data de hoje
        dataProcessada = new Date();
    } else if (texto.includes('ontem')) {
        // Data de ontem
        dataProcessada = new Date();
        dataProcessada.setDate(dataProcessada.getDate() - 1);
    } else if (texto.includes('anteontem')) {
        // Data de anteontem
        dataProcessada = new Date();
        dataProcessada.setDate(dataProcessada.getDate() - 2);
    } else {
        // Tentar extrair data no formato DD/MM ou DD/MM/AAAA
        const regexData = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/;
        const matchData = texto.match(regexData);
        
        if (matchData) {
            const dia = parseInt(matchData[1]);
            const mes = parseInt(matchData[2]) - 1; // Mês começa em 0
            const ano = matchData[3] ? parseInt(matchData[3]) : new Date().getFullYear();
            
            dataProcessada = new Date(ano, mes, dia);
            
            // Validar se a data é válida
            if (isNaN(dataProcessada.getTime()) || 
                dataProcessada.getDate() !== dia || 
                dataProcessada.getMonth() !== mes) {
                // Data inválida, usar hoje
                dataProcessada = new Date();
            }
        } else {
            // Tentar extrair "dia DD"
            const regexDia = /\bdia\s+(\d{1,2})\b/i;
            const matchDia = texto.match(regexDia);
            
            if (matchDia) {
                const dia = parseInt(matchDia[1]);
                const hoje = new Date();
                dataProcessada = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
                
                // Validar se a data é válida
                if (isNaN(dataProcessada.getTime()) || dataProcessada.getDate() !== dia) {
                    dataProcessada = new Date();
                }
            }
        }
    }
    
    // Formatar data para o campo
    const dia = String(dataProcessada.getDate()).padStart(2, '0');
    const mes = String(dataProcessada.getMonth() + 1).padStart(2, '0');
    const ano = dataProcessada.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;
    
    // Preencher preview
    document.getElementById('preview-pessoa').value = pessoa;
    document.getElementById('preview-valor').value = valor.toFixed(2);
    document.getElementById('preview-pagamento').value = formaPagamento;
    document.getElementById('preview-local').value = local;
    document.getElementById('preview-data').value = dataFormatada;
    
    // Mostrar preview
    document.getElementById('preview-gasto-avulso').classList.remove('hidden');
    
    // Scroll suave
    document.getElementById('preview-gasto-avulso').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    mostrarToast('✅ Texto processado! Revise e confirme.', 'success');
};

// Confirmar e adicionar gasto avulso
window.confirmarGastoAvulso = () => {
    const pessoa = document.getElementById('preview-pessoa').value;
    const valor = parseFloat(document.getElementById('preview-valor').value);
    const formaPagamento = document.getElementById('preview-pagamento').value;
    const local = document.getElementById('preview-local').value.trim();
    const data = document.getElementById('preview-data').value;
    const categoria = document.getElementById('preview-categoria').value;
    
    if (!valor || valor <= 0) {
        mostrarToast('Valor inválido!', 'error');
        return;
    }
    
    if (!local) {
        mostrarToast('Descrição/Local inválido!', 'error');
        return;
    }
    
    if (!data || !data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        mostrarToast('Data inválida! Use DD/MM/AAAA', 'error');
        return;
    }
    
    // Verificar se está editando ou adicionando
    if (estadoEdicaoGastoAvulso !== null) {
        // Modo edição - encontrar e atualizar gasto existente pelo ID
        const index = gastosAvulsos.findIndex(g => g.id === estadoEdicaoGastoAvulso);
        if (index !== -1) {
            gastosAvulsos[index] = {
                id: estadoEdicaoGastoAvulso,
        pessoa,
        descricao: local,
        formaPagamento,
        data: parseBRDateToISO(data),
        valor,
        categoria: categoria || 'Sem categoria',
        mes: mesAtual
    };
            mostrarToast('✅ Gasto avulso atualizado!', 'success');
        }
        estadoEdicaoGastoAvulso = null;
    } else {
        // Modo adição - adicionar novo gasto com ID único
    if (!gastosAvulsos) gastosAvulsos = [];
        const novoGasto = {
            id: Date.now() + Math.random(), // ID único baseado em timestamp + random
            pessoa,
            descricao: local,
            formaPagamento,
            data: parseBRDateToISO(data),
            valor,
            categoria: categoria || 'Sem categoria',
            mes: mesAtual
        };
        gastosAvulsos.push(novoGasto);
        mostrarToast('💰 Gasto avulso adicionado!', 'success');
    }
    
    // Salvar no localStorage
    salvarGastosAvulsos();
    
    // Renderizar tabela
    renderizarGastosAvulsos();
    
    // Limpar campos
    document.getElementById('input-gasto-natural').value = '';
    document.getElementById('preview-gasto-avulso').classList.add('hidden');
    
    // Atualizar resumo (somar gastos avulsos ao total pago)
    atualizarResumo();
};

// Cancelar preview
window.cancelarGastoAvulso = () => {
    document.getElementById('preview-gasto-avulso').classList.add('hidden');
    document.getElementById('input-gasto-natural').value = '';
    estadoEdicaoGastoAvulso = null;
};

// Editar gasto avulso
window.editarGastoAvulso = (gastoId) => {
    const gasto = gastosAvulsos.find(g => g.id === gastoId);
    if (!gasto) {
        mostrarToast('Gasto não encontrado!', 'error');
        return;
    }
    
    estadoEdicaoGastoAvulso = gastoId;
    
    // Preencher o preview com os dados do gasto
    document.getElementById('preview-pessoa').value = gasto.pessoa;
    document.getElementById('preview-valor').value = gasto.valor;
    document.getElementById('preview-pagamento').value = gasto.formaPagamento;
    document.getElementById('preview-local').value = gasto.descricao;
    document.getElementById('preview-data').value = formatISODateToBR(gasto.data);
    document.getElementById('preview-categoria').value = gasto.categoria;
    
    // Mostrar preview
    document.getElementById('preview-gasto-avulso').classList.remove('hidden');
    
    // Scroll para o preview
    document.getElementById('preview-gasto-avulso').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Renderizar tabela de gastos avulsos
const renderizarGastosAvulsos = () => {
    console.log('🎨 Renderizando gastos avulsos...', {
        totalGlobal: gastosAvulsos.length,
        mesAtual: mesAtual
    });
    
    const tabela = document.getElementById('tabela-gastos-avulsos');
    if (!tabela) {
        console.warn('⚠️ Tabela de gastos avulsos não encontrada!');
        return;
    }
    
    tabela.innerHTML = '';
    
    // Filtrar gastos do mês atual
    const gastosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
    console.log('🎨 Gastos do mês atual:', gastosMes.length, 'itens');
    
    if (gastosMes.length === 0) {
        tabela.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500 dark:text-gray-400 italic">Nenhum gasto avulso registrado neste mês</td></tr>';
        return;
    }
    
    gastosMes.forEach((gasto, index) => {
        const corCategoria = getCorCategoria(gasto.categoria);
        
        // Badge de forma de pagamento
        let badgePagamento = '';
        if (gasto.formaPagamento === 'débito') {
            badgePagamento = '<span class="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">💳 Débito</span>';
        } else if (gasto.formaPagamento === 'crédito') {
            badgePagamento = '<span class="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 px-2 py-1 rounded">💳 Crédito</span>';
        } else if (gasto.formaPagamento === 'pix') {
            badgePagamento = '<span class="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">📱 PIX</span>';
        } else if (gasto.formaPagamento === 'dinheiro') {
            badgePagamento = '<span class="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded">💵 Dinheiro</span>';
        } else if (gasto.formaPagamento === 'vale-refeição') {
            badgePagamento = '<span class="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-2 py-1 rounded">🍽️ Vale Refeição</span>';
        } else if (gasto.formaPagamento === 'vale-alimentação') {
            badgePagamento = '<span class="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200 px-2 py-1 rounded">🛒 Vale Alimentação</span>';
        }
        
        // Badge de pessoa com cores diferentes
        let badgePessoa = '';
        if (gasto.pessoa === 'Mary') {
            badgePessoa = '<span class="text-xs bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200 px-2 py-1 rounded font-semibold">👩 Mary</span>';
        } else if (gasto.pessoa === 'Rhayra') {
            badgePessoa = '<span class="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded font-semibold">👩 Rhayra</span>';
        }
        
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        tr.innerHTML = `
            <td class="p-3 text-center">
                <button onclick="editarGastoAvulso(${gasto.id})" class="text-blue-500 hover:text-blue-700 text-xl" title="Editar">
                    ✏️
                </button>
            </td>
            <td class="p-3">${badgePessoa}</td>
            <td class="p-3 font-medium dark:text-gray-300">${gasto.descricao}</td>
            <td class="p-3 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                <span>${gasto.categoria || 'Sem categoria'}</span>
            </td>
            <td class="p-3">${badgePagamento}</td>
            <td class="p-3 text-gray-600 dark:text-gray-400">${formatarData(gasto.data)}</td>
            <td class="p-3 text-right text-red-600 dark:text-red-400 font-bold">${formatarMoeda(gasto.valor)}</td>
            <td class="p-3 text-center">
                <button onclick="excluirGastoAvulso(${gasto.id})" class="text-red-500 hover:text-red-700 text-xl" title="Excluir">
                    🗑️
                </button>
            </td>
        `;
        tabela.appendChild(tr);
    });
    
    // Calcular e atualizar total dos gastos avulsos
    const totalAvulsos = gastosMes.reduce((acc, g) => acc + g.valor, 0);
    const totalAvulsosEl = document.getElementById('total-gastos-avulsos');
    
    if (totalAvulsosEl) {
        totalAvulsosEl.textContent = formatarMoeda(totalAvulsos);
    }
};

// Excluir gasto avulso
window.excluirGastoAvulso = (gastoId) => {
    if (!confirm('Tem certeza que deseja excluir este gasto?')) return;
    
    const index = gastosAvulsos.findIndex(g => g.id === gastoId);
    if (index !== -1) {
    gastosAvulsos.splice(index, 1);
    salvarGastosAvulsos();
    renderizarGastosAvulsos();
    atualizarResumo();
    mostrarToast('Gasto excluído!', 'success');
    }
};

// Salvar gastos avulsos (agora integrado com salvarDados)
const salvarGastosAvulsos = () => {
    // Os gastos avulsos agora são salvos junto com entradas e despesas
    salvarDados();
};

// Carregar gastos avulsos (agora integrado com carregarDados)
const carregarGastosAvulsos = (mes) => {
    // Os gastos avulsos agora são carregados junto com entradas e despesas em carregarDados
    // Esta função é mantida para compatibilidade, mas apenas renderiza
    renderizarGastosAvulsos();
};

// Adicionar IDs únicos a gastos avulsos antigos
const adicionarIDsGastosAvulsos = () => {
    let houveAlteracao = false;
    let contador = 0;
    
    gastosAvulsos = gastosAvulsos.map(gasto => {
        if (!gasto.id) {
            houveAlteracao = true;
            // Usar contador para garantir IDs únicos mesmo em operações rápidas
            contador++;
            return {
                ...gasto,
                id: Date.now() + Math.random() + contador
            };
        }
        return gasto;
    });
    
    if (houveAlteracao) {
        console.log('✅ IDs adicionados aos gastos avulsos antigos:', contador, 'gastos atualizados');
    }
};

// ===== MIGRAÇÃO E SINCRONIZAÇÃO DE GASTOS AVULSOS =====

/**
 * Migra e sincroniza TODOS os gastos avulsos existentes no localStorage para o Firebase
 * Esta função consolida gastos de todas as chaves antigas e força upload para o Firebase
 */
const migrarESincronizarGastosAvulsos = async () => {
    console.log('🔄 Iniciando migração e sincronização de Gastos Avulsos...');
    
    // Buscar todas as chaves antigas de gastos avulsos
    const chavesAntigas = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contas-gastos-avulsos-')) {
            chavesAntigas.push(key);
        }
    }
    
    if (chavesAntigas.length === 0) {
        console.log('✅ Nenhum gasto avulso antigo encontrado para migrar');
        return;
    }
    
    console.log(`📦 Encontradas ${chavesAntigas.length} chaves antigas de gastos avulsos`);
    
    // Consolidar todos os gastos avulsos antigos
    const todosGastosAntigos = [];
    chavesAntigas.forEach(chave => {
        try {
            const dados = localStorage.getItem(chave);
            if (dados) {
                const gastos = JSON.parse(dados);
                if (Array.isArray(gastos) && gastos.length > 0) {
                    const mes = chave.replace('contas-gastos-avulsos-', '');
                    console.log(`  ↳ ${mes}: ${gastos.length} gastos`);
                    todosGastosAntigos.push(...gastos);
                }
            }
        } catch (error) {
            console.error(`Erro ao processar ${chave}:`, error);
        }
    });
    
    if (todosGastosAntigos.length === 0) {
        console.log('✅ Nenhum gasto para migrar');
        return;
    }
    
    console.log(`💾 Total de gastos a migrar: ${todosGastosAntigos.length}`);
    
    // Atualizar array global
    gastosAvulsos = todosGastosAntigos;
    
    // Agrupar gastos por mês
    const gastosPorMes = {};
    todosGastosAntigos.forEach(gasto => {
        if (!gastosPorMes[gasto.mes]) {
            gastosPorMes[gasto.mes] = [];
        }
        gastosPorMes[gasto.mes].push(gasto);
    });
    
    // Sincronizar cada mês com o Firebase
    const mesesParaSincronizar = Object.keys(gastosPorMes);
    console.log(`☁️ Sincronizando ${mesesParaSincronizar.length} meses com o Firebase...`);
    
    for (const mes of mesesParaSincronizar) {
        try {
            // Carregar dados existentes do mês
            const chave = getChaveMes(mes);
            const dadosExistentes = localStorage.getItem(chave);
            let dados = dadosExistentes ? JSON.parse(dadosExistentes) : { entradas: [], despesas: [] };
            
            // Adicionar gastos avulsos
            dados.gastosAvulsos = gastosPorMes[mes];
            
            // Salvar localmente
            localStorage.setItem(chave, JSON.stringify(dados));
            
            // Sincronizar com Firebase
            if (window.firebaseSync && window.firebaseSync.isEnabled()) {
                await window.firebaseSync.sincronizarMesParaFirebase(mes, dados);
                console.log(`  ✅ ${mes}: ${gastosPorMes[mes].length} gastos sincronizados`);
            }
        } catch (error) {
            console.error(`Erro ao sincronizar mês ${mes}:`, error);
        }
    }
    
    // Remover chaves antigas após migração bem-sucedida
    chavesAntigas.forEach(chave => {
        localStorage.removeItem(chave);
        console.log(`  🗑️ Removida chave antiga: ${chave}`);
    });
    
    // Marcar migração como concluída
    localStorage.setItem('contas-migracao-gastos-avulsos-v2', 'concluida');
    
    console.log('✅ Migração e sincronização concluída com sucesso!');
    mostrarToast('✅ Gastos Avulsos sincronizados com o Firebase!', 'success');
    
    // Recarregar dados do mês atual
    renderizarGastosAvulsos();
    atualizarResumo();
};

// ===== POUPANÇA =====

let poupanca = [];
const formPoupanca = document.getElementById('form-poupanca');
const tabelaPoupanca = document.getElementById('tabela-poupanca');

const renderizarPoupanca = () => {
    if (!tabelaPoupanca) return;
    
    tabelaPoupanca.innerHTML = '';
    
    // Ordenar por data (mais recente primeiro)
    const poupancaOrdenada = [...poupanca].sort((a, b) => new Date(b.data) - new Date(a.data));
    
    poupancaOrdenada.forEach((item, index) => {
        const indexOriginal = poupanca.indexOf(item);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        
        const tipoClass = item.tipo === 'deposito' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        const tipoIcon = item.tipo === 'deposito' ? '💰 Depósito' : '💸 Retirada';
        const sinalValor = item.tipo === 'deposito' ? '+' : '-';
        
        tr.innerHTML = `
            <td class="p-3 text-gray-700 dark:text-gray-300">${formatarData(item.data)}</td>
            <td class="p-3 font-medium dark:text-gray-300">${item.descricao}</td>
            <td class="p-3 ${tipoClass} font-semibold">${tipoIcon}</td>
            <td class="p-3 text-gray-600 dark:text-gray-400 text-sm">${item.notas || '---'}</td>
            <td class="p-3 text-right ${tipoClass} font-bold">${sinalValor}${formatarMoeda(item.valor)}</td>
            <td class="p-3 text-right flex gap-2 justify-end">
                <button onclick="editarPoupanca(${indexOriginal})" class="text-blue-500 hover:text-blue-700 font-semibold text-sm">
                    ✏️ Editar
                </button>
                <button onclick="excluirPoupanca(${indexOriginal})" class="text-red-500 hover:text-red-700 font-semibold text-sm">
                    🗑️ Excluir
                </button>
            </td>
        `;
        tabelaPoupanca.appendChild(tr);
    });
    
    // Calcular totais
    const totalDepositos = poupanca.filter(p => p.tipo === 'deposito').reduce((acc, p) => acc + p.valor, 0);
    const totalRetiradas = poupanca.filter(p => p.tipo === 'retirada').reduce((acc, p) => acc + p.valor, 0);
    const saldoPoupanca = totalDepositos - totalRetiradas;
    
    // Atualizar elementos na seção de poupança
    const totalDepositosEl = document.getElementById('total-depositos-poupanca');
    const totalRetiradasEl = document.getElementById('total-retiradas-poupanca');
    const saldoPoupancaEl = document.getElementById('saldo-poupanca');
    
    if (totalDepositosEl) totalDepositosEl.textContent = formatarMoeda(totalDepositos);
    if (totalRetiradasEl) totalRetiradasEl.textContent = formatarMoeda(totalRetiradas);
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = formatarMoeda(saldoPoupanca);
    
    // Atualizar resumo mensal (a poupança é global e afeta o resumo)
    atualizarResumo();
};

if (formPoupanca) {
    formPoupanca.addEventListener('submit', (e) => {
        e.preventDefault();
        const descricao = document.getElementById('poupanca-descricao').value.trim();
        const data = parseBRDateToISO(document.getElementById('poupanca-data').value);
        const valor = parseFloat(document.getElementById('poupanca-valor').value);
        const tipo = document.getElementById('poupanca-tipo').value;
        const notas = document.getElementById('poupanca-notas').value.trim();
        const idEdicao = document.getElementById('poupanca-id-edicao').value;
        
        if (!descricao || !data || valor <= 0 || !tipo) {
            mostrarToast('Preencha todos os campos corretamente!', 'error');
            return;
        }
        
        if (idEdicao !== '') {
            // Modo edição
            const index = parseInt(idEdicao);
            poupanca[index].descricao = descricao;
            poupanca[index].data = data;
            poupanca[index].valor = valor;
            poupanca[index].tipo = tipo;
            poupanca[index].notas = notas;
            mostrarToast('Movimentação atualizada!', 'success');
            document.getElementById('poupanca-btn-texto').textContent = 'Adicionar Movimentação';
            document.getElementById('poupanca-id-edicao').value = '';
        } else {
            // Modo adição
            poupanca.push({
                descricao,
                data,
                valor,
                tipo,
                notas
            });
            const tipoTexto = tipo === 'deposito' ? 'Depósito' : 'Retirada';
            mostrarToast(`${tipoTexto} adicionado à poupança!`, 'success');
        }
        
        salvarPoupanca();
        renderizarPoupanca();
        formPoupanca.reset();
    });
}

window.editarPoupanca = (index) => {
    const item = poupanca[index];
    document.getElementById('poupanca-descricao').value = item.descricao;
    document.getElementById('poupanca-data').value = formatISODateToBR(item.data);
    document.getElementById('poupanca-valor').value = item.valor;
    document.getElementById('poupanca-tipo').value = item.tipo;
    document.getElementById('poupanca-notas').value = item.notas || '';
    document.getElementById('poupanca-id-edicao').value = index;
    document.getElementById('poupanca-btn-texto').textContent = 'Atualizar Movimentação';
    
    formPoupanca.scrollIntoView({ behavior: 'smooth' });
};

window.excluirPoupanca = (index) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    
    poupanca.splice(index, 1);
    salvarPoupanca();
    renderizarPoupanca();
    mostrarToast('Movimentação excluída!', 'success');
};

// Nota: Autenticação agora é gerenciada pelo auth-simple.js

// PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('✅ Service Worker registrado!', reg))
            .catch(err => console.log('❌ Erro ao registrar Service Worker:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Carrega dark mode
    carregarDarkMode();
    
    // Carrega categorias (GLOBAL)
    carregarCategorias();
    
    // Carrega poupança (GLOBAL - acumulativa entre meses)
    carregarPoupanca();

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const mesFormatado = `${ano}-${mes}`;

    seletorMes.value = mesFormatado;
    carregarDados(mesFormatado);
    
    // Executar migração de Gastos Avulsos (apenas uma vez)
    setTimeout(() => {
        const migracaoConcluida = localStorage.getItem('contas-migracao-gastos-avulsos-v2');
        if (!migracaoConcluida && window.firebaseSync && window.firebaseSync.isEnabled()) {
            console.log('🔄 Detectada necessidade de migração de Gastos Avulsos...');
            migrarESincronizarGastosAvulsos();
        }
    }, 2000); // Aguarda 2s para garantir que Firebase está pronto
    
    // Controla o campo de parcelas baseado no toggle
    const toggleParcelado = document.getElementById('despesa-parcelada');
    const campoParcelas = document.getElementById('despesa-parcelas');
    
    // Desabilita o campo inicialmente
    campoParcelas.disabled = true;
    campoParcelas.value = '';
    
    // Adiciona listener ao toggle
    toggleParcelado.addEventListener('change', function() {
        if (this.checked) {
            campoParcelas.disabled = false;
            campoParcelas.focus();
        } else {
            campoParcelas.disabled = true;
            campoParcelas.value = '';
        }
    });
    
    // Conecta o botão de gerar despesas recorrentes
    const btnGerarRecorrentes = document.getElementById('btn-gerar-recorrentes');
    if (btnGerarRecorrentes) {
        btnGerarRecorrentes.addEventListener('click', gerarDespesasRecorrentes);
    }
    
    // Conecta o botão de contas bancárias
    const btnContasBancarias = document.getElementById('btn-contas-bancarias');
    if (btnContasBancarias) {
        btnContasBancarias.addEventListener('click', abrirModalContasBancarias);
    }
});

// ============================================
// SISTEMA DE CONTAS BANCÁRIAS
// ============================================

let contasBancarias = [];
let estadoEdicaoConta = -1;
const CHAVE_CONTAS_BANCARIAS = 'contas-bancarias';

// ===== FUNÇÕES DO MODAL =====

window.abrirModalContasBancarias = () => {
    carregarContasBancarias();
    renderizarContasBancarias();
    document.getElementById('modal-contas-bancarias').classList.remove('hidden');
};

window.fecharModalContasBancarias = (event = null) => {
    if (event && event.target.id !== 'modal-contas-bancarias') return;
    document.getElementById('modal-contas-bancarias').classList.add('hidden');
    cancelarEdicaoConta();
};

// ===== CARREGAR E SALVAR =====

const carregarContasBancarias = () => {
    const dados = localStorage.getItem(CHAVE_CONTAS_BANCARIAS);
    if (dados) {
        try {
            contasBancarias = JSON.parse(dados);
        } catch (e) {
            console.error('Erro ao carregar contas bancárias:', e);
            contasBancarias = [];
        }
    } else {
        contasBancarias = [];
    }
};

const salvarContasBancarias = () => {
    localStorage.setItem(CHAVE_CONTAS_BANCARIAS, JSON.stringify(contasBancarias));
};

// ===== RENDERIZAR =====

const renderizarContasBancarias = () => {
    const lista = document.getElementById('lista-contas-bancarias');
    lista.innerHTML = '';
    
    if (contasBancarias.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p class="text-lg font-medium">Nenhuma conta cadastrada</p>
                <p class="text-sm">Adicione sua primeira conta bancária acima</p>
            </div>
        `;
        atualizarTotalContas();
        return;
    }
    
    contasBancarias.forEach((conta, index) => {
        const saldoClass = conta.saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-700 p-4 rounded-lg shadow-md border-l-4 border-yellow-500 transition-all hover:shadow-lg';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">👤 ${conta.titular}</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <h4 class="text-lg font-bold text-gray-800 dark:text-white">${conta.banco}</h4>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-gray-600 dark:text-gray-300">
                            <strong>Tipo:</strong> ${conta.tipo}
                        </span>
                        <span class="text-xl font-bold ${saldoClass}">
                            ${formatarMoeda(conta.saldo)}
                        </span>
                        ${conta.observacao ? `
                            <span class="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                                ${conta.observacao}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="editarConta(${index})" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm">
                        ✏️ Editar
                    </button>
                    <button onclick="deletarConta(${index})" class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `;
        lista.appendChild(div);
    });
    
    atualizarTotalContas();
};

const atualizarTotalContas = () => {
    const total = contasBancarias.reduce((acc, conta) => acc + conta.saldo, 0);
    document.getElementById('total-contas-bancarias').textContent = formatarMoeda(total);
};

// ===== ADICIONAR/EDITAR =====

const formContaBancaria = document.getElementById('form-conta-bancaria');

formContaBancaria.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const titular = document.getElementById('conta-titular').value.trim();
    const banco = document.getElementById('conta-banco').value.trim();
    const tipo = document.getElementById('conta-tipo').value.trim();
    const saldo = parseFloat(document.getElementById('conta-saldo').value) || 0;
    const observacao = document.getElementById('conta-observacao').value.trim();
    
    if (!titular || !banco || !tipo) {
        mostrarToast('Preencha os campos obrigatórios!', 'error');
        return;
    }
    
    const novaConta = {
        titular,
        banco,
        tipo,
        saldo,
        observacao,
        dataCriacao: estadoEdicaoConta === -1 ? new Date().toISOString() : contasBancarias[estadoEdicaoConta].dataCriacao,
        dataAtualizacao: new Date().toISOString()
    };
    
    if (estadoEdicaoConta === -1) {
        // Adicionar nova conta
        contasBancarias.push(novaConta);
        mostrarToast('Conta adicionada com sucesso!', 'success');
    } else {
        // Editar conta existente
        contasBancarias[estadoEdicaoConta] = novaConta;
        mostrarToast('Conta atualizada com sucesso!', 'success');
        estadoEdicaoConta = -1;
    }
    
    salvarContasBancarias();
    renderizarContasBancarias();
    formContaBancaria.reset();
    cancelarEdicaoConta();
});

window.editarConta = (index) => {
    const conta = contasBancarias[index];
    estadoEdicaoConta = index;
    
    document.getElementById('conta-titular').value = conta.titular || '';
    document.getElementById('conta-banco').value = conta.banco;
    document.getElementById('conta-tipo').value = conta.tipo;
    document.getElementById('conta-saldo').value = conta.saldo;
    document.getElementById('conta-observacao').value = conta.observacao || '';
    document.getElementById('conta-id-edicao').value = index;
    
    document.getElementById('titulo-form-conta').textContent = 'Editar Conta';
    document.getElementById('btn-texto-conta').textContent = 'Salvar Alterações';
    document.getElementById('btn-cancelar-conta').classList.remove('hidden');
    
    // Scroll para o formulário
    document.getElementById('form-conta-bancaria').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.cancelarEdicaoConta = () => {
    estadoEdicaoConta = -1;
    formContaBancaria.reset();
    document.getElementById('titulo-form-conta').textContent = 'Adicionar Nova Conta';
    document.getElementById('btn-texto-conta').textContent = 'Adicionar Conta';
    document.getElementById('btn-cancelar-conta').classList.add('hidden');
};

window.deletarConta = (index) => {
    const conta = contasBancarias[index];
    const nomeConta = conta.titular ? `${conta.banco} de ${conta.titular}` : conta.banco;
    if (confirm(`Tem certeza que deseja excluir a conta "${nomeConta}"?\n\nEsta ação não pode ser desfeita.`)) {
        contasBancarias.splice(index, 1);
        salvarContasBancarias();
        renderizarContasBancarias();
        mostrarToast('Conta excluída com sucesso!', 'success');
    }
};

// ===== MENU DRAWER/LAUNCHPAD =====

const abrirMenuDrawer = () => {
    const drawer = document.getElementById('menu-drawer');
    const sidebar = document.getElementById('menu-sidebar');
    
    drawer.classList.remove('hidden');
    // Delay para animação (da DIREITA)
    setTimeout(() => {
        sidebar.classList.remove('translate-x-full');
    }, 10);
};

const fecharMenuDrawer = () => {
    const drawer = document.getElementById('menu-drawer');
    const sidebar = document.getElementById('menu-sidebar');
    
    sidebar.classList.add('translate-x-full');
    // Delay para completar animação antes de esconder
    setTimeout(() => {
        drawer.classList.add('hidden');
    }, 300);
};

// Event Listeners para Menu
document.getElementById('btn-menu-hamburguer').addEventListener('click', abrirMenuDrawer);
document.getElementById('btn-fechar-menu').addEventListener('click', fecharMenuDrawer);
document.getElementById('menu-overlay').addEventListener('click', fecharMenuDrawer);

// Event Listeners para botões do menu (fechar ao clicar)
const menuBtns = ['btn-calendario', 'btn-relatorio', 'btn-exportar', 'btn-contas-bancarias', 'btn-backup', 'btn-sync-gastos', 'btn-logout'];
menuBtns.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
        const originalHandler = btn.onclick;
        btn.addEventListener('click', () => {
            fecharMenuDrawer();
        });
    }
});

// ===== CALENDÁRIO =====

let calendarioMesAtual = new Date();

window.abrirCalendario = () => {
    document.getElementById('modal-calendario').classList.remove('hidden');
    // Sempre começar no mês atual do usuário
    const hoje = new Date();
    calendarioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    // Resetar para view principal
    document.getElementById('calendario-view-principal').classList.remove('hidden');
    document.getElementById('calendario-view-detalhes').classList.add('hidden');
    
    renderizarCalendario();
};

window.fecharCalendario = (event) => {
    if (!event || event.target.id === 'modal-calendario') {
        document.getElementById('modal-calendario').classList.add('hidden');
    }
};

const renderizarCalendario = () => {
    const ano = calendarioMesAtual.getFullYear();
    const mes = calendarioMesAtual.getMonth();
    
    // Atualizar título
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('calendario-mes-ano').textContent = `${meses[mes]} ${ano}`;
    
    // Primeiro dia do mês
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();
    
    // Montar chave do mês para buscar dados
    const mesKey = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    
    // Buscar entradas e despesas do mês
    const chave = `contas-firebase-${mesKey}`;
    console.log('📅 Buscando dados do calendário:', chave);
    const dadosSalvos = localStorage.getItem(chave);
    let dados = { entradas: [], despesas: [], gastosAvulsos: [] };
    if (dadosSalvos) {
        try {
            dados = JSON.parse(dadosSalvos);
            console.log('📅 Dados carregados:', {
                entradas: dados.entradas?.length || 0,
                despesas: dados.despesas?.length || 0,
                gastosAvulsos: dados.gastosAvulsos?.length || 0
            });
        } catch (e) {
            console.error('❌ Erro ao carregar dados do calendário:', e);
        }
    } else {
        console.log('⚠️ Nenhum dado encontrado para', mesKey);
    }
    
    // Criar grid do calendário
    const grid = document.getElementById('calendario-grid');
    
    // Limpar grid (manter cabeçalho)
    while (grid.children.length > 7) {
        grid.removeChild(grid.lastChild);
    }
    
    // Preencher dias vazios antes do início do mês
    for (let i = 0; i < diaSemanaInicio; i++) {
        const diaVazio = document.createElement('div');
        diaVazio.className = 'p-2';
        grid.appendChild(diaVazio);
    }
    
    // Data atual para comparação
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    
    // Preencher dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        // Verificar se há entradas ou despesas neste dia
        const entradasDia = (dados.entradas || []).filter(e => e.data === dataStr);
        const despesasDia = (dados.despesas || []).filter(d => d.vencimento === dataStr || d.dataPagamento === dataStr);
        const gastosAvulsosDia = (dados.gastosAvulsos || []).filter(g => g.data === dataStr && g.mes === mesKey);
        
        const totalEntradas = entradasDia.reduce((acc, e) => acc + (e.valor || 0), 0);
        const totalDespesas = despesasDia.reduce((acc, d) => acc + (d.pago || d.previsto || 0), 0);
        const totalGastosAvulsos = gastosAvulsosDia.reduce((acc, g) => acc + (g.valor || 0), 0);
        const totalDespesasCompleto = totalDespesas + totalGastosAvulsos;
        
        const diaDiv = document.createElement('div');
        const ehHoje = dataStr === hojeStr;
        
        const temMovimentacao = totalEntradas > 0 || totalDespesasCompleto > 0;
        
        // Todos os dias são clicáveis para adicionar/ver transações
        diaDiv.className = `p-2 min-h-[80px] border rounded-lg ${
            ehHoje ? 'bg-blue-100 dark:bg-blue-900 border-blue-500' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
        } hover:shadow-lg cursor-pointer transition-shadow`;
        
        // Indicadores visuais simples
        let indicadores = '';
        if (totalEntradas > 0 || totalDespesasCompleto > 0) {
            indicadores = '<div class="flex justify-center gap-1 mt-1">';
            if (totalEntradas > 0) {
                const qtdEntradas = entradasDia.length;
                indicadores += `<div class="flex items-center gap-0.5" title="${qtdEntradas} entrada(s): ${formatarMoeda(totalEntradas)}">
                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span class="text-xs text-green-600 dark:text-green-400 font-semibold">${qtdEntradas}</span>
                </div>`;
            }
            if (totalDespesasCompleto > 0) {
                const qtdDespesas = despesasDia.length + gastosAvulsosDia.length;
                indicadores += `<div class="flex items-center gap-0.5" title="${qtdDespesas} despesa(s): ${formatarMoeda(totalDespesasCompleto)}">
                    <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span class="text-xs text-red-600 dark:text-red-400 font-semibold">${qtdDespesas}</span>
                </div>`;
            }
            indicadores += '</div>';
        }
        
        diaDiv.innerHTML = `
            <div class="text-center font-bold ${ehHoje ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'} mb-1">
                ${dia}
            </div>
            ${indicadores}
        `;
        
        // Adicionar evento de clique para mostrar detalhes/adicionar
        diaDiv.addEventListener('click', () => {
            mostrarDetalhesDia(dataStr, entradasDia, despesasDia, gastosAvulsosDia);
        });
        
        grid.appendChild(diaDiv);
    }
};

const mostrarDetalhesDia = (data, entradas, despesas, gastosAvulsos = []) => {
    // Armazenar data selecionada globalmente
    window.calendarioDataSelecionada = data;
    
    // Ocultar view principal e mostrar view de detalhes
    document.getElementById('calendario-view-principal').classList.add('hidden');
    document.getElementById('calendario-view-detalhes').classList.remove('hidden');
    
    // Atualizar título com a data
    const dataFormatada = formatarData(data);
    document.getElementById('detalhes-data').textContent = `📅 ${dataFormatada}`;
    
    // Botões de ação para adicionar transações
    let botoesAcao = `
        <div class="flex gap-2 mb-6 flex-wrap">
            <button onclick="abrirFormularioNoCalendario('entrada')" class="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Nova Entrada
            </button>
            <button onclick="abrirFormularioNoCalendario('gastoFixo')" class="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Gasto Fixo
            </button>
            <button onclick="abrirFormularioNoCalendario('gastoAvulso')" class="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Gasto Avulso
            </button>
        </div>
    `;
    
    // Construir HTML dos detalhes
    let detalhesHTML = botoesAcao;
    
    if (entradas.length > 0) {
        detalhesHTML += `
            <div class="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border-l-4 border-green-500 p-4 rounded-lg">
                <h4 class="text-lg font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Entradas
                </h4>
                <ul class="space-y-2">
        `;
        entradas.forEach(e => {
            detalhesHTML += `
                <li class="flex justify-between items-center">
                    <span class="text-gray-700 dark:text-gray-300">• ${e.descricao}</span>
                    <span class="font-bold text-green-700 dark:text-green-400">${formatarMoeda(e.valor)}</span>
                </li>
            `;
        });
        detalhesHTML += `</ul></div>`;
    }
    
    if (despesas.length > 0) {
        detalhesHTML += `
            <div class="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border-l-4 border-red-500 p-4 rounded-lg">
                <h4 class="text-lg font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                    </svg>
                    Despesas Fixas
                </h4>
                <ul class="space-y-2">
        `;
        despesas.forEach(d => {
            const valor = d.pago > 0 ? d.pago : d.previsto;
            const status = d.pago > 0 ? '✓' : '○';
            const statusClass = d.pago > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400';
            detalhesHTML += `
                <li class="flex justify-between items-center">
                    <span class="text-gray-700 dark:text-gray-300">
                        <span class="${statusClass}">${status}</span> ${d.descricao}
                    </span>
                    <span class="font-bold text-red-700 dark:text-red-400">${formatarMoeda(valor)}</span>
                </li>
            `;
        });
        detalhesHTML += `</ul></div>`;
    }
    
    if (gastosAvulsos.length > 0) {
        detalhesHTML += `
            <div class="bg-orange-50 dark:bg-orange-900 dark:bg-opacity-20 border-l-4 border-orange-500 p-4 rounded-lg">
                <h4 class="text-lg font-bold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Gastos Avulsos
                </h4>
                <ul class="space-y-2">
        `;
        gastosAvulsos.forEach(g => {
            detalhesHTML += `
                <li class="flex justify-between items-center">
                    <span class="text-gray-700 dark:text-gray-300">
                        • ${g.descricao} ${g.pessoa ? `<span class="text-xs text-gray-500 dark:text-gray-400">(${g.pessoa})</span>` : ''}
                    </span>
                    <span class="font-bold text-orange-700 dark:text-orange-400">${formatarMoeda(g.valor)}</span>
                </li>
            `;
        });
        detalhesHTML += `</ul></div>`;
    }
    
    if (entradas.length === 0 && despesas.length === 0 && gastosAvulsos.length === 0) {
        detalhesHTML = `
            <div class="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg text-center">
                <p class="text-gray-500 dark:text-gray-400 text-lg">Nenhuma movimentação neste dia.</p>
            </div>
        `;
    }
    
    // Inserir HTML na div de detalhes
    document.getElementById('detalhes-conteudo').innerHTML = detalhesHTML;
};

// Event Listeners do Calendário
document.getElementById('btn-calendario').addEventListener('click', abrirCalendario);

document.getElementById('btn-mes-anterior').addEventListener('click', () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() - 1);
    renderizarCalendario();
});

document.getElementById('btn-mes-proximo').addEventListener('click', () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() + 1);
    renderizarCalendario();
});

document.getElementById('btn-voltar-calendario').addEventListener('click', () => {
    // Voltar para a view principal do calendário
    document.getElementById('calendario-view-detalhes').classList.add('hidden');
    document.getElementById('calendario-view-principal').classList.remove('hidden');
    // Fechar formulário se estiver aberto
    fecharFormularioCalendario();
});

// ===== FORMULÁRIOS NO CALENDÁRIO =====

window.abrirFormularioNoCalendario = (tipo) => {
    const container = document.getElementById('calendario-formulario-container');
    const titulo = document.getElementById('calendario-formulario-titulo');
    const conteudo = document.getElementById('calendario-formulario-conteudo');
    const data = window.calendarioDataSelecionada;
    
    // Mostrar container
    container.classList.remove('hidden');
    
    // Scroll suave para o formulário
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    if (tipo === 'entrada') {
        titulo.textContent = '💰 Nova Entrada';
        conteudo.innerHTML = `
            <form id="form-entrada-calendario" class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                    <input type="text" id="cal-entrada-descricao" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Ex: Salário, Freelance">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
                    <input type="number" id="cal-entrada-valor" step="0.01" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="0,00">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label>
                    <input type="date" id="cal-entrada-data" value="${data}" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                    <select id="cal-entrada-categoria" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                        <option value="">Selecione...</option>
                        ${categorias.map(cat => `<option value="${typeof cat === 'object' ? cat.nome : cat}">${typeof cat === 'object' ? cat.nome : cat}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <textarea id="cal-entrada-observacoes" rows="2" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Observações opcionais"></textarea>
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="submit" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        Adicionar Entrada
                    </button>
                    <button type="button" onclick="fecharFormularioCalendario()" class="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors">
                        Cancelar
                    </button>
                </div>
            </form>
        `;
        
        document.getElementById('form-entrada-calendario').addEventListener('submit', (e) => {
            e.preventDefault();
            salvarEntradaDoCalendario();
        });
    } else if (tipo === 'gastoFixo') {
        titulo.textContent = '💸 Novo Gasto Fixo';
        conteudo.innerHTML = `
            <form id="form-gasto-fixo-calendario" class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                    <input type="text" id="cal-gasto-descricao" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Ex: Aluguel, Internet">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Previsto (R$) *</label>
                        <input type="number" id="cal-gasto-previsto" step="0.01" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="0,00">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pago (R$)</label>
                        <input type="number" id="cal-gasto-pago" step="0.01" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="0,00">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vencimento *</label>
                        <input type="date" id="cal-gasto-vencimento" value="${data}" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pagamento</label>
                        <input type="date" id="cal-gasto-pagamento" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                    <select id="cal-gasto-categoria" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                        <option value="">Selecione...</option>
                        ${categorias.map(cat => `<option value="${typeof cat === 'object' ? cat.nome : cat}">${typeof cat === 'object' ? cat.nome : cat}</option>`).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" id="cal-gasto-recorrente" class="w-4 h-4">
                        Recorrente
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" id="cal-gasto-debito" class="w-4 h-4">
                        Débito Automático
                    </label>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <textarea id="cal-gasto-observacoes" rows="2" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Observações opcionais"></textarea>
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="submit" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        Adicionar Gasto Fixo
                    </button>
                    <button type="button" onclick="fecharFormularioCalendario()" class="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors">
                        Cancelar
                    </button>
                </div>
            </form>
        `;
        
        document.getElementById('form-gasto-fixo-calendario').addEventListener('submit', (e) => {
            e.preventDefault();
            salvarGastoFixoDoCalendario();
        });
    } else if (tipo === 'gastoAvulso') {
        titulo.textContent = '🛒 Novo Gasto Avulso';
        conteudo.innerHTML = `
            <form id="form-gasto-avulso-calendario" class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pessoa</label>
                    <input type="text" id="cal-avulso-pessoa" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Ex: João, Maria">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                    <input type="text" id="cal-avulso-descricao" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Ex: Mercado, Farmácia">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
                    <input type="number" id="cal-avulso-valor" step="0.01" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="0,00">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label>
                    <input type="date" id="cal-avulso-data" value="${data}" required class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                    <select id="cal-avulso-categoria" class="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white">
                        <option value="">Selecione...</option>
                        ${categorias.map(cat => `<option value="${typeof cat === 'object' ? cat.nome : cat}">${typeof cat === 'object' ? cat.nome : cat}</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="submit" class="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        Adicionar Gasto Avulso
                    </button>
                    <button type="button" onclick="fecharFormularioCalendario()" class="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors">
                        Cancelar
                    </button>
                </div>
            </form>
        `;
        
        document.getElementById('form-gasto-avulso-calendario').addEventListener('submit', (e) => {
            e.preventDefault();
            salvarGastoAvulsoDoCalendario();
        });
    }
};

window.fecharFormularioCalendario = () => {
    document.getElementById('calendario-formulario-container').classList.add('hidden');
};

const salvarEntradaDoCalendario = () => {
    const novaEntrada = {
        descricao: document.getElementById('cal-entrada-descricao').value.trim(),
        valor: parseFloat(document.getElementById('cal-entrada-valor').value) || 0,
        data: document.getElementById('cal-entrada-data').value,
        categoria: document.getElementById('cal-entrada-categoria').value || '---',
        observacoes: document.getElementById('cal-entrada-observacoes').value.trim()
    };
    
    entradas.push(novaEntrada);
    salvarDados();
    fecharFormularioCalendario();
    mostrarToast('Entrada adicionada com sucesso!', 'success');
    
    // Recarregar calendário e detalhes
    renderizarCalendario();
    const data = window.calendarioDataSelecionada;
    const mesKey = data.substring(0, 7);
    const chave = `contas-firebase-${mesKey}`;
    const dadosSalvos = localStorage.getItem(chave);
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        const entradasDia = (dados.entradas || []).filter(e => e.data === data);
        const despesasDia = (dados.despesas || []).filter(d => d.vencimento === data || d.dataPagamento === data);
        const gastosAvulsosDia = (dados.gastosAvulsos || []).filter(g => g.data === data && g.mes === mesKey);
        mostrarDetalhesDia(data, entradasDia, despesasDia, gastosAvulsosDia);
    }
};

const salvarGastoFixoDoCalendario = () => {
    const novoGasto = {
        descricao: document.getElementById('cal-gasto-descricao').value.trim(),
        previsto: parseFloat(document.getElementById('cal-gasto-previsto').value) || 0,
        pago: parseFloat(document.getElementById('cal-gasto-pago').value) || 0,
        vencimento: document.getElementById('cal-gasto-vencimento').value,
        dataPagamento: document.getElementById('cal-gasto-pagamento').value || '',
        categoria: document.getElementById('cal-gasto-categoria').value || '---',
        recorrente: document.getElementById('cal-gasto-recorrente').checked,
        debitoAutomatico: document.getElementById('cal-gasto-debito').checked,
        observacoes: document.getElementById('cal-gasto-observacoes').value.trim()
    };
    
    despesas.push(novoGasto);
    salvarDados();
    fecharFormularioCalendario();
    mostrarToast('Gasto fixo adicionado com sucesso!', 'success');
    
    // Recarregar calendário e detalhes
    renderizarCalendario();
    const data = window.calendarioDataSelecionada;
    const mesKey = data.substring(0, 7);
    const chave = `contas-firebase-${mesKey}`;
    const dadosSalvos = localStorage.getItem(chave);
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        const entradasDia = (dados.entradas || []).filter(e => e.data === data);
        const despesasDia = (dados.despesas || []).filter(d => d.vencimento === data || d.dataPagamento === data);
        const gastosAvulsosDia = (dados.gastosAvulsos || []).filter(g => g.data === data && g.mes === mesKey);
        mostrarDetalhesDia(data, entradasDia, despesasDia, gastosAvulsosDia);
    }
};

const salvarGastoAvulsoDoCalendario = () => {
    const data = document.getElementById('cal-avulso-data').value;
    const mesKey = data.substring(0, 7);
    
    const novoGastoAvulso = {
        id: Date.now(),
        pessoa: document.getElementById('cal-avulso-pessoa').value.trim() || 'Sem pessoa',
        descricao: document.getElementById('cal-avulso-descricao').value.trim(),
        valor: parseFloat(document.getElementById('cal-avulso-valor').value) || 0,
        data: data,
        mes: mesKey,
        categoria: document.getElementById('cal-avulso-categoria').value || 'Sem categoria'
    };
    
    gastosAvulsos.push(novoGastoAvulso);
    salvarDados();
    fecharFormularioCalendario();
    mostrarToast('Gasto avulso adicionado com sucesso!', 'success');
    
    // Recarregar calendário e detalhes
    renderizarCalendario();
    const chave = `contas-firebase-${mesKey}`;
    const dadosSalvos = localStorage.getItem(chave);
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        const entradasDia = (dados.entradas || []).filter(e => e.data === data);
        const despesasDia = (dados.despesas || []).filter(d => d.vencimento === data || d.dataPagamento === data);
        const gastosAvulsosDia = (dados.gastosAvulsos || []).filter(g => g.data === data && g.mes === mesKey);
        mostrarDetalhesDia(data, entradasDia, despesasDia, gastosAvulsosDia);
    }
};

