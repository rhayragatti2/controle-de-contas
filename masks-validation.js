// ===== MÁSCARAS E VALIDAÇÕES =====

// Função para aplicar máscara de data DD/MM/YYYY
const aplicarMascaraData = (elemento) => {
    if (!elemento) return;
    
    elemento.addEventListener('input', (e) => {
        let valor = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
        
        if (valor.length >= 2) {
            valor = valor.substring(0, 2) + '/' + valor.substring(2);
        }
        if (valor.length >= 5) {
            valor = valor.substring(0, 5) + '/' + valor.substring(5, 9);
        }
        
        e.target.value = valor.substring(0, 10); // Limita a 10 caracteres
    });
    
    // Validar ao sair do campo
    elemento.addEventListener('blur', () => {
        if (elemento.value && elemento.value.length === 10) {
            validarDataCompleta(elemento);
        }
    });
};

// Função para aplicar máscara de data DD/MM (sem ano)
const aplicarMascaraDataCurta = (elemento) => {
    if (!elemento) return;
    
    elemento.addEventListener('input', (e) => {
        let valor = e.target.value.replace(/\D/g, '');
        
        if (valor.length >= 2) {
            valor = valor.substring(0, 2) + '/' + valor.substring(2);
        }
        
        e.target.value = valor.substring(0, 5);
    });
};

// Função para validar data completa DD/MM/YYYY
const validarDataCompleta = (elemento) => {
    const valor = elemento.value;
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = valor.match(regex);
    
    if (!match) {
        mostrarErroValidacao(elemento, 'Data inválida. Use DD/MM/AAAA');
        return false;
    }
    
    const [_, dia, mes, ano] = match;
    const data = new Date(ano, mes - 1, dia);
    
    // Validar se a data é real
    if (data.getDate() != dia || data.getMonth() + 1 != mes || data.getFullYear() != ano) {
        mostrarErroValidacao(elemento, 'Data inválida');
        return false;
    }
    
    // Validar range de ano razoável
    const anoNum = parseInt(ano);
    if (anoNum < 2000 || anoNum > 2100) {
        mostrarErroValidacao(elemento, 'Ano inválido');
        return false;
    }
    
    limparErroValidacao(elemento);
    return true;
};

// Função para validar data curta DD/MM
const validarDataCurta = (elemento) => {
    const valor = elemento.value;
    const regex = /^(\d{2})\/(\d{2})$/;
    const match = valor.match(regex);
    
    if (!match) {
        mostrarErroValidacao(elemento, 'Data inválida. Use DD/MM');
        return false;
    }
    
    const [_, dia, mes] = match;
    const diaNum = parseInt(dia);
    const mesNum = parseInt(mes);
    
    if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) {
        mostrarErroValidacao(elemento, 'Data inválida');
        return false;
    }
    
    limparErroValidacao(elemento);
    return true;
};

// Função para validar valor numérico
const validarValorNumerico = (elemento, minimo = 0.01) => {
    const valor = parseFloat(elemento.value);
    
    if (isNaN(valor) || valor < minimo) {
        mostrarErroValidacao(elemento, `Valor deve ser maior ou igual a ${minimo.toFixed(2)}`);
        return false;
    }
    
    limparErroValidacao(elemento);
    return true;
};

// Função para validar campo obrigatório
const validarCampoObrigatorio = (elemento, mensagem = 'Este campo é obrigatório') => {
    const valor = elemento.value.trim();
    if (!valor) {
        mostrarErroValidacao(elemento, mensagem);
        return false;
    }
    limparErroValidacao(elemento);
    return true;
};

// Função para mostrar erro de validação
const mostrarErroValidacao = (elemento, mensagem) => {
    // Remove erro anterior se existir
    limparErroValidacao(elemento);
    
    // Adiciona borda vermelha
    elemento.classList.add('border-red-500', 'border-2');
    elemento.classList.remove('border-gray-300', 'dark:border-gray-600');
    
    // Cria elemento de erro
    const erro = document.createElement('p');
    erro.className = 'text-red-500 text-xs mt-1 erro-validacao';
    erro.textContent = mensagem;
    
    // Insere após o elemento
    elemento.parentNode.insertBefore(erro, elemento.nextSibling);
};

// Função para limpar erro de validação
const limparErroValidacao = (elemento) => {
    // Remove borda vermelha
    elemento.classList.remove('border-red-500', 'border-2');
    elemento.classList.add('border-gray-300', 'dark:border-gray-600');
    
    // Remove mensagem de erro
    const erro = elemento.parentNode.querySelector('.erro-validacao');
    if (erro) {
        erro.remove();
    }
};

// Função para inicializar todas as máscaras e validações
const inicializarMascarasEValidacoes = () => {
    // Aplicar máscaras em campos de data DD/MM
    const camposDataCurta = [
        'entrada-data',
        'despesa-vencimento'
    ];
    
    camposDataCurta.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && campo.type === 'text') {
            aplicarMascaraDataCurta(campo);
            campo.placeholder = 'DD/MM';
            campo.maxLength = 5;
            campo.inputMode = 'numeric';
        }
    });
    
    // Validação em tempo real para campos numéricos
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value) {
                validarValorNumerico(input);
            }
        });
        
        // Prevenir valores negativos
        input.addEventListener('input', () => {
            if (parseFloat(input.value) < 0) {
                input.value = '';
            }
        });
    });
    
    // Validação em tempo real para campos obrigatórios
    document.querySelectorAll('input[required], textarea[required], select[required]').forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value.trim()) {
                limparErroValidacao(input);
            } else if (input.hasAttribute('required')) {
                validarCampoObrigatorio(input);
            }
        });
    });
    
    // Limitar caracteres em campos de texto
    document.querySelectorAll('input[type="text"]:not([id*="data"])').forEach(input => {
        if (!input.maxLength || input.maxLength === -1) {
            input.maxLength = 100; // Limite padrão
        }
    });
    
    // Limitar textareas
    document.querySelectorAll('textarea').forEach(textarea => {
        if (!textarea.maxLength || textarea.maxLength === -1) {
            textarea.maxLength = 500; // Limite padrão para observações
        }
        
        // Contador de caracteres (opcional)
        const parent = textarea.parentNode;
        const counter = document.createElement('p');
        counter.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1 text-right';
        counter.textContent = `0/${textarea.maxLength}`;
        parent.appendChild(counter);
        
        textarea.addEventListener('input', () => {
            counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
        });
    });
};

// Função global para validar formulário antes de submeter
window.validarFormulario = (formulario) => {
    let valido = true;
    
    // Validar todos os campos obrigatórios
    formulario.querySelectorAll('input[required], textarea[required], select[required]').forEach(input => {
        if (!validarCampoObrigatorio(input)) {
            valido = false;
        }
    });
    
    // Validar campos numéricos
    formulario.querySelectorAll('input[type="number"]').forEach(input => {
        if (input.value && !validarValorNumerico(input)) {
            valido = false;
        }
    });
    
    // Validar campos de data
    formulario.querySelectorAll('input[type="text"][id*="data"]').forEach(input => {
        if (input.value) {
            if (input.value.length === 5) {
                if (!validarDataCurta(input)) valido = false;
            } else if (input.value.length === 10) {
                if (!validarDataCompleta(input)) valido = false;
            }
        }
    });
    
    return valido;
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarMascarasEValidacoes);
} else {
    inicializarMascarasEValidacoes();
}

// Reinicializar após mudanças dinâmicas no DOM
window.reinicializarValidacoes = inicializarMascarasEValidacoes;

