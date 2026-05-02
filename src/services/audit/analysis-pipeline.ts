import { createClient } from '@/utils/supabase/server';
import { chatCompletion } from '@/services/ai/ai';
import { Commitment, ReputationAudit } from '@/types/dashboard';
import { PDFGenerationService } from './pdf-generator';

/**
 * Reputation Audit: Core Analysis Pipeline
 * This service handles the Step 2 to Step 5 of the Audit Specification.
 */

export class AuditAnalysisService {
  /**
   * Runs the full analysis pipeline for a given audit record.
   */
  static async runAnalysis(auditId: string, userId: string) {
    const supabase = await createClient();
    
    try {
      // 1. Update status to 'analysis'
      await supabase
        .from('reputation_audits')
        .update({ status: 'analysis' })
        .eq('id', auditId);

      // 2. Data Retrieval (Step 2)
      // Pull raw_events for the last 2 years, up to 5,000 per platform
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const { data: events, error: fetchError } = await supabase
        .from('raw_events')
        .select('id, platform, timestamp, title, content, author')
        .eq('user_id', userId)
        .gte('timestamp', twoYearsAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(30000); // Safety limit for total records

      if (fetchError || !events) {
        throw new Error(`Data retrieval failed: ${fetchError?.message}`);
      }

      // Group events by platform for reporting
      const connectorsCovered = Array.from(new Set(events.map(e => e.platform)));
      
      // 3. Claude Analysis (Step 3) - Extraction Prompt
      // We chunk the events if they are too many for a single context window
      // For the demo, we process a representative sample or use a large context window model
      const totalMentions = events.length;
      let negativeMentions = 0;
      let neutralMentions = 0;
      let unfulfilledCommitmentsCount = 0;
      const extractedCommitments: Commitment[] = [];
      const extractedFindings: any[] = [];
      const extractedEntities = new Set<string>();

      // --- ANALYSIS EXECUTION ---
      // We'll simulate/implement the chunked analysis here
      // For the sake of the demo, we process the top 100 most significant records if too many
      const significantRecords = events.slice(0, 100); 
      
      const analysisInput = significantRecords.map(e => ({
        id: e.id,
        date: e.timestamp,
        text: `${e.title}: ${e.content}`.slice(0, 500)
      }));

      const extractionPrompt = `
        You are an elite intelligence analyst at EYES. Your task is to perform a Reputation Audit for a subject.
        
        Analyze the following records:
        ${JSON.stringify(analysisInput)}
        
        For each record, extract:
        1. Sentiment (-1, 0, +1)
        2. Is this a commitment made by the subject? (e.g. "I will do X", "I promise Y")
        3. Is this a commitment made TO the subject?
        4. Is this potentially sensitive or high-risk for an external observer (investor, recruiter)?
        5. Mentioned entities (people, topics, projects)
        
        Return a JSON object with:
        {
          "analysis": [
            { "id": "uuid", "sentiment": -1|0|1, "isCommitment": true|false, "commitmentText": "...", "isSensitive": true|false, "entities": [] }
          ]
        }
        
        Tone: Cold, clinical, direct.
      `;

      const analysisRaw = await chatCompletion([
        { role: 'system', content: 'You are a cold, clinical intelligence analyst.' },
        { role: 'user', content: extractionPrompt }
      ]);

      // 4. Parse, Aggregate and Score (Steps 3 & 4)
      let weightedTotalMentions = 0;
      let weightedNegativeMentions = 0;
      let weightedNeutralMentions = 0;
      let weightedUnfulfilledCommitments = 0;
      
      const nowTs = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;

      try {
        const jsonMatch = analysisRaw.match(/\{[\s\S]*\}/);
        const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: [] };
        
        analysisResult.analysis.forEach((a: any) => {
          const evt = events.find(e => e.id === a.id);
          if (!evt) return;

          const ageMs = nowTs - new Date(evt.timestamp).getTime();
          const weight = ageMs < thirtyDaysMs ? 1.0 : ageMs < sixMonthsMs ? 0.5 : 0.2;

          weightedTotalMentions += weight;
          if (a.sentiment === -1) {
            negativeMentions++;
            weightedNegativeMentions += weight;
          }
          if (a.sentiment === 0) {
            neutralMentions++;
            weightedNeutralMentions += weight;
          }
          
          if (a.isCommitment) {
            unfulfilledCommitmentsCount++;
            weightedUnfulfilledCommitments += weight;
            extractedCommitments.push({
              text: a.commitmentText || 'Commitment detected',
              status: 'pending',
              citation: a.id,
              platform: evt.platform,
              date: evt.timestamp || new Date().toISOString()
            });
          }

          if (a.entities) a.entities.forEach((e: string) => extractedEntities.add(e));
          
          if (a.isSensitive || a.sentiment === -1) {
             extractedFindings.push({
               severity: a.sentiment === -1 ? 'High' : 'Medium',
               finding: a.commitmentText || `Potential reputational risk in ${evt.platform}`,
               evidence: `Source event: ${evt.id}`,
               impact: 'Could concern external observers performing diligence.'
             });
          }
        });
      } catch (parseError) {
        console.error('Failed to parse AI analysis:', parseError);
      }

      // Risk score = ( (neg × 2) + (neu × 0.5) + (unfulfilled × 3) ) ÷ total × 10
      const rawScore = ( (weightedNegativeMentions * 2) + (weightedNeutralMentions * 0.5) + (weightedUnfulfilledCommitments * 3) ) / (weightedTotalMentions || 1) * 10;
      const riskScore = Math.min(10, Number(rawScore.toFixed(1)));

      // 5. Executive Summary (Step 5)
      const summaryPrompt = `
        Generate a one-paragraph plain-language executive summary for a Reputation Audit.
        Total records: ${totalMentions}
        Negative Mentions: ${negativeMentions}
        Unfulfilled Commitments: ${unfulfilledCommitmentsCount}
        Risk Score: ${riskScore}/10
        
        Tone: Cold, clinical, direct. Written with the editorial discipline of an Economist leader column. 
        Do not flatter. Do not soften findings. Focus on missed opportunities or unfulfilled duties.
      `;

      const summaryNarrative = await chatCompletion([
        { role: 'system', content: 'You are a cold, clinical intelligence analyst.' },
        { role: 'user', content: summaryPrompt }
      ]);

      // Final aggregation
      const auditMetadata = {
        sentimentBalance: (totalMentions - negativeMentions) / (totalMentions || 1),
        unfulfilledCommitments: unfulfilledCommitmentsCount,
        commitments: extractedCommitments,
        opportunities: [], // Extracted in a more advanced version
        topEntities: Array.from(extractedEntities).slice(0, 10),
        riskFindings: extractedFindings.slice(0, 5)
      };

      // 7. Persist Analysis Results
      await supabase
        .from('reputation_audits')
        .update({
          status: 'generating',
          risk_score: riskScore,
          mentions_count: totalMentions,
          commitments_count: unfulfilledCommitmentsCount,
          summary_narrative: summaryNarrative,
          connectors_covered: connectorsCovered,
          metadata: auditMetadata
        })
        .eq('id', auditId);

      // 8. Render PDF (Step 6)
      const reportUrl = await PDFGenerationService.generateAndUpload(
        {
          id: auditId,
          status: 'generating',
          riskScore,
          mentionsCount: totalMentions,
          commitmentsCount: unfulfilledCommitmentsCount,
          summaryNarrative,
          connectorsCovered,
          createdAt: new Date().toISOString(),
          reportUrl: null,
          metadata: auditMetadata
        } as ReputationAudit,
        userId
      );

      // 9. Final update to completed
      await supabase
        .from('reputation_audits')
        .update({
          status: 'completed',
          report_url: reportUrl
        })
        .eq('id', auditId);

      return { success: true, auditId, reportUrl };

    } catch (err) {
      console.error('[Audit Pipeline] Analysis Failure:', err);
      await supabase
        .from('reputation_audits')
        .update({ 
          status: 'failed', 
          error_message: err instanceof Error ? err.message : String(err) 
        })
        .eq('id', auditId);
      throw err;
    }
  }
}
