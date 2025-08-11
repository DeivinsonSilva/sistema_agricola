require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

// --- Conexão com o MongoDB Atlas ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelos do Banco de Dados (Schemas) ---
const FazendaSchema = new mongoose.Schema({ nome: { type: String, required: true }, proprietario: String, cidade: String, ativa: Boolean, });
const Fazenda = mongoose.model('Fazenda', FazendaSchema);

const ServicoSchema = new mongoose.Schema({ nome: { type: String, required: true }, preco: { type: Number, required: true }, ativo: Boolean, });
const Servico = mongoose.model('Servico', ServicoSchema);

// Schema do Trabalhador ATUALIZADO
const TrabalhadorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  ativo: Boolean,
  registrado: Boolean,
  dataRegistro: Date,
  numeroFilhos: { type: Number, default: 0 } // NOVO CAMPO
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
app.get('/api', (req, res) => res.send('API do Sistema Agrícola funcionando!'));
app.post('/api/fazendas', async (req, res) => res.status(201).json(await new Fazenda(req.body).save()));
app.get('/api/fazendas', async (req, res) => res.json(await Fazenda.find()));
app.put('/api/fazendas/:id', async (req, res) => res.json(await Fazenda.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/fazendas/:id', async (req, res) => res.json(await Fazenda.findByIdAndDelete(req.params.id)));
app.post('/api/servicos', async (req, res) => res.status(201).json(await new Servico(req.body).save()));
app.get('/api/servicos', async (req, res) => res.json(await Servico.find()));
app.put('/api/servicos/:id', async (req, res) => res.json(await Servico.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/servicos/:id', async (req, res) => res.json(await Servico.findByIdAndDelete(req.params.id)));
app.post('/api/trabalhadores', async (req, res) => res.status(201).json(await new Trabalhador(req.body).save()));
app.get('/api/trabalhadores', async (req, res) => res.json(await Trabalhador.find()));
app.put('/api/trabalhadores/:id', async (req, res) => res.json(await Trabalhador.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/trabalhadores/:id', async (req, res) => res.json(await Trabalhador.findByIdAndDelete(req.params.id)));
app.post('/api/registros', async (req, res) => res.status(201).json(await RegistroDiario.insertMany(req.body)));
app.get('/api/registros/por-mes', async (req, res) => {
    const { ano, mes } = req.query; 
    if (!ano || !mes) return res.status(400).json({ message: 'Ano e mês são obrigatórios.' });
    const regexData = new RegExp(`^${ano}-${mes}-`);
    res.json(await RegistroDiario.find({ data: { $regex: regexData } }).sort({ data: 1 }));
});
app.get('/api/registros/por-dia', async (req, res) => {
    const { data } = req.query;
    if (!data) return res.status(400).json({ message: 'A data é obrigatória.' });
    res.json(await RegistroDiario.find({ data: data }).sort({ nome: 1 }));
});

// Rota da Folha de Pagamento ATUALIZADA
app.get('/api/folha-pagamento', async (req, res) => {
    const { dataInicio, dataFim, tipo } = req.query;
    if (!dataInicio || !dataFim || !tipo) {
        return res.status(400).json({ message: 'Datas e tipo de trabalhador são obrigatórios.' });
    }
    try {
        const todosTrabalhadores = await Trabalhador.find();
        const trabalhadoresMap = new Map(todosTrabalhadores.map(t => [t.nome, { registrado: t.registrado, numeroFilhos: t.numeroFilhos }]));

        const registros = await RegistroDiario.find({
            data: { $gte: dataInicio, $lte: dataFim }
        }).sort({ data: 1 });

        const payrollData = {};
        registros.forEach(reg => {
            const trabalhadorInfo = trabalhadoresMap.get(reg.nome);
            if (!trabalhadorInfo) return; // Pula se não encontrar o trabalhador

            const isRegistrado = trabalhadorInfo.registrado;
            // Filtra conforme o tipo solicitado
            if ((tipo === 'registrados' && !isRegistrado) || (tipo === 'nao_registrados' && isRegistrado)) {
                return;
            }

            if (!payrollData[reg.nome]) {
                payrollData[reg.nome] = { ...trabalhadorInfo, dias: {} };
            }

            const valorDiario = (reg.producao && reg.preco) ? reg.producao * reg.preco : 0;
            if (reg.status === 'Falta') {
                payrollData[reg.nome].dias[reg.data] = 'FALTA';
            } else {
                payrollData[reg.nome].dias[reg.data] = (payrollData[reg.nome].dias[reg.data] || 0) + valorDiario;
            }
        });
        res.json(payrollData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

if (!process.env.VERCEL_ENV) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`🚀 Servidor local pronto em http://localhost:${PORT}`));
}
module.exports = app;