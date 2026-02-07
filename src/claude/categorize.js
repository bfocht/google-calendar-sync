const { createMessage, getModel } = require('../llm/client');

const CATEGORIZATION_PROMPT = `INPUT:
{{INPUT}}

INSTRUCTIONS:
1. Determine which category this belongs to:
   - "people" - information about a person, relationship update, something someone said
   - "projects" - a project, task with multiple steps, ongoing work
   - "ideas" - a thought, insight, concept, something to explore later
   - "admin" - a simple errand, one-off task, something with a due date, or a reminder

2. Extract the relevant fields based on category

3. Assign a confidence score (0.0 to 1.0):
   - 0.9-1.0: Very clear category, obvious classification
   - 0.7-0.89: Fairly confident, good match
   - 0.5-0.69: Uncertain, could be multiple categories
   - Below 0.5: Very unclear, needs human review

4. If confidence is below 0.6, set destination to "needs_review"

OUTPUT FORMAT (return ONLY this JSON, no other text):

For PEOPLE:
{
  "destination": "people",
  "confidence": 0.85,
  "data": {
    "name": "Person's Name",
    "context": "How you know them or their role",
    "follow_ups": "Things to remember for next time",
    "tags": ["work", "friend"]
  }
}

For PROJECTS:
{
  "destination": "projects",
  "confidence": 0.85,
  "data": {
    "name": "Project Name",
    "status": "active",
    "next_action": "Specific next action to take",
    "notes": "Additional context",
    "tags": ["work"]
  }
}

For IDEAS:
{
  "destination": "ideas",
  "confidence": 0.85,
  "data": {
    "name": "Idea Title",
    "one_liner": "Core insight in one sentence",
    "notes": "Elaboration if provided",
    "tags": ["product"]
  }
}

For ADMIN:
{
  "destination": "admin",
  "confidence": 0.85,
  "data": {
    "name": "Task name",
    "due_date": "2026-01-15 or null if not specified",
    "notes": "Additional context and details to follow up on"
  }
}

For UNCLEAR (confidence below 0.6):
{
  "destination": "needs_review",
  "confidence": 0.45,
  "data": {
    "original_text": "The original message",
    "possible_categories": ["projects", "admin"],
    "reason": "Could be a project or a simple task"
  }
}

RULES:
- "next_action" must be specific and executable. "Work on website" is bad. "Email Sarah to confirm deadline" is good.
- If a person's name is mentioned, consider if this is really about that person or about a project/task involving them
- Status options for projects: "active", "waiting", "blocked", "someday"
- Extract dates when mentioned and format as YYYY-MM-DD
- If no clear tags apply, use an empty array []
- Always return valid JSON with no markdown formatting`;

const categorizeMessage = async (text) => {
  const prompt = CATEGORIZATION_PROMPT.replace('{{INPUT}}', text);

  const response = await createMessage({
    model: getModel(),
    maxTokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const aiResponse = response.content[0].text;
  return parseCategorizationResponse(aiResponse);
};

const parseCategorizationResponse = (response) => {
  // Remove markdown code blocks if present
  let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      destination: parsed.destination || 'needs_review',
      confidence: parsed.confidence,
      data: parsed.data,
      name: parsed.data.name || parsed.data.original_text || 'Untitled',
      status: parsed.data.status || 'active',
      nextAction: parsed.data.next_action || null,
      context: parsed.data.context || null,
      followUps: parsed.data.follow_ups || null,
      oneLiner: parsed.data.one_liner || null,
      notes: parsed.data.notes || null,
      dueDate: parsed.data.due_date || null,
      tags: parsed.data.tags || []
    };
  } catch (e) {
    return {
      destination: 'needs_review',
      confidence: 0,
      data: { original_text: response },
      name: 'Parse Error',
      error: e.message
    };
  }
};

const RECLASSIFICATION_PROMPT = `Extract structured data from this text for a {{CATEGORY}} record.

TEXT:
{{TEXT}}

CATEGORY: {{CATEGORY}}
STATUS: {{STATUS}}

OUTPUT FORMAT (return ONLY this JSON, no other text):

For PEOPLE:
{
  "destination": "people",
  "data": {
    "name": "Person's Name",
    "context": "How you know them or their role",
    "follow_ups": "Things to remember for next time",
    "tags": ["work", "friend"]
  }
}

For PROJECTS:
{
  "destination": "projects",
  "data": {
    "name": "Project Name",
    "status": "active",
    "next_action": "Specific next action to take",
    "notes": "Additional context",
    "tags": ["work"]
  }
}

For IDEAS:
{
  "destination": "ideas",
  "data": {
    "name": "Idea Title",
    "one_liner": "Core insight in one sentence",
    "notes": "Elaboration if provided",
    "tags": ["product"]
  }
}

For ADMIN:
{
  "destination": "admin",
  "data": {
    "name": "Task name",
    "due_date": "2026-01-15 or null if not specified",
    "notes": "Additional context and details to follow up on"
  }
}`;

const reclassifyMessage = async (text, newCategory, currentStatus) => {
  const prompt = RECLASSIFICATION_PROMPT
    .replace(/{{CATEGORY}}/g, newCategory)
    .replace('{{TEXT}}', text)
    .replace('{{STATUS}}', currentStatus || 'active');

  const response = await createMessage({
    model: getModel(),
    maxTokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const aiResponse = response.content[0].text;
  return parseCategorizationResponse(aiResponse);
};

const DAILY_DIGEST_PROMPT = `You are a personal productivity assistant. Generate a concise daily digest based on the following data.

{{CONTEXT}}

TODAY'S DATE: {{DATE}}

INSTRUCTIONS:
Create a digest with EXACTLY this format. Keep it under 150 words total.

---

Good morning!

**Top 3 Actions Today:**
1. [Most important/urgent action from projects or admin]
2. [Second priority]
3. [Third priority]

**People to Connect With:**
- [Person name]: [Brief follow-up reminder]

**Watch Out For:**
[One thing that might be stuck, overdue, or getting neglected]

**One Small Win to Notice:**
[Something positive or progress made, or encouraging thought]

---

RULES:
- Be specific and actionable, not motivational
- Prioritize overdue items and concrete next actions
- If there's nothing in a section, omit it entirely
- Keep language direct and practical
- Don't add explanations or commentary outside the format`;

const generateDailyDigest = async (context) => {
  const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Phoenix' }).split(' ')[0];
  const prompt = DAILY_DIGEST_PROMPT
    .replace('{{CONTEXT}}', context)
    .replace('{{DATE}}', date);

  const response = await createMessage({
    model: getModel(),
    maxTokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
};

const DAILY_DIGEST_STRUCTURED_PROMPT = `You are a personal productivity assistant. Generate a structured daily digest based on the following data.

{{CONTEXT}}

TODAY'S DATE: {{DATE}}

OUTPUT FORMAT (return ONLY this JSON, no other text):
{
  "topActions": [
    { "title": "Most important action", "notes": "Brief context or source", "priority": 1 },
    { "title": "Second priority action", "notes": "Brief context", "priority": 2 },
    { "title": "Third priority action", "notes": "Brief context", "priority": 3 }
  ],
  "peopleToConnect": [
    { "name": "Person name", "followUp": "Brief reminder" }
  ],
  "watchOutFor": "One thing that might be stuck, overdue, or getting neglected",
  "smallWin": "Something positive or progress made, or encouraging thought"
}

RULES:
- topActions must have exactly 3 items with specific, executable actions
- "Work on website" is bad. "Email Sarah to confirm deadline" is good
- If nothing for peopleToConnect, use empty array []
- If nothing to watch out for, use null
- If no small win to note, use null
- Prioritize overdue items and concrete next actions
- Keep notes brief (under 100 characters)
- Always return valid JSON with no markdown formatting`;

const generateDailyDigestStructured = async (context) => {
  const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Phoenix' }).split(' ')[0];
  const prompt = DAILY_DIGEST_STRUCTURED_PROMPT
    .replace('{{CONTEXT}}', context)
    .replace('{{DATE}}', date);

  const response = await createMessage({
    model: getModel(),
    maxTokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const aiResponse = response.content[0].text;

  // Remove markdown code blocks if present
  let cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse structured digest:', e.message);
    return {
      topActions: [],
      peopleToConnect: [],
      watchOutFor: null,
      smallWin: null,
      error: e.message
    };
  }
};

const formatDigestForSlack = (digest) => {
  let text = 'Good morning!\n\n';

  if (digest.topActions && digest.topActions.length > 0) {
    text += '*Top 3 Actions Today:*\n';
    digest.topActions.forEach((action, i) => {
      text += `${i + 1}. ${action.title}\n`;
    });
    text += '\n';
  }

  if (digest.peopleToConnect && digest.peopleToConnect.length > 0) {
    text += '*People to Connect With:*\n';
    digest.peopleToConnect.forEach(person => {
      text += `- ${person.name}: ${person.followUp}\n`;
    });
    text += '\n';
  }

  if (digest.watchOutFor) {
    text += '*Watch Out For:*\n';
    text += `${digest.watchOutFor}\n\n`;
  }

  if (digest.smallWin) {
    text += '*One Small Win to Notice:*\n';
    text += `${digest.smallWin}\n`;
  }

  return text.trim();
};

const WEEKLY_DIGEST_PROMPT = `You are a personal productivity assistant conducting a weekly review. Analyze the following data and generate an insightful summary.

{{CONTEXT}}

TOTAL CAPTURES THIS WEEK: {{TOTAL_CAPTURES}}

INSTRUCTIONS:
Create a weekly review with EXACTLY this format. Keep it under 250 words total.

---

**Week in Review**

**Quick Stats:**
- Items captured: [number]
- Breakdown: [x people, y projects, z ideas, w admin]

**What Moved Forward:**
- [Project or area that made progress]
- [Another win or completion]

**Open Loops (needs attention):**
1. [Something blocked, stalled, or waiting too long]
2. [Another concern]

**Patterns I Notice:**
[One observation about themes, recurring topics, or where energy is going]

**Suggested Focus for Next Week:**
1. [Specific action for highest priority item]
2. [Second priority]
3. [Third priority]

**Items Needing Review:**
[List any items still marked "Needs Review" or flag if none]

---

RULES:
- Be analytical, not motivational
- Call out projects that haven't had action in over a week
- Note if capture volume was unusually high or low
- Suggest concrete next actions, not vague intentions
- If something looks stuck, say so directly
- Keep language concise and actionable`;

const generateWeeklyDigest = async (context, totalCaptures) => {
  const prompt = WEEKLY_DIGEST_PROMPT
    .replace('{{CONTEXT}}', context)
    .replace('{{TOTAL_CAPTURES}}', totalCaptures.toString());

  const response = await createMessage({
    model: getModel(),
    maxTokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
};

module.exports = {
  categorizeMessage,
  reclassifyMessage,
  generateDailyDigest,
  generateDailyDigestStructured,
  formatDigestForSlack,
  generateWeeklyDigest
};
