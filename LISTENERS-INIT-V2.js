/***
 * LISTENERS E INICIALIZAÇÃO ATUALIZADOS - V2.0
 * Adicione/atualize no final do app.js
 ***/

// ===== LISTENERS DO FORM DE ENTRADA (COM TAGS/NOTAS) =====

formEntrada.addEventListener('submit', (e) => {
    e.preventDefault();
    const descricao = document.getElementById('entrada-descricao').value.trim();
    const data = parseBRDateToISO(document.getElementById('entrada-data').value);
    const valor = parseFloat(document.getElementById('entrada-valor').value);
    const categoria = document.getElementById('entrada-categoria').value;
    const tags = parseTags(document.getElementById('entrada-tags').value);
    const notas = document.getElementById('entrada-notas').value.trim();
    const idEdicao = document.getElementById('entrada-id-edicao').value;

    if (!descricao || valor <= 0 || !data) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    if (idEdicao !== '') {
        // Modo edição
        const index = parseInt(idEdicao);
        entradas[index] = { data, descricao, valor, categoria, tags, notas };
        mostrarToast('Entrada atualizada!', 'success');
        document.getElementById('entrada-btn-texto').textContent = 'Adicionar Entrada';
        document.getElementById('entrada-id-edicao').value = '';
        estadoEdicaoEntrada = -1;
    } else {
        // Modo adição
        entradas.push({ data, descricao, valor, categoria, tags, notas });
        mostrarToast('Entrada adicionada!', 'success');
    }

    salvarDados();
    renderizarEntradas();
    formEntrada.reset();
});

// ===== LISTENERS DO FORM DE DESPESA (COM TAGS/NOTAS/RECORRENTE/PARCELAMENTO) =====

formDespesa.addEventListener('submit', (e) => {
    e.preventDefault();
    const descricao = document.getElementById('despesa-descricao').value.trim();
    const vencimento = parseBRDateToISO(document.getElementById('despesa-vencimento').value);
    const previsto = parseFloat(document.getElementById('despesa-previsto').value);
    const categoria = document.getElementById('despesa-categoria').value;
    const tags = parseTags(document.getElementById('despesa-tags').value);
    const notas = document.getElementById('despesa-notas').value.trim();
    const recorrente = document.getElementById('despesa-recorrente').checked;
    const parcelada = document.getElementById('despesa-parcelada').checked;
    const parcelas = parseInt(document.getElementById('despesa-parcelas').value) || 0;
    const idEdicao = document.getElementById('despesa-id-edicao').value;

    if (!descricao || !vencimento || previsto <= 0) {
        mostrarToast('Preencha todos os campos corretamente!', 'error');
        return;
    }

    if (parcelada && (parcelas < 2 || parcelas > 48)) {
        mostrarToast('Parcelas devem estar entre 2 e 48!', 'error');
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
        mostrarToast('Despesa atualizada!', 'success');
        document.getElementById('despesa-btn-texto').textContent = 'Adicionar Despesa (Planejamento)';
        document.getElementById('despesa-id-edicao').value = '';
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
                recorrente: false
            };
            criarDespesasParceladas(despesaBase, parcelas);
            mostrarToast(`${parcelas} parcelas criadas com sucesso!`, 'success');
            carregarDados(mesAtual); // Recarrega para mostrar a primeira parcela
        } else {
            // Despesa normal
            despesas.push({
                descricao,
                vencimento,
                dataPagamento: '',
                previsto,
                pago: 0,
                categoria,
                tags,
                notas,
                recorrente,
                parcelado: false
            });
            mostrarToast('Despesa adicionada!', 'success');
            salvarDados();
            renderizarDespesas();
        }
    }

    verificarVencimentos();
    formDespesa.reset();
    document.getElementById('despesa-parcelas').disabled = true;
});

// ===== LISTENERS DE FILTROS =====

// Busca e filtros de entradas
const setupFiltrosEntradas = () => {
    const buscaEl = document.getElementById('busca-entrada');
    const categoriaEl = document.getElementById('filtro-entrada-categoria');
    const limparEl = document.getElementById('limpar-filtros-entrada');
    
    if (buscaEl) {
        buscaEl.addEventListener('input', aplicarFiltrosEntradas);
    }
    
    if (categoriaEl) {
        categoriaEl.addEventListener('change', aplicarFiltrosEntradas);
    }
    
    if (limparEl) {
        limparEl.addEventListener('click', () => {
            if (buscaEl) buscaEl.value = '';
            if (categoriaEl) categoriaEl.value = '';
            filtroEntrada = { busca: '', categoria: '' };
            renderizarEntradas();
        });
    }
};

// Busca e filtros de despesas
const setupFiltrosDespesas = () => {
    const buscaEl = document.getElementById('busca-despesa');
    const categoriaEl = document.getElementById('filtro-despesa-categoria');
    const statusEl = document.getElementById('filtro-despesa-status');
    const limparEl = document.getElementById('limpar-filtros-despesa');
    
    if (buscaEl) {
        buscaEl.addEventListener('input', aplicarFiltrosDespesas);
    }
    
    if (categoriaEl) {
        categoriaEl.addEventListener('change', aplicarFiltrosDespesas);
    }
    
    if (statusEl) {
        statusEl.addEventListener('change', aplicarFiltrosDespesas);
    }
    
    if (limparEl) {
        limparEl.addEventListener('click', () => {
            if (buscaEl) buscaEl.value = '';
            if (categoriaEl) categoriaEl.value = '';
            if (statusEl) statusEl.value = '';
            filtroDespesa = { busca: '', categoria: '', status: '' };
            renderizarDespesas();
        });
    }
};

// ===== LISTENERS DOS BOTÕES =====

// Botão de Modo Escuro
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
    btnDarkMode.addEventListener('click', toggleDarkMode);
}

// Botão de Gerar Recorrentes
const btnGerarRecorrentes = document.getElementById('btn-gerar-recorrentes');
if (btnGerarRecorrentes) {
    btnGerarRecorrentes.addEventListener('click', gerarDespesasRecorrentes);
}

// Outros botões existentes (mantém como está)
btnRelatorio.addEventListener('click', abrirRelatorio);
btnBackup.addEventListener('click', abrirModalBackup);
btnExportar.addEventListener('click', abrirModalExportar);

seletorMes.addEventListener('change', (e) => {
    const novoMes = e.target.value;
    if (novoMes) {
        carregarDados(novoMes);
    }
});

// ===== INICIALIZAÇÃO ATUALIZADA =====

document.addEventListener('DOMContentLoaded', () => {
    // Carrega dark mode
    carregarDarkMode();
    
    // Carrega categorias
    carregarCategorias();
    
    // Popula filtros
    popularFiltrosCategorias();
    
    // Setup de filtros
    setupFiltrosEntradas();
    setupFiltrosDespesas();
    
    // Setup checkbox de parcelamento
    setupParcelamentoCheckbox();
    
    // Carrega mês atual
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const mesFormatado = `${ano}-${mes}`;
    
    seletorMes.value = mesFormatado;
    carregarDados(mesFormatado);
});

