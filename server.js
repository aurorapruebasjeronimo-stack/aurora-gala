const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { totalWritten: 0, totalSent: 0, totalAI: 0, totalSaved: 0, log: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/stats', (req, res) => {
  res.json(readData());
});

app.post('/api/event', (req, res) => {
  const { type } = req.body;
  const data = readData();

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  switch (type) {
    case 'written':
      data.totalWritten++;
      break;
    case 'sent':
      data.totalSent++;
      data.log.unshift({ type: 'sent', time, text: 'Alguien envió su mensaje.' });
      if (data.log.length > 8) data.log = data.log.slice(0, 8);
      break;
    case 'saved':
      data.totalSaved++;
      data.log.unshift({ type: 'saved', time, text: 'Alguien lo guardó para sí.' });
      if (data.log.length > 8) data.log = data.log.slice(0, 8);
      break;
    case 'ai_used':
      data.totalAI++;
      break;
  }

  writeData(data);
  res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
  writeData({ totalWritten: 0, totalSent: 0, totalAI: 0, totalSaved: 0, log: [] });
  res.json({ ok: true });
});

app.post('/api/enhance', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `Eres un redactor de mensajes emotivos para el Mes de las Madres en Colombia. Tu tarea es tomar el mensaje en bruto de una persona y transformarlo en una nota corta, profunda y genuinamente emotiva dirigida a la mamá (o figura materna) de esa persona.

REGLAS:
- Escribe en primera persona, como si fuera la misma persona hablando
- El mensaje debe tener máximo 3-4 oraciones
- Mantén el núcleo emocional del mensaje original, no lo cambies ni lo inventes
- Usa un tono cálido, íntimo, sin cursilería exagerada
- No uses signos de exclamación, mayúsculas de énfasis ni palabras rimbombantes
- El mensaje debe sonar real, no generado por IA
- No uses "mamá" si el mensaje original no lo usa — puede ser para otra figura materna
- Responde SOLO con el mensaje mejorado, sin comillas, sin explicaciones, sin prefijos`,
      messages: [
        {
          role: 'user',
          content: `Mensaje original: "${message}"\n\nTransfórmalo en una nota emotiva y genuina.`
        }
      ]
    });

    const enhanced = response.content[0].text.trim();
    res.json({ enhanced });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    // Silent fallback — return original so frontend can recover gracefully
    res.status(500).json({ error: 'api_error' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✦ Aurora Gala 2026 corriendo en http://localhost:${PORT}\n`);
});
