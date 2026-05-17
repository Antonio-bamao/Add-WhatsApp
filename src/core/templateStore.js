const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATES = {
  en: [
    "Hi, I was checking my customer list and wanted to see if you're still interested in jerseys. Can I send you a few new photos?",
    'Hello! We just received some new jersey styles with solid quality. Would you like me to send a few pictures?'
  ],
  es: [
    'Hola, estaba revisando mi lista de clientes y quería saber si todavía te interesan camisetas. ¿Te puedo mandar unas fotos nuevas?',
    'Hola! Nos llegaron nuevos modelos de camisetas con muy buena calidad. ¿Quieres que te mande unas fotos?'
  ],
  fr: [
    'Bonjour, je revoyais ma liste de clients et je voulais savoir si les maillots vous intéressent toujours. Puis-je vous envoyer quelques nouvelles photos ?',
    'Bonjour ! Nous avons reçu de nouveaux modèles de maillots de bonne qualité. Voulez-vous que je vous envoie quelques photos ?'
  ]
};

function cleanTemplates(value) {
  const result = {};
  for (const language of ['en', 'es', 'fr']) {
    const pool = Array.isArray(value && value[language]) ? value[language] : [];
    const cleaned = pool.map(item => String(item).trim()).filter(Boolean);
    result[language] = cleaned.length ? cleaned : [...DEFAULT_TEMPLATES[language]];
  }
  return result;
}

class JsonTemplateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) return cleanTemplates(DEFAULT_TEMPLATES);
    try {
      return cleanTemplates(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')));
    } catch {
      return cleanTemplates(DEFAULT_TEMPLATES);
    }
  }

  save(templates) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const cleaned = cleanTemplates(templates);
    fs.writeFileSync(this.filePath, JSON.stringify(cleaned, null, 2));
    return cleaned;
  }
}

module.exports = {
  DEFAULT_TEMPLATES,
  JsonTemplateStore,
  cleanTemplates
};
