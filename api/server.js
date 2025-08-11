require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

const Fazenda = mongoose.model('Fazenda', new mongoose.Schema({ nome: { type: String, required: true }, proprietario: String, cidade: String, ativa: Boolean }));
const Servico = mongoose.model('Servico', new mongoose.Schema({ nome: { type: String, required: true }, preco: { type: Number, required: true }, ativo: Boolean }));
const Trabalhador = mongoose.model('Trabalhador', new mongoose.Schema({ nome: { type: String, required: true }, ativo: Boolean, registrado: Boolean, dataRegistro: Date, numeroFilhos: { type: Number, default: 0 } }));
const RegistroDiario = mongoose.model('RegistroDiario', new mongoose.Schema({ data: { type: String, required: true }, nome: { type: String, required: true }, status: String, detalhes: String, fazenda: String, producao: Number, preco: Number, timestamp: { type: Date, default: Date.now } }));

const UserSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    login: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['Admin', 'Operador'], default: 'Operador' }
});
UserSchema.pre('save', async function(next) {
    if (!this.isModified('senha')) return next();
    const salt = await bcrypt.genSalt(10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
});
const User = mongoose.model('User', UserSchema);

// --- Middleware de Autenticação CORRIGIDO ---
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    // CORREÇÃO AQUI: Adicionado o argumento "token" que estava faltando
    jwt.verify(token, process.env.JWT_SECRET || 'seu_segredo_super_secreto', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const apenasAdmin = (req, res, next) => {
    if (req.user && req.user.tipo === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
    }
};

app.post('/api/login', async (req, res) => {
    const { login, senha } = req.body;
    const user = await User.findOne({ login });
    if (!user) return res.status(400).json({ message: 'Login ou senha inválidos.' });
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) return res.status(400).json({ message: 'Login ou senha inválidos.' });
    const token = jwt.sign(
        { id: user._id, nome: user.nome, tipo: user.tipo },
        process.env.JWT_SECRET || 'seu_segredo_super_secreto',
        { expiresIn: '8h' }
    );
    res.json({ token, user: { nome: user.nome, tipo: user.tipo } });
});

app.get('/api/users', async (req, res, next) => {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
        return res.json([]);
    }
    verificarToken(req, res, () => apenasAdmin(req, res, next));
}, async (req, res) => {
    res.json(await User.find().select('-senha'));
});
app.post('/api/users', async (req, res, next) => {
    const userCount = await User.countDocuments();
    if (userCount === 0) return next();
    verificarToken(req, res, () => apenasAdmin(req, res, next));
}, async (req, res) => res.status(201).json(await new User(req.body).save()));
app.put('/api/users/:id', verificarToken, apenasAdmin, async (req, res) => {
    const { nome, login, tipo } = req.body;
    res.json(await User.findByIdAndUpdate(req.params.id, { nome, login, tipo }, { new: true }));
});
app.delete('/api/users/:id', verificarToken, apenasAdmin, async (req, res) => res.json(await User.findByIdAndDelete(req.params.id)));

// ... (todas as outras rotas permanecem as mesmas e já estão protegidas) ...
app.get('/api/fazendas', verificarToken, async (req, res) => res.json(await Fazenda.find()));
app.post('/api/fazendas', verificarToken, async (req, res) => res.status(201).json(await new Fazenda(req.body).save()));
app.put('/api/fazendas/:id', verificarToken, async (req, res) => res.json(await Fazenda.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/fazendas/:id', verificarToken, async (req, res) => res.json(await Fazenda.findByIdAndDelete(req.params.id)));
app.get('/api/servicos', verificarToken, async (req, res) => res.json(await Servico.find()));
app.post('/api/servicos', verificarToken, async (req, res) => res.status(201).json(await new Servico(req.body).save()));
app.put('/api/servicos/:id', verificarToken, async (req, res) => res.json(await Servico.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/servicos/:id', verificarToken, async (req, res) => res.json(await Servico.findByIdAndDelete(req.params.id)));
app.get('/api/trabalhadores', verificarToken, async (req, res) => res.json(await Trabalhador.find()));
app.post('/api/trabalhadores', verificarToken, async (req, res) => res.status(201).json(await new Trabalhador(req.body).save()));
app.put('/api/trabalhadores/:id', verificarToken, async (req, res) => res.json(await Trabalhador.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/trabalhadores/:id', verificarToken, async (req, res) => res.json(await Trabalhador.findByIdAndDelete(req.params.id)));
app.post('/api/registros', verificarToken, async (req, res) => res.status(201).json(await RegistroDiario.insertMany(req.body)));
app.get('/api/registros/por-mes', verificarToken, async (req, res) => {
    const { ano, mes } = req.query;
    if (!ano || !mes) return res.status(400).json({ message: 'Ano e mês são obrigatórios.' });
    const regexData = new RegExp(`^${ano}-${mes}-`);
    res.json(await RegistroDiario.find({ data: { $regex: regexData } }).sort({ data: 1 }));
});
app.get('/api/registros/por-dia', verificarToken, async (req, res) => {
    const { data } = req.query;
    if (!data) return res.status(400).json({ message: 'A data é obrigatória.' });
    res.json(await RegistroDiario.find({ data: data }).sort({ nome: 1 }));
});
app.get('/api/folha-pagamento', verificarToken, async (req, res) => {
    const { dataInicio, dataFim, tipo } = req.query;
    if (!dataInicio || !dataFim || !tipo) return res.status(400).json({ message: 'Datas e tipo de trabalhador são obrigatórios.' });
    const todosTrabalhadores = await Trabalhador.find();
    const trabalhadoresMap = new Map(todosTrabalhadores.map(t => [t.nome, { registrado: t.registrado, numeroFilhos: t.numeroFilhos }]));
    const registros = await RegistroDiario.find({ data: { $gte: dataInicio, $lte: dataFim } }).sort({ data: 1 });
    const payrollData = {};
    registros.forEach(reg => {
        const trabalhadorInfo = trabalhadoresMap.get(reg.nome);
        if (!trabalhadorInfo) return;
        const isRegistrado = trabalhadorInfo.registrado;
        if ((tipo === 'registrados' && !isRegistrado) || (tipo === 'nao_registrados' && isRegistrado)) return;
        if (!payrollData[reg.nome]) payrollData[reg.nome] = { ...trabalhadorInfo, dias: {} };
        const valorDiario = (reg.producao && reg.preco) ? reg.producao * reg.preco : 0;
        if (reg.status === 'Falta') payrollData[reg.nome].dias[reg.data] = 'FALTA';
        else payrollData[reg.nome].dias[reg.data] = (payrollData[reg.nome].dias[reg.data] || 0) + valorDiario;
    });
    res.json(payrollData);
});

if (!process.env.VERCEL_ENV) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`🚀 Servidor local pronto em http://localhost:${PORT}`));
}
module.exports = app;