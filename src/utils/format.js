export const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Preço por unidade pode ter mais casas (ex.: R$ 0,4167).
export const moedaUnitaria = (valor) => {
  const n = Number(valor || 0);
  const casas = Math.round(n * 100) === n * 100 ? 2 : 4;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: casas });
};

export const numero = (valor, casas = 0) =>
  Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const percentual = (valor) => `${numero(valor, 2)}%`;

const TZ = { timeZone: "America/Sao_Paulo" };

export const data = (valor) => (valor ? new Date(valor.length === 10 ? `${valor}T12:00:00` : valor).toLocaleDateString("pt-BR", TZ) : "-");

export const dataHora = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR", { ...TZ, dateStyle: "short", timeStyle: "short" }) : "-";

// "20/10/26, 10:15 UTC-03" como nas colunas dos times.
export const carimbo = (valor) =>
  valor
    ? `${new Date(valor).toLocaleString("pt-BR", { ...TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })} UTC-03`
    : "";

export const hojeISO = () => new Date().toLocaleDateString("en-CA", TZ);

export const inicioMesISO = () => `${hojeISO().slice(0, 8)}01`;

export const somenteDigitos = (v) => String(v || "").replace(/\D/g, "");

export const mascaraDocumento = (v) => {
  const d = somenteDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export const mascaraCpf = (v) => mascaraDocumento(somenteDigitos(v).slice(0, 11));

export const mascaraCnpj = (v) => {
  const d = somenteDigitos(v).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export const mascaraTelefone = (v) => {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

export const mascaraCep = (v) => somenteDigitos(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

export const lerNumero = (v) => {
  if (typeof v === "number") return v;
  const t = String(v || "").trim();
  if (!t) return 0;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0;
};

export const pesoKg = (gramas) => `${numero(Number(gramas || 0) / 1000, 1)}kg`;

export const UFS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

// Consulta de CEP (ViaCEP) para preencher endereço.
export const buscarCep = async (cep) => {
  const d = somenteDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { rua: j.logradouro, bairro: j.bairro, cidade: j.localidade, estado: j.uf, complemento: j.complemento };
  } catch {
    return null;
  }
};

// Exporta linhas para CSV (abre no Excel com acentos).
export const exportarCsv = (nome, colunas, linhas) => {
  const esc = (v) => {
    const t = v == null ? "" : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const conteudo = [colunas.map((c) => esc(c.titulo)).join(";"), ...linhas.map((l) => colunas.map((c) => esc(c.valor(l))).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".csv") ? nome : `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// Comprime imagem no navegador antes do envio (como a loja original).
export const comprimirImagem = (arquivo, maximo = 1400, qualidade = 0.82) =>
  new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith("image/")) return resolve(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], arquivo.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" })),
        "image/webp",
        qualidade,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(arquivo);
  });
