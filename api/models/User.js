const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

module.exports = mongoose.model('User', UserSchema);