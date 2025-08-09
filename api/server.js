const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// --- Conexão com o MongoDB Atlas ---
// A MONGODB_URI virá das variáveis de ambiente da Vercel
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelos do Banco de Dados (Schemas) ---

const FazendaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  proprietario: String,
  cidade: String,
  ativa: Boolean,
});
const Fazenda = mongoose.model('Fazenda', FazendaSchema);

const ServicoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  ativo: Boolean,
});
const Servico = mongoose.model('Servico', ServicoSchema);

const TrabalhadorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  ativo: Boolean,
  registrado: Boolean,
  dataRegistro: Date,
});
const Trabalhador = mongoose.model('Trabalhador', TrabalhadorSchema);

const RegistroDiarioSchema = new mongoose.Schema({
  data: { type: String, required: true },
  nome: { type: String, required: true },
  status: String,
  detalhes: String,
  fazenda: String,
  producao: Number,
  preco: Number,
  timestamp: { type: Date, default: Date.now },
});
const RegistroDiario = mongoose.model('RegistroDiario', RegistroDiarioSchema);


// --- Rotas da API (Endpoints) ---

// Rota de teste
app.get('/api', (req, res) => {
  res.send('API do Sistema Agrícola funcionando!');
});

// CRUD para Fazendas
app.post('/api/fazendas', async (req, res) => res.status(201).json(await new Fazenda(req.body).save()));
app.get('/api/fazendas', async (req, res) => res.json(await Fazenda.find()));
app.put('/api/fazendas/:id', async (req, res) => res.json(await Fazenda.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/fazendas/:id', async (req, res) => res.json(await Fazenda.findByIdAndDelete(req.params.id)));

// CRUD para Serviços
app.post('/api/servicos', async (req, res) => res.status(201).json(await new Servico(req.body).save()));
app.get('/api/servicos', async (req, res) => res.json(await Servico.find()));
app.put('/api/servicos/:id', async (req, res) => res.json(await Servico.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/servicos/:id', async (req, res) => res.json(await Servico.findByIdAndDelete(req.params.id)));

// CRUD para Trabalhadores
app.post('/api/trabalhadores', async (req, res) => res.status(201).json(await new Trabalhador(req.body).save()));
app.get('/api/trabalhadores', async (req, res) => res.json(await Trabalhador.find()));
app.put('/api/trabalhadores/:id', async (req, res) => res.json(await Trabalhador.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/trabalhadores/:id', async (req, res) => res.json(await Trabalhador.findByIdAndDelete(req.params.id)));

// Rota para salvar TODOS os registros diários de uma vez
app.post('/api/registros', async (req, res) => {
    // req.body deve ser um array de objetos de registro
    try {
        const registros = await RegistroDiario.insertMany(req.body);
        res.status(201).json(registros);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Necessário para a Vercel
module.exports = app;