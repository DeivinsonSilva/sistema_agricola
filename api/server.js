require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelos do Banco de Dados (Schemas) ---
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

// --- Schemas de Validação Zod ---
const userSchema = z.object({
    nome: z.string({ required_error: "O nome é obrigatório." }).min(3, { message: "O nome deve ter no mínimo 3 caracteres." }),
    login: z.string().min(3, { message: "O login deve ter no mínimo 3 caracteres." }),
    senha: z.string().min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
    tipo: z.enum(['Admin', 'Operador'])
});
const fazendaSchema = z.object({
    nome: z.string().min(1, { message: "O nome da fazenda é obrigatório." }),
    proprietario: z.string().optional(),
    cidade: z.string().optional(),
    ativa: z.boolean()
});
const servicoSchema = z.object({
    nome: z.string().min(1, { message: "O nome do serviço é obrigatório." }),
    preco: z.number({ required_error: "O preço é obrigatório." }).positive({ message: "O preço deve ser um número positivo." }),
    ativo: z.boolean()
});
const trabalhadorSchema = z.object({
    nome: z.string().min(3, { message: "O nome do trabalhador é obrigatório." }),
    ativo: z.boolean(),
    registrado: z.boolean(),
    dataRegistro: z.string().optional().nullable(),
    numeroFilhos: z.number().int().min(0).default(0)
});

// --- Middlewares ---
const asyncHandler = fn => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (e) {
        return res.status(400).json({ errors: e.errors });
    }
};
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    const jwtSecret = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
const apenasAdmin = (req, res, next) => {
    if (req.user && req.user.tipo === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado.' });
    }
};

// --- Rotas da API ---
app.post('/api/login', asyncHandler(async (req, res) => {
    const { login, senha } = req.body;
    const user = await User.findOne({ login });
    if (!user) return res.status(400).json({ message: 'Login ou senha inválidos.' });
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) return res.status(400).json({ message: 'Login ou senha inválidos.' });
    const jwtSecret = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
    const token = jwt.sign({ id: user._id, nome: user.nome, tipo: user.tipo }, jwtSecret, { expiresIn: '8h' });
    res.json({ token, user: { nome: user.nome, tipo: user.tipo } });
}));

app.get('/api/users', verificarToken, apenasAdmin, asyncHandler(async (req, res) => res.json(await User.find().select('-senha'))));
app.post('/api/users', validate(userSchema), asyncHandler(async (req, res, next) => {
    const userCount = await User.countDocuments();
    if (userCount === 0) return next();
    verificarToken(req, res, () => apenasAdmin(req, res, next));
}), asyncHandler(async (req, res) => res.status(201).json(await new User(req.body).save())));
app.put('/api/users/:id', verificarToken, apenasAdmin, asyncHandler(async (req, res) => {
    const { nome, login, tipo } = req.body;
    res.json(await User.findByIdAndUpdate(req.params.id, { nome, login, tipo }, { new: true }));
}));
app.delete('/api/users/:id', verificarToken, apenasAdmin, asyncHandler(async (req, res) => res.json(await User.findByIdAndDelete(req.params.id))));

app.get('/api/fazendas', verificarToken, asyncHandler(async (req, res) => res.json(await Fazenda.find())));
app.post('/api/fazendas', verificarToken, validate(fazendaSchema), asyncHandler(async (req, res) => res.status(201).json(await new Fazenda(req.body).save())));
app.put('/api/fazendas/:id', verificarToken, validate(fazendaSchema.partial()), asyncHandler(async (req, res) => res.json(await Fazenda.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
app.delete('/api/fazendas/:id', verificarToken, asyncHandler(async (req, res) => res.json(await Fazenda.findByIdAndDelete(req.params.id))));

app.get('/api/servicos', verificarToken, asyncHandler(async (req, res) => res.json(await Servico.find())));
app.post('/api/servicos', verificarToken, validate(servicoSchema), asyncHandler(async (req, res) => res.status(201).json(await new Servico(req.body).save())));
app.put('/api/servicos/:id', verificarToken, validate(servicoSchema.partial()), asyncHandler(async (req, res) => res.json(await Servico.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
app.delete('/api/servicos/:id', verificarToken, asyncHandler(async (req, res) => res.json(await Servico.findByIdAndDelete(req.params.id))));

app.get('/api/trabalhadores', verificarToken, asyncHandler(async (req, res) => res.json(await Trabalhador.find())));
app.post('/api/trabalhadores', verificarToken, validate(trabalhadorSchema), asyncHandler(async (req, res) => res.status(201).json(await new Trabalhador(req.body).save())));
app.put('/api/trabalhadores/:id', verificarToken, validate(trabalhadorSchema.partial()), asyncHandler(async (req, res) => res.json(await Trabalhador.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
app.delete('/api/trabalhadores/:id', verificarToken, asyncHandler(async (req, res) => res.json(await Trabalhador.findByIdAndDelete(req.params.id))));

app.post('/api/registros', verificarToken, asyncHandler(async (req, res) => res.status(201).json(await RegistroDiario.insertMany(req.body))));
app.get('/api/registros/por-mes', verificarToken, asyncHandler(async (req, res) => {
    const { ano, mes } = req.query;
    if (!ano || !mes) return res.status(400).json({ message: 'Ano e mês são obrigatórios.' });
    const regexData = new RegExp(`^${ano}-${mes}-`);
    res.json(await RegistroDiario.find({ data: { $regex: regexData } }).sort({ data: 1 }));
}));
app.get('/api/registros/por-dia', verificarToken, asyncHandler(async (req, res) => {
    const { data } = req.query;
    if (!data) return res.status(400).json({ message: 'A data é obrigatória.' });
    res.json(await RegistroDiario.find({ data: data }).sort({ nome: 1 }));
}));
app.get('/api/folha-pagamento', verificarToken, asyncHandler(async (req, res) => {
    const { dataInicio, dataFim, tipo } = req.body;
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
}));

// --- NOVAS ROTAS DE GERENCIAMENTO DO BANCO DE DADOS (APENAS ADMIN) ---

// Rota para buscar estatísticas do banco de dados
app.get('/api/db-stats', verificarToken, apenasAdmin, asyncHandler(async (req, res) => {
    const stats = await mongoose.connection.db.stats();
    const collections = await mongoose.connection.db.collections();
    
    const collectionData = [];
    for (const collection of collections) {
        // Ignora coleções internas do sistema
        if (!collection.collectionName.startsWith('system.')) {
            const count = await collection.countDocuments();
            collectionData.push({
                name: collection.collectionName,
                count: count,
            });
        }
    }

    res.json({
        dbName: mongoose.connection.name,
        storageSizeMB: (stats.storageSize / 1024 / 1024).toFixed(2), // Convertido para Megabytes
        collections: collectionData,
    });
}));

// Rota para limpar uma coleção específica
app.delete('/api/db-collections/:collectionName', verificarToken, apenasAdmin, asyncHandler(async (req, res) => {
    const { collectionName } = req.params;
    
    // Constrói o nome do modelo capitalizando a primeira letra (ex: 'users' -> 'User')
    const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

    if (mongoose.models[modelName]) {
        await mongoose.model(modelName).deleteMany({});
        return res.json({ message: `Coleção ${modelName} limpa com sucesso.` });
    }
    
    res.status(404).json({ message: `Coleção ${collectionName} não encontrada.` });
}));

// Rota para limpar TODAS as coleções (exceto a de usuários)
app.delete('/api/db-collections-all', verificarToken, apenasAdmin, asyncHandler(async (req, res) => {
    const modelNames = Object.keys(mongoose.models);
    for (const modelName of modelNames) {
        // Medida de segurança: NUNCA apagar a coleção de usuários por esta rota
        if (modelName !== 'User') {
            await mongoose.model(modelName).deleteMany({});
        }
    }
    res.json({ message: 'Todas as coleções de dados (exceto usuários) foram limpas.' });
}));


// Middleware de Tratamento de Erros
app.use((err, req, res, next) => {
    console.error("[ERRO NÃO TRATADO]", err);
    res.status(500).json({ message: "Ocorreu um erro interno inesperado no servidor." });
});

if (!process.env.VERCEL_ENV) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`🚀 Servidor local pronto em http://localhost:${PORT}`));
}
module.exports = app;