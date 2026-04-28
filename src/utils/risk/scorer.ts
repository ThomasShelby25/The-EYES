export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskAssessment {
  score: number;
  severity: RiskSeverity;
  flagged: boolean;
  reasons: string[];
}

type RiskContext = {
  content: string;
  title?: string;
  sourceHints?: string[];
  exposureScore?: number;
  engagementScore?: number;
};

import OpenAI from 'openai';

const sensitiveKeywords = [
  'password',
  'secret',
  'confidential',
  'ssn',
  'token',
  'api key',
  'private key',
  'credential',
  '2fa',
  'otp',
];

const sensitiveSubreddits = ['politics', 'legaladvice', 'depression', 'relationships'];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityFromScore(score: number): RiskSeverity {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

function countMatches(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((acc, keyword) => (lower.includes(keyword) ? acc + 1 : acc), 0);
}

// Optional singleton for OpenAI client if key is present
const getOpenAIClient = () => {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return null;
};

async function assessBaseRisk(context: RiskContext): Promise<RiskAssessment> {
  const combined = `${context.title || ''} ${context.content || ''}`.trim();
  const sensitiveHits = countMatches(combined, sensitiveKeywords);

  const reasons: string[] = [];
  let score = 5;

  if (sensitiveHits > 0) {
    score += sensitiveHits * 16;
    reasons.push(`Contains ${sensitiveHits} sensitive keyword signal(s)`);
  }

  if (context.exposureScore) {
    score += context.exposureScore;
    reasons.push(`Exposure contribution +${context.exposureScore}`);
  }

  if (context.engagementScore) {
    score += context.engagementScore;
    reasons.push(`Engagement contribution +${context.engagementScore}`);
  }

  if (context.sourceHints && context.sourceHints.length > 0) {
    reasons.push(...context.sourceHints);
  }

  // NLP ML Moderation Integration
  const openai = getOpenAIClient();
  if (openai && combined.length > 0) {
    try {
      const modResponse = await openai.moderations.create({ input: combined });
      const modResult = modResponse.results[0];
      if (modResult.flagged) {
        score += 50; // Major ML flag
        reasons.push('OpenAI ML algorithmic scan flagged content as potentially harmful/unsafe');

        // Add specific categories flagged
        const flaggedCategories = Object.entries(modResult.categories)
          .filter(([_, isFlagged]) => isFlagged)
          .map(([cat]) => cat);

        if (flaggedCategories.length > 0) {
          reasons.push(`ML Categories: ${flaggedCategories.join(', ')}`);
        }
      } else {
        // Even if not strictly flagged, we can look at category scores for nuanced risk
        let maxSubScore = 0;
        Object.values(modResult.category_scores).forEach((val) => {
          if (val > maxSubScore) maxSubScore = val;
        });
        if (maxSubScore > 0.1) {
          score += (maxSubScore * 20); // Adds up to 20 points based on confidence
          reasons.push('Elevated NLP baseline risk score detected');
        }
      }
    } catch (e) {
      console.warn("OpenAI Moderation API failed, falling back to heuristic scoring", e);
    }
  }

  const normalized = clampScore(score);
  const severity = severityFromScore(normalized);

  return {
    score: normalized,
    severity,
    flagged: normalized >= 45,
    reasons,
  };
}

export async function scoreGmailEvent(params: { subject: string; snippet: string; from: string }): Promise<RiskAssessment> {
  const externalSender = !/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com)$/i.test(params.from);
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (externalSender) {
    exposureScore += 10;
    sourceHints.push('Sender is from a non-personal or external domain');
  }

  return await assessBaseRisk({
    title: params.subject,
    content: params.snippet,
    sourceHints,
    exposureScore,
  });
}

export async function scoreGithubEvent(params: {
  title: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
}): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.stars >= 500) {
    exposureScore += 50;
    sourceHints.push('Repository has very high public visibility (500+ stars)');
  } else if (params.stars >= 50) {
    exposureScore += 28;
    sourceHints.push('Repository has notable public visibility (50+ stars)');
  }

  if (params.forks >= 50) {
    exposureScore += 12;
    sourceHints.push('Repository has substantial fork activity');
  }

  if ((params.language || '').toLowerCase() === 'shell') {
    exposureScore += 8;
    sourceHints.push('Shell repositories often contain operational secrets if mishandled');
  }

  return await assessBaseRisk({
    title: params.title,
    content: params.description,
    sourceHints,
    exposureScore,
  });
}

export async function scoreRedditEvent(params: { body: string; subreddit: string; score: number | null | undefined }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;
  let engagementScore = 0;

  if (sensitiveSubreddits.includes((params.subreddit || '').toLowerCase())) {
    exposureScore += 18;
    sourceHints.push('Posted in a context-sensitive subreddit');
  }

  if ((params.score || 0) >= 100) {
    engagementScore += 12;
    sourceHints.push('High engagement comment increases discoverability');
  }

  return await assessBaseRisk({
    content: params.body,
    sourceHints,
    exposureScore,
    engagementScore,
  });
}
export async function scoreSlackEvent(params: { text: string; channelName: string; user: string }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.channelName.toLowerCase().includes('public') || params.channelName.toLowerCase() === 'general') {
    exposureScore += 15;
    sourceHints.push('Message is in a high-visibility public channel');
  }

  return await assessBaseRisk({
    content: params.text,
    title: `Slack Message in #${params.channelName}`,
    sourceHints,
    exposureScore,
  });
}

export async function scoreDiscordEvent(params: { text: string; channelName?: string; user: string }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.channelName?.toLowerCase().includes('admin') || params.channelName?.toLowerCase().includes('staff')) {
    exposureScore += 12;
    sourceHints.push('Message is in a potentially sensitive internal channel');
  }

  return await assessBaseRisk({
    content: params.text,
    title: `Discord Message in ${params.channelName || 'Private Channel'}`,
    sourceHints,
    exposureScore,
  });
}

export async function scoreNotionEvent(params: { title: string; content?: string }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.title.toLowerCase().includes('private') || params.title.toLowerCase().includes('password')) {
    exposureScore += 20;
    sourceHints.push('Document title contains sensitive category keywords');
  }

  return await assessBaseRisk({
    content: params.content || params.title,
    title: params.title,
    sourceHints,
    exposureScore,
  });
}
export async function scoreDropboxEvent(params: { name: string; path?: string }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.name.toLowerCase().includes('backup') || params.name.toLowerCase().includes('export')) {
    exposureScore += 15;
    sourceHints.push('File appears to be an archive or backup');
  }

  return await assessBaseRisk({
    content: params.path || params.name,
    title: `Dropbox File: ${params.name}`,
    sourceHints,
    exposureScore,
  });
}

export async function scoreTwitterEvent(params: { text: string; reach?: number }): Promise<RiskAssessment> {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if ((params.reach || 0) > 1000) {
    exposureScore += 40;
    sourceHints.push('High social reach increases reputation impact');
  }

  return await assessBaseRisk({
    content: params.text,
    title: 'X/Twitter Post',
    sourceHints,
    exposureScore,
  });
}
