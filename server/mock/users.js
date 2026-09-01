 
const bcrypt = require('bcryptjs');

const users = []; // { id, email, password_hash, name?, role? }
let nextId = 1;

async function createUser(email, password, name = null, role = null) {
  const password_hash = await bcrypt.hash(password, 10);
  const user = { id: nextId++, email, password_hash, name, role };
  users.push(user);
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function findUserByEmail(email) {
  return users.find(u => u.email === email);
}

async function findUserById(id) {
  return users.find(u => u.id === id);
}

module.exports = { createUser, findUserByEmail, findUserById, __store: users };
