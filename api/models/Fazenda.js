const mongoose = require('mongoose');

const FazendaSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    proprietario: String,
    cidade: String,
    ativa: Boolean,
});

module.exports = mongoose.model('Fazenda', FazendaSchema);