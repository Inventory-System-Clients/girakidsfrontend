import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Carrinho salvo no navegador. Quantidade em pacotes; "precoUnitario" é o
// "Novo valor" que a equipe pode definir no checkout.
const CartContext = createContext({});
const CHAVE = "girakids_carrinho";

// Máximo de pacotes que cabem no estoque (por encomenda não tem limite). O
// servidor reconfere o estoque ao finalizar o pedido.
// eslint-disable-next-line react-refresh/only-export-components
export const limitePacotes = (produto) => {
  if (produto?.modoVenda === "ENCOMENDA" || produto?.estoque == null) return Infinity;
  return Math.floor(Math.max(0, Number(produto.estoque)) / Math.max(1, Number(produto.unidadesPacote || 1)));
};

const ler = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "[]");
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [itens, setItens] = useState(ler);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(itens));
    } catch {
      // Sem armazenamento: o carrinho vale só nesta aba.
    }
  }, [itens]);

  // Item "liberado" (admin lançou sem estoque) não tem limite: o estoque fica
  // negativo até a mercadoria chegar.
  const definirQuantidade = (produto, quantidade) => {
    setItens((atuais) => {
      const existente = atuais.find((i) => i.produto.id === produto.id);
      const limite = existente?.liberado ? Infinity : limitePacotes(produto);
      const q = Math.min(limite, Math.max(0, Math.round(Number(quantidade) || 0)));
      if (!q) return atuais.filter((i) => i.produto.id !== produto.id);
      if (existente) {
        return atuais.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: q } : i));
      }
      return [...atuais, { produto, quantidade: q, precoUnitario: null }];
    });
  };

  const liberarSemEstoque = (produto, quantidade) => {
    const q = Math.max(1, Math.round(Number(quantidade) || 0));
    setItens((atuais) =>
      atuais.some((i) => i.produto.id === produto.id)
        ? atuais.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: q, liberado: true } : i))
        : [...atuais, { produto, quantidade: q, precoUnitario: null, liberado: true }],
    );
  };

  const liberadoDe = (produtoId) => Boolean(itens.find((i) => i.produto.id === produtoId)?.liberado);

  const definirPreco = (produtoId, precoUnitario) =>
    setItens((atuais) => atuais.map((i) => (i.produto.id === produtoId ? { ...i, precoUnitario } : i)));

  const quantidadeDe = (produtoId) => itens.find((i) => i.produto.id === produtoId)?.quantidade || 0;

  const limpar = () => setItens([]);

  // Substitui o carrinho pelos itens de um pedido/orçamento carregado.
  const carregar = (novos) => setItens(novos);

  const resumo = useMemo(() => {
    const subtotal = itens.reduce((soma, i) => {
      const preco = i.precoUnitario != null && i.precoUnitario !== "" ? Number(i.precoUnitario) : i.produto.precoVenda;
      return soma + preco * (i.produto.unidadesPacote || 1) * i.quantidade;
    }, 0);
    return { subtotal, quantidade: itens.length };
  }, [itens]);

  return (
    <CartContext.Provider
      value={{ itens, definirQuantidade, liberarSemEstoque, liberadoDe, definirPreco, quantidadeDe, limpar, carregar, ...resumo }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
