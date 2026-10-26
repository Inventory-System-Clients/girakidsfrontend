import {
  Banknote,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  QrCode,
  Receipt,
  Repeat,
  Smartphone,
  Wallet,
} from "lucide-react";

export const FORMAS_PAGAMENTO = {
  PIX_ONLINE: { label: "PIX online", icone: QrCode },
  CREDITO_ONLINE: { label: "Crédito online", icone: CreditCard },
  DEBITO_ONLINE: { label: "Débito online", icone: CreditCard },
  CREDITO_LINK: { label: "Crédito link", icone: CreditCard },
  LINK_PAGAMENTO: { label: "Link de pagamento", icone: CreditCard },
  MAQUININHA: { label: "Maquininha", icone: Smartphone },
  PIX_PRESENCIAL: { label: "PIX presencial", icone: QrCode },
  DINHEIRO: { label: "Dinheiro", icone: Banknote },
  BOLETO: { label: "Boleto", icone: FileText },
  CHEQUE: { label: "Cheque", icone: Receipt },
  TRANSFERENCIA: { label: "Transferência Bancária", icone: Landmark },
  PERMUTA: { label: "Permuta", icone: Repeat },
  A_RECEBER: { label: "A receber", icone: HandCoins },
  A_DEFINIR: { label: "A definir", icone: Wallet },
  MESCLA: { label: "Mescla de pagamentos", icone: Wallet },
};

export const nomeForma = (codigo) => FORMAS_PAGAMENTO[codigo]?.label || codigo || "-";

export const METODOS_ENVIO = {
  RETIRAR_LOCAL: "Retirar no local",
  TRANSPORTADORA: "Transportadora",
  PAC: "PAC",
  SEDEX: "SEDEX",
};

export const FINANCEIRO = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  ATRASADO: "Atrasado",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

export const VENDAS = {
  AGUARDANDO: "Aguardando",
  LIBERADO: "Liberado",
  CANCELADO: "Cancelado",
};

export const EXPEDICAO = {
  NAO_INICIADO: "-",
  MONTAGEM: "Montagem Pedido",
  EXPEDIDO: "Expedido",
};

// Cores fortes dos status (pílulas nas tabelas de pedidos).
export const COR_STATUS = {
  financeiro: {
    AGUARDANDO_PAGAMENTO: "bg-amber-500 text-white",
    ATRASADO: "bg-red-600 text-white",
    PAGO: "bg-emerald-600 text-white",
    CANCELADO: "bg-slate-500 text-white",
  },
  vendas: {
    AGUARDANDO: "bg-amber-500 text-white",
    LIBERADO: "bg-blue-600 text-white",
    CANCELADO: "bg-red-600 text-white",
  },
  expedicao: {
    MONTAGEM: "bg-violet-600 text-white",
    MONTADO: "bg-indigo-600 text-white",
    EXPEDIDO: "bg-emerald-600 text-white",
  },
};

export const ROLES = {
  ADMIN: "Administrador",
  FUNCIONARIO: "Funcionário",
  CLIENTE: "Cliente",
  SHOWROOM: "Showroom (totem)",
};

// Cor da linha na tabela de pedidos (como na loja original).
export const corLinhaPedido = (pedido) => {
  if (pedido.statusVendas === "CANCELADO") return "bg-red-100 hover:bg-red-200/70";
  if (pedido.statusVendas === "AGUARDANDO") return "bg-amber-100 hover:bg-amber-200/70";
  if (pedido.statusExpedicao === "EXPEDIDO") return "bg-emerald-50 hover:bg-emerald-100";
  return "bg-sky-100/80 hover:bg-sky-200/70";
};

export const TIPOS_EMBALAGEM = {
  "": "Usar estimativa por peso",
  ball_27mm: "Bolinha 27mm",
  ball_32mm: "Bolinha 32mm",
  ball_45mm: "Bolinha 45mm",
  enc_1inch: 'Encapsulado 1"',
  enc_2inch: 'Encapsulado 2"',
  enc_105mm: "Encapsulado 105mm",
  cap_empty_1inch: 'Cápsula Vazia 1"',
  cap_empty_2inch: 'Cápsula Vazia 2"',
  cap_empty_105mm: "Cápsula Vazia 105mm",
  peso: "Estimativa por Peso",
  frete_indisponivel: "Frete Indisponível (contato obrigatório)",
};
