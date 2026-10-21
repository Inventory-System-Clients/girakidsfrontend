import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { ConfirmProvider, Spinner, ToastProvider } from "./components/ui";
import { Header } from "./components/Header";
import PrivateRoute from "./components/PrivateRoute";
import Catalogo from "./pages/Catalogo";
import Login from "./pages/Login";
import Registrar from "./pages/Registrar";
import AlertasClientes from "./components/AlertasClientes";
import { WhatsappFlutuante } from "./components/Whatsapp";

const Checkout = lazy(() => import("./pages/Checkout"));
const Pagamento = lazy(() => import("./pages/Pagamento"));
const MeusPedidos = lazy(() => import("./pages/MeusPedidos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const HistoricoPedidos = lazy(() => import("./pages/HistoricoPedidos"));
const Expedicao = lazy(() => import("./pages/Expedicao"));
const MontagemPedido = lazy(() => import("./pages/MontagemPedido"));
const Banners = lazy(() => import("./pages/Banners"));
const CustosPosVenda = lazy(() => import("./pages/comercial/CustosPosVenda"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Entradas = lazy(() => import("./pages/Entradas"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const BuscaTransportadoras = lazy(() => import("./pages/comercial/BuscaTransportadoras").then((m) => ({ default: m.BuscaTransportadoras })));
const CalculadoraPedidos = lazy(() => import("./pages/comercial/CalculadoraPedidos").then((m) => ({ default: m.CalculadoraPedidos })));
const PedidosNotasFiscais = lazy(() => import("./pages/comercial/PedidosNotasFiscais").then((m) => ({ default: m.PedidosNotasFiscais })));
const Correios = lazy(() => import("./pages/comercial/Correios").then((m) => ({ default: m.Correios })));

const Protegida = ({ permissoes, children }) => <PrivateRoute permissoes={permissoes}>{children}</PrivateRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Header />
              <AlertasClientes />
              <WhatsappFlutuante />
              <Suspense
                fallback={
                  <div className="flex min-h-[50vh] items-center justify-center">
                    <Spinner className="h-8 w-8" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Catalogo />} />
                  <Route path="/catalogo" element={<Catalogo />} />
                  <Route path="/produto/:produtoId" element={<Catalogo />} />
                  <Route path="/banners" element={<Protegida permissoes={["PRODUTOS", "COMERCIAL"]}><Banners /></Protegida>} />
                  <Route path="/comercial/custos-pos-venda" element={<Protegida permissoes={["COMERCIAL", "FINANCEIRO", "VENDAS"]}><CustosPosVenda /></Protegida>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/registrar" element={<Registrar />} />
                  <Route path="/checkout" element={<Protegida><Checkout /></Protegida>} />
                  <Route path="/pagamento/:id" element={<Protegida><Pagamento /></Protegida>} />
                  <Route path="/meus-pedidos" element={<Protegida><MeusPedidos /></Protegida>} />
                  <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
                  <Route path="/dashboard" element={<Protegida permissoes={["FINANCEIRO"]}><Dashboard /></Protegida>} />
                  <Route path="/historico-pedidos" element={<Protegida permissoes={["VENDAS"]}><HistoricoPedidos /></Protegida>} />
                  <Route path="/expedicao" element={<Protegida permissoes={["EXPEDICAO"]}><Expedicao /></Protegida>} />
                  <Route path="/expedicao/:id" element={<Protegida permissoes={["EXPEDICAO"]}><MontagemPedido /></Protegida>} />
                  <Route path="/produtos" element={<Protegida permissoes={["PRODUTOS"]}><Produtos /></Protegida>} />
                  <Route path="/entradas" element={<Protegida permissoes={["ENTRADAS"]}><Entradas /></Protegida>} />
                  <Route path="/orcamentos" element={<Protegida permissoes={["ORCAMENTOS"]}><Checkout modo="orcamento" /></Protegida>} />
                  <Route path="/usuarios" element={<Protegida permissoes={["USUARIOS"]}><Usuarios /></Protegida>} />
                  <Route path="/comercial/transportadoras" element={<Protegida permissoes={["COMERCIAL"]}><BuscaTransportadoras /></Protegida>} />
                  <Route path="/comercial/calculadora-pedidos" element={<Protegida permissoes={["COMERCIAL"]}><CalculadoraPedidos /></Protegida>} />
                  <Route path="/comercial/pedidos-notas-fiscais" element={<Protegida permissoes={["COMERCIAL"]}><PedidosNotasFiscais /></Protegida>} />
                  <Route path="/comercial/correios" element={<Protegida permissoes={["COMERCIAL"]}><Correios /></Protegida>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ConfirmProvider>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
