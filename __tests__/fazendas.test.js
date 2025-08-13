const request = require('supertest');
const { app, connectDB, mongoose } = require('../api/server');
const jwt = require('jsonwebtoken');
// Caminhos corrigidos para os modelos
const User = require('../api/models/User');
const Fazenda = require('../api/models/Fazenda');

let token;
let adminUser;

// Antes de todos os testes...
beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Fazenda.deleteMany({});

    adminUser = await new User({
        nome: 'Admin de Teste',
        login: 'admintest',
        senha: 'password123',
        tipo: 'Admin'
    }).save();

    token = jwt.sign(
        { id: adminUser._id, nome: adminUser.nome, tipo: adminUser.tipo },
        process.env.JWT_SECRET
    );
});

// Depois de todos os testes...
afterAll(async () => {
    await mongoose.connection.close();
});

// Grupo de testes para a API de Fazendas
describe('API de Fazendas (/api/fazendas)', () => {
    it('deve retornar 401 se não houver token', async () => {
        const response = await request(app).get('/api/fazendas');
        expect(response.statusCode).toBe(401);
    });
    it('deve buscar todas as fazendas com um token válido', async () => {
        const response = await request(app)
            .get('/api/fazendas')
            .set('Authorization', `Bearer ${token}`);
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
    it('deve criar uma nova fazenda', async () => {
        const novaFazenda = { nome: 'Fazenda de Teste', ativa: true };
        const response = await request(app)
            .post('/api/fazendas')
            .set('Authorization', `Bearer ${token}`)
            .send(novaFazenda);
        expect(response.statusCode).toBe(201);
        expect(response.body.nome).toBe('Fazenda de Teste');
    });
    it('não deve criar uma fazenda com nome inválido', async () => {
        const fazendaInvalida = { ativa: false };
        const response = await request(app)
            .post('/api/fazendas')
            .set('Authorization', `Bearer ${token}`)
            .send(fazendaInvalida);
        expect(response.statusCode).toBe(400);
    });
});