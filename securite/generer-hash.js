// Générateur de hash scrypt au format PAVA — usage :
//   node securite/generer-hash.js 'MonMotDePasse!2026'
// Puis : UPDATE pava_utilisateurs SET mot_de_passe = '<hash>' WHERE email = '...';
const crypto = require('crypto');
const mdp = process.argv[2];
if (!mdp || mdp.length < 12) { console.error('Donnez un mot de passe de 12 caractères minimum.'); process.exit(1); }
const sel = crypto.randomBytes(16);
const hash = crypto.scryptSync(mdp, sel, 64);
console.log('scrypt$' + sel.toString('hex') + '$' + hash.toString('hex'));
