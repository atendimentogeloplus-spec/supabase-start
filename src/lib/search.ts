/** Normaliza texto: minúsculas, sem acentos, espaços simples. */
export const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Verdadeiro se o termo aparece em qualquer parte (início, meio ou fim) de algum dos textos. */
export const matches = (text: string | null | undefined | (string | null | undefined)[], term: string) => {
  const t = norm(term);
  if (!t) return true;
  const arr = Array.isArray(text) ? text : [text];
  return arr.some((x) => norm(x).includes(t));
};
