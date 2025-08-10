require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Conexão com o MongoDB Atlas ---
// A MONGODB_URI virá das variáveis de ambiente (do arquivo .env localmente, ou das configurações da Vercel)
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
    try {
        const registros = await RegistroDiario.insertMany(req.body);
        res.status(201).json(registros);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Rota para BUSCAR registros por MÊS e ANO para os relatórios
app.get('/api/registros/por-mes', async (req, res) => {
    const { ano, mes } = req.query; 

    if (!ano || !mes) {
        return res.status(400).json({ message: 'Ano e mês são obrigatórios.' });
    }

    try {
        const regexData = new RegExp(`^${ano}-${mes}-`);
        const registros = await RegistroDiario.find({ data: { $regex: regexData } }).sort({ data: 1 });
        res.json(registros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// COLE ESTE BLOCO NO ARQUIVO api/server.js, ANTES DA PARTE "if (!process.env.VERCEL_ENV)"

// Rota para BUSCAR registros por DIA específico
app.get('/api/registros/por-dia', async (req, res) => {
    const { data } = req.query; // Ex: data=2025-08-09

    if (!data) {
        return res.status(400).json({ message: 'A data é obrigatória.' });
    }

    try {
        const registros = await RegistroDiario.find({ data: data }).sort({ nome: 1 });
        res.json(registros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// COLE ESTE BLOCO NO ARQUIVO api/server.js, ANTES DA PARTE "if (!process.env.VERCEL_ENV)"

// Rota para GERAR a Folha de Pagamento
app.get('/api/folha-pagamento', async (req, res) => {
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
        return res.status(400).json({ message: 'Data de início e fim são obrigatórias.' });
    }

    try {
        const registros = await RegistroDiario.find({
            data: { $gte: dataInicio, $lte: dataFim }
        }).sort({ data: 1 });

        // Estrutura para agrupar dados por trabalhador
        const payrollData = {};

        registros.forEach(reg => {
            if (!payrollData[reg.nome]) {
                payrollData[reg.nome] = {};
            }
            const valorDiario = (reg.producao && reg.preco) ? reg.producao * reg.preco : 0;
            
            if (reg.status === 'Falta') {
                payrollData[reg.nome][reg.data] = 'FALTA';
            } else {
                payrollData[reg.nome][reg.data] = (payrollData[reg.nome][reg.data] || 0) + valorDiario;
            }
        });

        res.json(payrollData);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Esta parte só vai rodar o servidor quando estivermos em ambiente local.
// A Vercel gerencia o servidor automaticamente no ambiente de produção (nuvem).
if (!process.env.VERCEL_ENV) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor local pronto em http://localhost:${PORT}`);
    });
}

// Exporta o app para a Vercel usar
module.exports = app;