const mongoose = require('mongoose');

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

module.exports = mongoose.model('RegistroDiario', RegistroDiarioSchema);