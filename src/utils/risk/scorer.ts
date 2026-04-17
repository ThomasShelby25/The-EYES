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

const harmfulKeywords = ['hate', 'violence', 'abuse', 'threat', 'harass'];
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

function assessBaseRisk(context: RiskContext): RiskAssessment {
  const combined = `${context.title || ''} ${context.content || ''}`.trim();
  const sensitiveHits = countMatches(combined, sensitiveKeywords);
  const harmfulHits = countMatches(combined, harmfulKeywords);

  const reasons: string[] = [];
  let score = 5;

  if (sensitiveHits > 0) {
    score += sensitiveHits * 16;
    reasons.push(`Contains ${sensitiveHits} sensitive keyword signal(s)`);
  }

  if (harmfulHits > 0) {
    score += harmfulHits * 14;
    reasons.push(`Contains ${harmfulHits} harmful language signal(s)`);
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

  const normalized = clampScore(score);
  const severity = severityFromScore(normalized);

  return {
    score: normalized,
    severity,
    flagged: normalized >= 45,
    reasons,
  };
}

export function scoreGmailEvent(params: { subject: string; snippet: string; from: string }): RiskAssessment {
  const externalSender = !/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com)$/i.test(params.from);
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (externalSender) {
    exposureScore += 10;
    sourceHints.push('Sender is from a non-personal or external domain');
  }

  return assessBaseRisk({
    title: params.subject,
    content: params.snippet,
    sourceHints,
    exposureScore,
  });
}

export function scoreGithubEvent(params: {
  title: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
}): RiskAssessment {
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

  return assessBaseRisk({
    title: params.title,
    content: params.description,
    sourceHints,
    exposureScore,
  });
}

export function scoreRedditEvent(params: { body: string; subreddit: string; score: number | null | undefined }): RiskAssessment {
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

  return assessBaseRisk({
    content: params.body,
    sourceHints,
    exposureScore,
    engagementScore,
  });
}
export function scoreSlackEvent(params: { text: string; channelName: string; user: string }): RiskAssessment {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.channelName.toLowerCase().includes('public') || params.channelName.toLowerCase() === 'general') {
    exposureScore += 15;
    sourceHints.push('Message is in a high-visibility public channel');
  }

  return assessBaseRisk({
    content: params.text,
    title: `Slack Message in #${params.channelName}`,
    sourceHints,
    exposureScore,
  });
}

export function scoreDiscordEvent(params: { text: string; channelName?: string; user: string }): RiskAssessment {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.channelName?.toLowerCase().includes('admin') || params.channelName?.toLowerCase().includes('staff')) {
    exposureScore += 12;
    sourceHints.push('Message is in a potentially sensitive internal channel');
  }

  return assessBaseRisk({
    content: params.text,
    title: `Discord Message in ${params.channelName || 'Private Channel'}`,
    sourceHints,
    exposureScore,
  });
}

export function scoreNotionEvent(params: { title: string; content?: string }): RiskAssessment {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.title.toLowerCase().includes('private') || params.title.toLowerCase().includes('password')) {
    exposureScore += 20;
    sourceHints.push('Document title contains sensitive category keywords');
  }

  return assessBaseRisk({
    content: params.content || params.title,
    title: params.title,
    sourceHints,
    exposureScore,
  });
}
export function scoreDropboxEvent(params: { name: string; path?: string }): RiskAssessment {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if (params.name.toLowerCase().includes('backup') || params.name.toLowerCase().includes('export')) {
    exposureScore += 15;
    sourceHints.push('File appears to be an archive or backup');
  }

  return assessBaseRisk({
    content: params.path || params.name,
    title: `Dropbox File: ${params.name}`,
    sourceHints,
    exposureScore,
  });
}

export function scoreTwitterEvent(params: { text: string; reach?: number }): RiskAssessment {
  const sourceHints: string[] = [];
  let exposureScore = 0;

  if ((params.reach || 0) > 1000) {
    exposureScore += 40;
    sourceHints.push('High social reach increases reputation impact');
  }

  return assessBaseRisk({
    content: params.text,
    title: 'X/Twitter Post',
    sourceHints,
    exposureScore,
  });
}
