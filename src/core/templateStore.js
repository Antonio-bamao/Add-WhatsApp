const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATES = {
  en: [
    "Hi, I was checking my customer list and wanted to see if you're still interested in jerseys. Can I send you a few new photos?",
    'Hello! We just received some new jersey styles with solid quality. Would you like me to send a few pictures?',
    'Hey, we have a fresh batch of popular team jerseys available now. If you are still looking, I can send you the latest photos.',
    'Hi there, I remembered you were interested in jerseys before. We have new arrivals and better options now. Can I share a few pictures?'
  ],
  es: [
    'Hola, estaba revisando mi lista de clientes y quería saber si todavía te interesan camisetas. ¿Te puedo mandar unas fotos nuevas?',
    'Hola! Nos llegaron nuevos modelos de camisetas con muy buena calidad. ¿Quieres que te mande unas fotos?',
    'Hola, tenemos una nueva tanda de camisetas de equipos populares. Si todavía te interesa, te puedo enviar fotos actualizadas.',
    'Buenas, me acordé de que antes te interesaban camisetas. Ahora tenemos más modelos disponibles. ¿Te mando algunas fotos?'
  ],
  fr: [
    'Bonjour, je revoyais ma liste de clients et je voulais savoir si les maillots vous intéressent toujours. Puis-je vous envoyer quelques nouvelles photos ?',
    'Bonjour ! Nous avons reçu de nouveaux modèles de maillots de bonne qualité. Voulez-vous que je vous envoie quelques photos ?',
    'Bonjour, nous avons un nouvel arrivage de maillots d’équipes populaires. Si cela vous intéresse encore, je peux vous envoyer les photos.',
    'Bonjour, je me souviens que les maillots vous intéressaient auparavant. Nous avons plus de modèles maintenant, puis-je vous montrer quelques photos ?'
  ]
};

function cleanTemplates(value) {
  const result = {};
  for (const language of ['en', 'es', 'fr']) {
    const pool = Array.isArray(value && value[language]) ? value[language] : [];
    const cleaned = pool.map(item => String(item).trim()).filter(Boolean);
    result[language] = [...cleaned];
    for (const template of DEFAULT_TEMPLATES[language]) {
      if (result[language].length >= 4) break;
      if (!result[language].includes(template)) result[language].push(template);
    }
  }
  return result;
}

function templateLanguageCounts(value) {
  const counts = {};
  for (const language of ['en', 'es', 'fr']) {
    const pool = Array.isArray(value && value[language]) ? value[language] : [];
    counts[language] = pool.map(item => String(item).trim()).filter(Boolean).length;
  }
  return counts;
}

function applyTemplateLimit(value, limit) {
  if (limit === null || limit === undefined) return {
    en: [...(value && value.en || [])],
    es: [...(value && value.es || [])],
    fr: [...(value && value.fr || [])]
  };
  const capped = {};
  for (const language of ['en', 'es', 'fr']) {
    const pool = Array.isArray(value && value[language]) ? value[language] : [];
    capped[language] = pool.slice(0, Math.max(1, Number(limit) || 1));
  }
  return capped;
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
  applyTemplateLimit,
  cleanTemplates,
  templateLanguageCounts
};
