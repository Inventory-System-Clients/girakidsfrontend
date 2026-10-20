import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const mensagemErro = (error, padrao = "Ocorreu um erro inesperado") =>
  error?.response?.data?.error || error?.message || padrao;

// Envia imagem/PDF para o backend e devolve a URL pública. Imagens vão para
// o Cloudinary (pasta: produtos | expedicao | notas) quando configurado.
export const enviarArquivo = async (arquivo, pasta = "produtos") => {
  const dados = new FormData();
  dados.append("pasta", pasta);
  dados.append("arquivo", arquivo);
  const { data } = await api.post("/arquivos", dados, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
};

export default api;
