const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn('\x1b[33m⚠️  ANTHROPIC_API_KEY not set — AI summaries will fail.\x1b[0m');
  console.warn('   Run:  export ANTHROPIC_API_KEY=sk-ant-...\n');
}

app.post('/api/generate-summary', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  const { patient } = req.body;

  const prompt = `You are a clinical decision support AI assisting Dr. Sarah Mitchell, a psychiatrist, in reviewing prescription refill requests.

Patient:
- Name: ${patient.name}, ${patient.age} years old
- Medication: ${patient.medication} (${patient.medicationType})
- Controlled substance: ${patient.controlled ? 'YES' : 'No'}
- Duration on medication: ${patient.duration}
- Last in-person visit: ${patient.lastVisit}
- Patient message: "${patient.request}"
- Clinical notes: ${patient.notes}

Respond in this EXACT format with no deviation:

CLINICAL SUMMARY:
[2-3 sentences about the patient's current clinical picture, medication history, and relevant risk factors]

RECOMMENDATION: [Write exactly "APPROVE REFILL" or "SCHEDULE VISIT FIRST" — nothing else]

RATIONALE:
[2-3 sentences explaining your clinical reasoning, referencing any guidelines or safety concerns]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    const recommendation = /APPROVE REFILL/i.test(text) ? 'APPROVE' : 'VISIT';

    res.json({ text, recommendation });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\x1b[32m✓ Klarity Provider Portal → http://localhost:${PORT}\x1b[0m`);
  console.log(`  API key: ${ANTHROPIC_API_KEY ? '\x1b[32m✓ configured\x1b[0m' : '\x1b[31m✗ missing\x1b[0m'}`);
});
