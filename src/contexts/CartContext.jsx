import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Carrinho salvo no navegador. Quantidade em pacotes; "precoUnitario" é o
// "Novo valor" que a equipe pode definir no checkout.
const CartContext = createContext({});
const CHAVE = "girakids_carrinho";

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

  const definirQuantidade = (produto, quantidade) => {
    setItens((atuais) => {
      const q = Math.max(0, Math.round(Number(quantidade) || 0));
      const existente = atuais.find((i) => i.produto.id === produto.id);
      if (!q) return atuais.filter((i) => i.produto.id !== produto.id);
      if (existente) {
        return atuais.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: q } : i));
      }
      return [...atuais, { produto, quantidade: q, precoUnitario: null }];
    });
  };

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
      value={{ itens, definirQuantidade, definirPreco, quantidadeDe, limpar, carregar, ...resumo }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
