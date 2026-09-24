/** Máscara de digitação de valores em R$: "12345" → "123,45". */
export function formatCurrencyInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  const numberValue = Number(digits) / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte o texto mascarado ("1.234,56") de volta para número. */
export function parseCurrencyToNumber(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, "").replace(",", ".");
  return Number(clean) || 0;
}

/** Número → texto no formato da máscara, para preencher um input já existente. */
export function toCurrencyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
