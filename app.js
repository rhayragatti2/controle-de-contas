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
    const dados = {
        entradas: entradas,
        despesas: despesas
    };
    
    const chave = getChaveMes(mesAtual);
    localStorage.setItem(chave, JSON.stringify(dados));
    
    // Sincronizar com Firebase com indicador visual
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        mostrarIndicadorSincronizacao(true);
        window.firebaseSync.sincronizarMesParaFirebase(mesAtual, dados);
        setTimeout(() => mostrarIndicadorSincronizacao(false), 800);
    }
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
    } else {
        entradas = [];
        despesas = [];
    }
    
    // Carregar gastos avulsos do mês
    carregarGastosAvulsos(mes);

    renderizarTudo();
    verificarVencimentos();
    
    // Atualizar listener do Firebase para o novo mês
    if (window.firebaseSync && window.firebaseSync.isEnabled()) {
        window.firebaseSync.atualizarListenerMes(mes);
    }
};

const renderizarTudo = () => {
    renderizarEntradas();
    renderizarDespesas();
};

// ===== RESUMO MENSAL =====

const atualizarResumo = () => {
    const totalEntradas = entradas.reduce((acc, item) => acc + item.valor, 0);
    const totalPrevisto = despesas.reduce((acc, item) => acc + item.previsto, 0);
    let totalPago = despesas.reduce((acc, item) => acc + item.pago, 0);
    
    // Adicionar gastos avulsos ao total pago
    if (gastosAvulsos && gastosAvulsos.length > 0) {
        const gastosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
        const totalGastosAvulsos = gastosMes.reduce((acc, g) => acc + g.valor, 0);
        totalPago += totalGastosAvulsos;
    }
    
    const saldo = totalEntradas - totalPago;

    totalEntradasEl.textContent = formatarMoeda(totalEntradas);
    totalPrevistoEl.textContent = formatarMoeda(totalPrevisto);
    totalPagoEl.textContent = formatarMoeda(totalPago);
    saldoEl.textContent = formatarMoeda(saldo);

    saldoEl.classList.remove('text-green-400', 'text-red-400', 'text-gray-100');
    if (saldo > 0) {
        saldoEl.classList.add('text-green-400');
    } else if (saldo < 0) {
        saldoEl.classList.add('text-red-400');
    } else {
        saldoEl.classList.add('text-gray-100');
    }
};

// ===== ENTRADAS =====

const renderizarEntradas = () => {
    tabelaEntradas.innerHTML = '';
    entradas.forEach((item, index) => {
        const corCategoria = getCorCategoria(item.categoria);

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="p-3">${formatarData(item.data)}</td>
            <td class="p-3">${item.descricao}</td>
            <td class="p-3 text-gray-600 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                <span>${item.categoria || '---'}</span>
            </td>
            <td class="p-3 text-right text-green-600 font-semibold">${formatarMoeda(item.valor)}</td>
            <td class="p-3 text-right">
                <button onclick="editarEntrada(${index})" class="text-blue-500 hover:text-blue-700 font-semibold mr-2" title="Editar">
                    ✏️
                </button>
                <button onclick="excluirEntrada(${index})" class="text-red-500 hover:text-red-700 font-semibold" title="Excluir">
                    🗑️
                </button>
            </td>
        `;
        tabelaEntradas.appendChild(tr);
    });
    atualizarResumo();
};

window.editarEntrada = (index) => {
    const entrada = entradas[index];
    document.getElementById('entrada-descricao').value = entrada.descricao;
    document.getElementById('entrada-data').value = formatISODateToBR(entrada.data);
    document.getElementById('entrada-valor').value = entrada.valor;
    document.getElementById('entrada-categoria').value = entrada.categoria;
    document.getElementById('entrada-id-edicao').value = index;
    document.getElementById('entrada-btn-texto').textContent = 'Atualizar Entrada';

    formEntrada.scrollIntoView({ behavior: 'smooth' });
    estadoEdicaoEntrada = index;
};

formEntrada.addEventListener('submit', (e) => {
    e.preventDefault();
    const descricao = document.getElementById('entrada-descricao').value.trim();
    const data = parseBRDateToISO(document.getElementById('entrada-data').value);
    const valor = parseFloat(document.getElementById('entrada-valor').value);
    const categoria = document.getElementById('entrada-categoria').value;
    const idEdicao = document.getElementById('entrada-id-edicao').value;

    if (!descricao || valor <= 0 || !data) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    if (idEdicao !== '') {
        // Modo edição
        const index = parseInt(idEdicao);
        entradas[index] = { data, descricao, valor, categoria };
        mostrarToast('Entrada atualizada!', 'success');
        document.getElementById('entrada-btn-texto').textContent = 'Adicionar Entrada';
        document.getElementById('entrada-id-edicao').value = '';
        estadoEdicaoEntrada = -1;
    } else {
        // Modo adição
        entradas.push({ data, descricao, valor, categoria });
        mostrarToast('Entrada adicionada!', 'success');
    }

    salvarDados();
    renderizarEntradas();
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

window.editarDespesa = (index) => {
    const despesa = despesas[index];
    document.getElementById('despesa-descricao').value = despesa.descricao;
    document.getElementById('despesa-vencimento').value = formatISODateToBR(despesa.vencimento);
    document.getElementById('despesa-previsto').value = despesa.previsto;
    document.getElementById('despesa-categoria').value = despesa.categoria;
    document.getElementById('despesa-tags').value = despesa.tags ? despesa.tags.join(', ') : '';
    document.getElementById('despesa-notas').value = despesa.notas || '';
    document.getElementById('despesa-recorrente').checked = despesa.recorrente || false;
    document.getElementById('despesa-debito-automatico').checked = despesa.debitoAutomatico || false;
    document.getElementById('despesa-id-edicao').value = index;
    document.getElementById('despesa-btn-texto').textContent = 'Atualizar Despesa';

    formDespesa.scrollIntoView({ behavior: 'smooth' });
};

const renderizarDespesas = () => {
    tabelaDespesas.innerHTML = '';
    despesas.forEach((item, index) => {
        const corCategoria = getCorCategoria(item.categoria);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors';

        const estaPago = item.pago > 0 && item.dataPagamento;
        const pagoClasseDataValor = estaPago ? 'text-gray-400 line-through' : '';

        if (index === estadoEdicaoDespesa) {
            tr.classList.add('bg-yellow-50', 'shadow-inner');
            tr.innerHTML = `
                <td class="p-3 font-semibold">${item.descricao}</td>
                <td colspan="5" class="p-3">
                    <div class="flex flex-col md:flex-row gap-2 items-center w-full">
                        <label class="font-medium text-sm text-gray-700 w-full md:w-auto flex-shrink-0">Pago em:</label>
                        <input type="text" id="input-pagamento-data" 
                               value="${formatISODateToBR(item.dataPagamento) || ''}" 
                               placeholder="DD/MM/AAAA"
                               class="p-1 border rounded w-full md:w-36 text-sm">
                        
                        <label class="font-medium text-sm text-gray-700 w-full md:w-auto flex-shrink-0">Valor Pago:</label>
                        <input type="number" id="input-pagamento-valor" value="${item.pago || item.previsto}" 
                               min="0" step="0.01" class="p-1 border rounded w-full md:w-28 text-sm text-right">
                        
                        <button onclick="salvarPagamento(${index})" 
                                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex-shrink-0 w-full md:w-auto">
                            Salvar
                        </button>
                        <button onclick="cancelarEdicao()" 
                                class="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400 transition-colors flex-shrink-0 w-full md:w-auto">
                            Cancelar
                        </button>
                    </div>
                </td>
                <td class="p-3 text-right">
                    <button onclick="editarDespesa(${index})" class="text-blue-500 hover:text-blue-700 font-semibold mr-2" title="Editar Despesa">
                        ✏️
                    </button>
                    <button onclick="excluirDespesa(${index})" class="text-red-500 hover:text-red-700 font-semibold" title="Excluir">🗑️</button>
                </td>
            `;
        } else {
            // Criar badges
            let badges = '';
            if (item.debitoAutomatico) {
                badges += '<span class="badge-debito-automatico ml-2">🏦 Débito Automático</span>';
            }
            if (item.recorrente && !item.debitoAutomatico) {
                badges += '<span class="badge-recorrente ml-2">🔄 Recorrente</span>';
            }
            if (item.parcelado) {
                badges += '<span class="badge-parcelado ml-2">💳 Parcelado</span>';
            }
            
            tr.innerHTML = `
                <td class="p-3">
                    <div class="flex items-center flex-wrap gap-1">
                        <span>${item.descricao}</span>
                        ${badges}
                    </div>
                </td>
                <td class="p-3 text-gray-600 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                    <span>${item.categoria || '---'}</span>
                </td>
                <td class="p-3 font-medium ${pagoClasseDataValor}">${formatarData(item.vencimento)}</td>
                <td class="p-3 ${estaPago ? 'text-gray-700 font-medium' : 'text-gray-400 italic'}">${formatarData(item.dataPagamento)}</td>
                <td class="p-3 text-right text-red-500 ${pagoClasseDataValor}">
                    ${formatarMoeda(item.previsto)}
                </td>
                <td class="p-3 text-right font-bold ${item.pago > 0 ? 'text-red-700' : 'text-gray-400'}">
                    ${formatarMoeda(item.pago)}
                </td>
                <td class="p-3 text-right flex flex-col gap-1 items-end w-40">
                    <button onclick="editarPagamento(${index})" 
                            class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors w-full">
                        ${estaPago ? 'Editar Pag.' : 'Registrar Pag.'}
                    </button>
                    <button onclick="editarDespesa(${index})" class="text-blue-500 hover:text-blue-700 font-semibold text-sm w-full mt-1">
                        ✏️ Editar
                    </button>
                    <button onclick="excluirDespesa(${index})" class="text-red-500 hover:text-red-700 font-semibold text-sm w-full mt-1">
                        🗑️ Excluir
                    </button>
                </td>
            `;
        }
        tabelaDespesas.appendChild(tr);
    });
    atualizarResumo();
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

    let dados = { entradas: [], despesas: [] };
    if (dadosSalvos) {
        try {
            dados = JSON.parse(dadosSalvos);
        } catch (e) {
            console.error(`Erro ao carregar dados para ${mesKey}`, e);
        }
    }

    const totalEntradas = (dados.entradas || []).reduce((acc, item) => acc + item.valor, 0);
    const totalPrevisto = (dados.despesas || []).reduce((acc, item) => acc + item.previsto, 0);
    const totalPago = (dados.despesas || []).reduce((acc, item) => acc + item.pago, 0);
    const saldo = totalEntradas - totalPago;

    return {
        mesKey,
        nomeMes: obterNomeMes(mesKey),
        totalEntradas,
        totalPrevisto,
        totalPago,
        saldo,
        despesas: dados.despesas || []
    };
};

const renderizarLinhaResumo = (titulo, valor, corClass) => `
    <div class="flex justify-between items-center py-2 border-b">
        <span class="text-gray-700">${titulo}</span>
        <span class="font-bold text-lg ${corClass}">${formatarMoeda(valor)}</span>
    </div>
`;

const renderizarGraficoMensal = (despesasDoMes) => {
    const canvasEl = document.getElementById('grafico-despesas');
    if (!canvasEl) return;

    if (chartDespesas) {
        chartDespesas.destroy();
    }

    const despesasPorCategoria = despesasDoMes
        .filter(d => d.pago > 0 && d.categoria)
        .reduce((acc, item) => {
            acc[item.categoria] = (acc[item.categoria] || 0) + item.pago;
            return acc;
        }, {});

    const categoriasOrdenadas = Object.keys(despesasPorCategoria).sort((a, b) => despesasPorCategoria[b] - despesasPorCategoria[a]);
    const labels = categoriasOrdenadas;
    const data = categoriasOrdenadas.map(cat => despesasPorCategoria[cat]);
    const backgroundColors = labels.map(getCorHexCategoria);

    if (data.length === 0) {
        canvasEl.style.display = 'none';
        return;
    } else {
        canvasEl.style.display = 'block';
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
                ${resumo.despesas.filter(d => d.pago > 0).length === 0 ? '<p class="mt-4 text-gray-500">Nenhuma despesa paga neste mês para gerar o gráfico.</p>' : ''}
            </div>
        </div>
    `;

    renderizarGraficoMensal(resumo.despesas);
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

// Listener do botão de modo escuro
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
    btnDarkMode.addEventListener('click', toggleDarkMode);
}

// ===== GASTOS AVULSOS COM LINGUAGEM NATURAL =====

let gastosAvulsos = [];

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
    }
    
    // Extrair local/descrição (após "no" ou "na")
    let local = '';
    const regexLocal = /n[oa]\s+(?:débito|crédito|pix|dinheiro)\s+n[oa]\s+(.+?)$/i;
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
        const palavrasLimpas = texto.replace(/gastei|comprei|reais?|débito|crédito|pix|dinheiro|n[oa]/gi, '').trim();
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
    
    // Preencher preview
    document.getElementById('preview-valor').value = valor.toFixed(2);
    document.getElementById('preview-pagamento').value = formaPagamento;
    document.getElementById('preview-local').value = local;
    
    // Data de hoje
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    document.getElementById('preview-data').value = `${dia}/${mes}/${ano}`;
    
    // Mostrar preview
    document.getElementById('preview-gasto-avulso').classList.remove('hidden');
    
    // Scroll suave
    document.getElementById('preview-gasto-avulso').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    mostrarToast('✅ Texto processado! Revise e confirme.', 'success');
};

// Confirmar e adicionar gasto avulso
window.confirmarGastoAvulso = () => {
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
    
    // Criar gasto avulso
    const gastoAvulso = {
        descricao: local,
        formaPagamento,
        data: parseBRDateToISO(data),
        valor,
        categoria: categoria || 'Sem categoria',
        mes: mesAtual
    };
    
    // Adicionar ao array
    if (!gastosAvulsos) gastosAvulsos = [];
    gastosAvulsos.push(gastoAvulso);
    
    // Salvar no localStorage
    salvarGastosAvulsos();
    
    // Renderizar tabela
    renderizarGastosAvulsos();
    
    // Limpar campos
    document.getElementById('input-gasto-natural').value = '';
    document.getElementById('preview-gasto-avulso').classList.add('hidden');
    
    mostrarToast('💰 Gasto avulso adicionado!', 'success');
    
    // Atualizar resumo (somar gastos avulsos ao total pago)
    atualizarResumo();
};

// Cancelar preview
window.cancelarGastoAvulso = () => {
    document.getElementById('preview-gasto-avulso').classList.add('hidden');
    document.getElementById('input-gasto-natural').value = '';
};

// Renderizar tabela de gastos avulsos
const renderizarGastosAvulsos = () => {
    const tabela = document.getElementById('tabela-gastos-avulsos');
    if (!tabela) return;
    
    tabela.innerHTML = '';
    
    // Filtrar gastos do mês atual
    const gastosMes = gastosAvulsos.filter(g => g.mes === mesAtual);
    
    if (gastosMes.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500 dark:text-gray-400 italic">Nenhum gasto avulso registrado neste mês</td></tr>';
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
        }
        
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        tr.innerHTML = `
            <td class="p-3 font-medium dark:text-gray-300">${gasto.descricao}</td>
            <td class="p-3 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                <span>${gasto.categoria}</span>
            </td>
            <td class="p-3">${badgePagamento}</td>
            <td class="p-3 text-gray-600 dark:text-gray-400">${formatarData(gasto.data)}</td>
            <td class="p-3 text-right text-red-600 dark:text-red-400 font-bold">${formatarMoeda(gasto.valor)}</td>
            <td class="p-3 text-right">
                <button onclick="excluirGastoAvulso(${gastosAvulsos.indexOf(gasto)})" 
                        class="text-red-500 hover:text-red-700 font-semibold text-sm">
                    🗑️ Excluir
                </button>
            </td>
        `;
        tabela.appendChild(tr);
    });
};

// Excluir gasto avulso
window.excluirGastoAvulso = (index) => {
    if (!confirm('Tem certeza que deseja excluir este gasto?')) return;
    
    gastosAvulsos.splice(index, 1);
    salvarGastosAvulsos();
    renderizarGastosAvulsos();
    atualizarResumo();
    mostrarToast('Gasto excluído!', 'success');
};

// Salvar gastos avulsos no localStorage
const salvarGastosAvulsos = () => {
    if (!mesAtual) return;
    const chave = `contas-gastos-avulsos-${mesAtual}`;
    localStorage.setItem(chave, JSON.stringify(gastosAvulsos));
};

// Carregar gastos avulsos do localStorage
const carregarGastosAvulsos = (mes) => {
    const chave = `contas-gastos-avulsos-${mes}`;
    const dados = localStorage.getItem(chave);
    gastosAvulsos = dados ? JSON.parse(dados) : [];
    renderizarGastosAvulsos();
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
    
    // Carrega categorias
    carregarCategorias();

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const mesFormatado = `${ano}-${mes}`;

    seletorMes.value = mesFormatado;
    carregarDados(mesFormatado);
    
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
});

