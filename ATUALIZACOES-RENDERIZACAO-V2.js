/***
 * ATUALIZAÇÕES PARA AS FUNÇÕES DE RENDERIZAÇÃO - V2.0
 * Substitua as funções antigas pelas versões atualizadas abaixo
 ***/

// ===== ATUALIZAR RESUMO (COM PREVISÃO E DASHBOARD) =====

const atualizarResumo = () => {
    const totalEntradas = entradas.reduce((acc, item) => acc + item.valor, 0);
    const totalPrevisto = despesas.reduce((acc, item) => acc + item.previsto, 0);
    const totalPago = despesas.reduce((acc, item) => acc + item.pago, 0);
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
    
    // NOVO: Atualiza previsão e dashboard
    atualizarPrevisaoSaldo();
    atualizarDashboardExpandido();
};

// ===== RENDERIZAR ENTRADAS (COM TAGS E NOTAS) =====

const renderizarEntradas = () => {
    tabelaEntradas.innerHTML = '';
    const entradasFiltradas = filtrarEntradas();
    
    entradasFiltradas.forEach((item, index) => {
        // Encontra índice real no array original
        const realIndex = entradas.indexOf(item);
        const corCategoria = getCorCategoria(item.categoria);

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors fade-in';
        tr.innerHTML = `
            <td class="p-3">${formatarData(item.data)}</td>
            <td class="p-3">
                <div class="flex items-center gap-2">
                    <span>${item.descricao}</span>
                    ${renderNota(item.notas)}
                </div>
                ${item.tags && item.tags.length > 0 ? `<div class="mt-1">${renderTags(item.tags)}</div>` : ''}
            </td>
            <td class="p-3 text-gray-600 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${corCategoria}"></span>
                <span>${item.categoria || '---'}</span>
            </td>
            <td class="p-3 text-right text-green-600 font-semibold">${formatarMoeda(item.valor)}</td>
            <td class="p-3 text-right">
                <button onclick="editarEntrada(${realIndex})" class="text-blue-500 hover:text-blue-700 font-semibold mr-2" title="Editar">
                    ✏️
                </button>
                <button onclick="excluirEntrada(${realIndex})" class="text-red-500 hover:text-red-700 font-semibold" title="Excluir">
                    🗑️
                </button>
            </td>
        `;
        tabelaEntradas.appendChild(tr);
    });
    atualizarResumo();
};

// ===== RENDERIZAR DESPESAS (COM TAGS, NOTAS, BADGES) =====

const renderizarDespesas = () => {
    tabelaDespesas.innerHTML = '';
    const despesasFiltradas = filtrarDespesas();
    
    despesasFiltradas.forEach((item, index) => {
        // Encontra índice real no array original
        const realIndex = despesas.indexOf(item);
        const corCategoria = getCorCategoria(item.categoria);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors fade-in';

        const estaPago = item.pago > 0 && item.dataPagamento;
        const pagoClasseDataValor = estaPago ? 'text-gray-400 line-through' : '';

        // Badges de recorrente/parcelado
        let badges = '';
        if (item.recorrente) {
            badges += '<span class="badge-recorrente mr-1">🔄 Recorrente</span>';
        }
        if (item.parcelado && item.totalParcelas) {
            badges += `<span class="badge-parcelado">💳 ${item.parcelaAtual}/${item.totalParcelas}</span>`;
        }

        if (realIndex === estadoEdicaoDespesa) {
            tr.classList.add('bg-yellow-50', 'shadow-inner');
            tr.innerHTML = `
                <td class="p-3 font-semibold">${item.descricao} ${badges}</td>
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
                        
                        <button onclick="salvarPagamento(${realIndex})" 
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
                    <button onclick="editarDespesa(${realIndex})" class="text-blue-500 hover:text-blue-700 font-semibold mr-2" title="Editar Despesa">
                        ✏️
                    </button>
                    <button onclick="excluirDespesa(${realIndex})" class="text-red-500 hover:text-red-700 font-semibold" title="Excluir">🗑️</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <span>${item.descricao}</span>
                        ${renderNota(item.notas)}
                    </div>
                    ${badges ? `<div class="mt-1">${badges}</div>` : ''}
                    ${item.tags && item.tags.length > 0 ? `<div class="mt-1">${renderTags(item.tags)}</div>` : ''}
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
                    <button onclick="editarPagamento(${realIndex})" 
                            class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors w-full">
                        ${estaPago ? 'Editar Pag.' : 'Registrar Pag.'}
                    </button>
                    <button onclick="editarDespesa(${realIndex})" class="text-blue-500 hover:text-blue-700 font-semibold text-sm w-full mt-1">
                        ✏️ Editar
                    </button>
                    <button onclick="excluirDespesa(${realIndex})" class="text-red-500 hover:text-red-700 font-semibold text-sm w-full mt-1">
                        🗑️ Excluir
                    </button>
                </td>
            `;
        }
        tabelaDespesas.appendChild(tr);
    });
    atualizarResumo();
};

// ===== ATUALIZAR FORM ENTRADA (EDIÇÃO COM TAGS/NOTAS) =====

window.editarEntrada = (index) => {
    const entrada = entradas[index];
    document.getElementById('entrada-descricao').value = entrada.descricao;
    document.getElementById('entrada-data').value = formatISODateToBR(entrada.data);
    document.getElementById('entrada-valor').value = entrada.valor;
    document.getElementById('entrada-categoria').value = entrada.categoria;
    document.getElementById('entrada-tags').value = entrada.tags ? entrada.tags.join(', ') : '';
    document.getElementById('entrada-notas').value = entrada.notas || '';
    document.getElementById('entrada-id-edicao').value = index;
    document.getElementById('entrada-btn-texto').textContent = 'Atualizar Entrada';

    formEntrada.scrollIntoView({ behavior: 'smooth' });
    estadoEdicaoEntrada = index;
};

// ===== ATUALIZAR FORM DESPESA (EDIÇÃO COM TAGS/NOTAS/RECORRENTE) =====

window.editarDespesa = (index) => {
    const despesa = despesas[index];
    document.getElementById('despesa-descricao').value = despesa.descricao;
    document.getElementById('despesa-vencimento').value = formatISODateToBR(despesa.vencimento);
    document.getElementById('despesa-previsto').value = despesa.previsto;
    document.getElementById('despesa-categoria').value = despesa.categoria;
    document.getElementById('despesa-tags').value = despesa.tags ? despesa.tags.join(', ') : '';
    document.getElementById('despesa-notas').value = despesa.notas || '';
    document.getElementById('despesa-recorrente').checked = despesa.recorrente || false;
    document.getElementById('despesa-id-edicao').value = index;
    document.getElementById('despesa-btn-texto').textContent = 'Atualizar Despesa';

    formDespesa.scrollIntoView({ behavior: 'smooth' });
};

// ===== ATUALIZAR LISTENER DO CHECKBOX DE PARCELAMENTO =====

const setupParcelamentoCheckbox = () => {
    const checkboxParcelada = document.getElementById('despesa-parcelada');
    const inputParcelas = document.getElementById('despesa-parcelas');
    
    if (checkboxParcelada && inputParcelas) {
        checkboxParcelada.addEventListener('change', (e) => {
            inputParcelas.disabled = !e.target.checked;
            if (e.target.checked) {
                inputParcelas.value = '2';
                inputParcelas.focus();
            } else {
                inputParcelas.value = '';
            }
        });
    }
};

