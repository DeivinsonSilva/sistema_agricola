const mongoose = require('mongoose');

const TrabalhadorSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    ativo: Boolean,
    registrado: Boolean,
    dataRegistro: Date,
    numeroFilhos: { type: Number, default: 0 }
});

module.exports = mongoose.model('Trabalhador', TrabalhadorSchema);