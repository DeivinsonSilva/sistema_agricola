const mongoose = require('mongoose');

const ServicoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    preco: { type: Number, required: true },
    ativo: Boolean,
});

module.exports = mongoose.model('Servico', ServicoSchema);