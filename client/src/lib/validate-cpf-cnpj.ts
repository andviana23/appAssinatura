// Função para validar CPF
export function validarCPF(cpf: string): boolean {
  const numerosCpf = cpf.replace(/[^\d]/g, '');
  
  if (numerosCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numerosCpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(numerosCpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numerosCpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(numerosCpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numerosCpf.charAt(10))) return false;

  return true;
}

// Função para validar CNPJ
export function validarCNPJ(cnpj: string): boolean {
  const numerosCnpj = cnpj.replace(/[^\d]/g, '');
  
  if (numerosCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(numerosCnpj)) return false;

  let tamanho = numerosCnpj.length - 2;
  let numeros = numerosCnpj.substring(0, tamanho);
  let digitos = numerosCnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = numerosCnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

// Função para validar CPF ou CNPJ
export function validarCpfCnpj(documento: string): boolean {
  if (!documento) return false;
  
  const numeros = documento.replace(/[^\d]/g, '');
  
  if (numeros.length === 11) {
    return validarCPF(documento);
  } else if (numeros.length === 14) {
    return validarCNPJ(documento);
  }
  
  return false;
}

// Função para formatar CPF
export function formatarCPF(cpf: string): string {
  const numeros = cpf.replace(/[^\d]/g, '');
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Função para formatar CNPJ
export function formatarCNPJ(cnpj: string): string {
  const numeros = cnpj.replace(/[^\d]/g, '');
  return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Função para formatar CPF ou CNPJ automaticamente
export function formatarCpfCnpj(documento: string): string {
  const numeros = documento.replace(/[^\d]/g, '');
  
  if (numeros.length <= 11) {
    return formatarCPF(numeros);
  } else {
    return formatarCNPJ(numeros);
  }
}