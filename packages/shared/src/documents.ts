export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const check = (length: number): number => {
    const sum = digits.slice(0, length).reduce((acc, digit, index) => acc + digit * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const values = cnpj.split("").map((char) => char.charCodeAt(0) - 48);
  const check = (length: number): number => {
    const weights = CNPJ_WEIGHTS.slice(CNPJ_WEIGHTS.length - length);
    const sum = values.slice(0, length).reduce((acc, current, index) => acc + current * (weights[index] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === values[12] && check(13) === values[13];
}

export function formatCpf(value: string): string {
  const cpf = onlyDigits(value);
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  return cnpj.replace(/^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
