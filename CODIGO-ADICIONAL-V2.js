/*** 
 * CÓDIGO ADICIONAL PARA APP.JS - V2.0
 * Cole este código no app.js após a seção de elementos do DOM
 ***/

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
};

// ===== DASHBOARD EXPANDIDO =====

const atualizarDashboardExpandido = () => {
    // Maior Despesa
    const despesasPagas = despesas.filter(d => d.pago > 0);
    if (despesasPagas.length > 0) {
        const maiorDespesa = despesasPagas.reduce((max, d) => d.pago > max.pago ? d : max);
        document.getElementById('maior-despesa').textContent = maiorDespesa.descricao;
        document.getElementById('maior-despesa-valor').textContent = formatarMoeda(maiorDespesa.pago);
    } else {
        document.getElementById('maior-despesa').textContent = '---';
        document.getElementById('maior-despesa-valor').textContent = '---';
    }

    // Categoria Top
    const gastosPorCategoria = {};
    despesasPagas.forEach(d => {
        if (d.categoria) {
            gastosPorCategoria[d.categoria] = (gastosPorCategoria[d.categoria] || 0) + d.pago;
        }
    });
    
    const categoriaTop = Object.keys(gastosPorCategoria).reduce((max, cat) => {
        return gastosPorCategoria[cat] > (gastosPorCategoria[max] || 0) ? cat : max;
    }, '');
    
    if (categoriaTop) {
        document.getElementById('categoria-top').textContent = categoriaTop;
        document.getElementById('categoria-top-valor').textContent = formatarMoeda(gastosPorCategoria[categoriaTop]);
    } else {
        document.getElementById('categoria-top').textContent = '---';
        document.getElementById('categoria-top-valor').textContent = '---';
    }

    // Média Diária
    const totalPago = despesasPagas.reduce((sum, d) => sum + d.pago, 0);
    const hoje = new Date();
    const diasDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const mediaDiaria = totalPago / diasDoMes;
    document.getElementById('media-diaria').textContent = formatarMoeda(mediaDiaria);
};

// ===== PREVISÃO DE SALDO =====

const atualizarPrevisaoSaldo = () => {
    const totalEntradas = entradas.reduce((acc, item) => acc + item.valor, 0);
    const totalPago = despesas.reduce((acc, item) => acc + item.pago, 0);
    const despesasNaoPagas = despesas.filter(d => d.pago === 0).reduce((acc, d) => acc + d.previsto, 0);
    
    const previsaoFinal = totalEntradas - totalPago - despesasNaoPagas;
    
    const el = document.getElementById('previsao-saldo');
    el.textContent = formatarMoeda(previsaoFinal);
    
    // Muda cor baseado no valor
    el.classList.remove('text-green-300', 'text-red-300', 'text-cyan-300');
    if (previsaoFinal > 0) {
        el.classList.add('text-green-300');
    } else if (previsaoFinal < 0) {
        el.classList.add('text-red-300');
    } else {
        el.classList.add('text-cyan-300');
    }
};

// ===== TAGS =====

const parseTags = (tagsString) => {
    if (!tagsString) return [];
    return tagsString.split(',').map(t => t.trim()).filter(t => t);
};

const renderTags = (tags) => {
    if (!tags || tags.length === 0) return '';
    return tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');
};

// ===== NOTAS =====

const renderNota = (nota) => {
    if (!nota) return '';
    return `
        <span class="tooltip nota-icon">
            📝
            <span class="tooltiptext">${nota}</span>
        </span>
    `;
};

// ===== DESPESAS RECORRENTES =====

window.gerarDespesasRecorrentes = () => {
    if (!mesAtual) {
        mostrarToast('Selecione um mês primeiro!', 'error');
        return;
    }

    const despesasRecorrentes = despesas.filter(d => d.recorrente);
    
    if (despesasRecorrentes.length === 0) {
        mostrarToast('Nenhuma despesa recorrente encontrada!', 'warning');
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
    const entradas ProximoMes = dadosProximoMes ? JSON.parse(dadosProximoMes).entradas || [] : [];
    localStorage.setItem(chaveProximoMes, JSON.stringify({
        entradas: entradasProximoMes,
        despesas: despesasProximoMes
    }));
    
    mostrarToast(`${contador} despesa(s) recorrente(s) copiada(s) para ${obterNomeMes(proximoMesKey)}!`, 'success');
};

// ===== PARCELAMENTO =====

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

// ===== FILTROS E BUSCA =====

let filtroEntrada = { busca: '', categoria: '' };
let filtroDespesa = { busca: '', categoria: '', status: '' };

const aplicarFiltrosEntradas = () => {
    const buscaEl = document.getElementById('busca-entrada');
    const categoriaEl = document.getElementById('filtro-entrada-categoria');
    
    filtroEntrada.busca = buscaEl?.value.toLowerCase() || '';
    filtroEntrada.categoria = categoriaEl?.value || '';
    
    renderizarEntradas();
};

const aplicarFiltrosDespesas = () => {
    const buscaEl = document.getElementById('busca-despesa');
    const categoriaEl = document.getElementById('filtro-despesa-categoria');
    const statusEl = document.getElementById('filtro-despesa-status');
    
    filtroDespesa.busca = buscaEl?.value.toLowerCase() || '';
    filtroDespesa.categoria = categoriaEl?.value || '';
    filtroDespesa.status = statusEl?.value || '';
    
    renderizarDespesas();
};

const filtrarEntradas = () => {
    return entradas.filter(e => {
        const matchBusca = !filtroEntrada.busca || 
            e.descricao.toLowerCase().includes(filtroEntrada.busca) ||
            (e.notas && e.notas.toLowerCase().includes(filtroEntrada.busca));
        
        const matchCategoria = !filtroEntrada.categoria || e.categoria === filtroEntrada.categoria;
        
        return matchBusca && matchCategoria;
    });
};

const filtrarDespesas = () => {
    return despesas.filter(d => {
        const matchBusca = !filtroDespesa.busca || 
            d.descricao.toLowerCase().includes(filtroDespesa.busca) ||
            (d.notas && d.notas.toLowerCase().includes(filtroDespesa.busca));
        
        const matchCategoria = !filtroDespesa.categoria || d.categoria === filtroDespesa.categoria;
        
        let matchStatus = true;
        if (filtroDespesa.status === 'pago') matchStatus = d.pago > 0;
        else if (filtroDespesa.status === 'pendente') matchStatus = d.pago === 0;
        else if (filtroDespesa.status === 'recorrente') matchStatus = d.recorrente;
        else if (filtroDespesa.status === 'parcelado') matchStatus = d.parcelado;
        else if (filtroDespesa.status === 'debito-automatico') matchStatus = d.debitoAutomatico;
        
        return matchBusca && matchCategoria && matchStatus;
    });
};

// ===== POPULAR FILTROS =====

const popularFiltrosCategorias = () => {
    const filtroEntradaCategoria = document.getElementById('filtro-entrada-categoria');
    const filtroDespesaCategoria = document.getElementById('filtro-despesa-categoria');
    
    if (filtroEntradaCategoria) {
        filtroEntradaCategoria.innerHTML = '<option value="">Todas categorias</option>';
        categorias.forEach(cat => {
            filtroEntradaCategoria.appendChild(new Option(cat.nome, cat.nome));
        });
    }
    
    if (filtroDespesaCategoria) {
        filtroDespesaCategoria.innerHTML = '<option value="">Todas categorias</option>';
        categorias.forEach(cat => {
            filtroDespesaCategoria.appendChild(new Option(cat.nome, cat.nome));
        });
    }
};

// ===== PWA SERVICE WORKER =====

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.log('Erro ao registrar Service Worker:', err));
    });
}

