import { createClient, createAdminClient } from '@/utils/supabase/server';
import { chatCompletion, invokeModel } from '@/services/ai/ai';
import { Commitment, ReputationAudit } from '@/types/dashboard';
import { PDFGenerationService } from './pdf-generator';

/**
 * Reputation Audit: Core Analysis Pipeline (REAL WORLD ONLY)
 */
export class AuditAnalysisService {
  static async runAnalysis(auditId: string, userId: string) {
    const supabase = await createAdminClient();
    
    try {
      // 1. Data Retrieval (Real data only)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const { data: events, error: fetchError } = await supabase
        .from('raw_events')
        .select('id, platform, timestamp, title, content, author')
        .eq('user_id', userId)
        .gte('timestamp', twoYearsAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(500); // Optimized for speed

      if (fetchError || !events) {
        throw new Error(`Data retrieval failed: ${fetchError?.message}`);
      }

      if (events.length === 0) {
        throw new Error('No real-world data found for analysis. Please sync sources first.');
      }

      const connectorsCovered = Array.from(new Set(events.map(e => e.platform)));
      
      // 2. Real Claude Analysis (Optimized chunking)
      const significantRecords = events.slice(0, 100);
      const analysisInput = significantRecords.map(e => ({
        id: e.id,
        date: e.timestamp,
        text: `${e.title}: ${e.content}`.slice(0, 500)
      }));

      const extractionPrompt = `
        Perform a clinical Reputation Audit on these records:
        ${JSON.stringify(analysisInput)}
        
        Extract: Sentiment (-1, 0, +1), Commitments, High-Risk findings.
        Return JSON ONLY: { "analysis": [ { "id": "uuid", "sentiment": -1|0|1, "isCommitment": true|false, "commitmentText": "...", "isSensitive": true|false } ] }
      `;

      const analysisRaw = await invokeModel({
        capability: 'classify',
        messages: [{ role: 'user', content: extractionPrompt }],
        system: 'You are a clinical intelligence analyst.',
        preference: 'claude' // Explicitly use Claude for extraction accuracy
      });

      if (!analysisRaw) throw new Error('AI Analysis failed to return data.');

      // 3. Parse and Aggregate
      let weightedTotalMentions = 0;
      let weightedNegativeMentions = 0;
      let weightedNeutralMentions = 0;
      let weightedUnfulfilledCommitments = 0;
      let negativeMentions = 0;
      let unfulfilledCommitmentsCount = 0;
      const extractedCommitments: Commitment[] = [];
      const extractedFindings: any[] = [];
      
      const nowTs = Date.now();
      const jsonMatch = analysisRaw.match(/\{[\s\S]*\}/);
      const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: [] };
      
      analysisResult.analysis.forEach((a: any) => {
        const evt = events.find(e => e.id === a.id);
        if (!evt) return;

        const ageMs = nowTs - new Date(evt.timestamp).getTime();
        const weight = ageMs < (30 * 24 * 60 * 60 * 1000) ? 1.0 : 0.5;

        weightedTotalMentions += weight;
        if (a.sentiment === -1) {
          negativeMentions++;
          weightedNegativeMentions += weight;
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
        
        if (a.isSensitive || a.sentiment === -1) {
           extractedFindings.push({
             severity: a.sentiment === -1 ? 'High' : 'Medium',
             finding: a.commitmentText || `Reputational risk in ${evt.platform}`,
             evidence: `Source event: ${evt.id}`,
             impact: 'Potential diligence concern.'
           });
        }
      });

      const riskScore = Math.min(10, Number((( (weightedNegativeMentions * 2) + (weightedUnfulfilledCommitments * 3) ) / (weightedTotalMentions || 1) * 10).toFixed(1)));

      // 4. Real Summary & Strategic Opportunities
      const summaryPrompt = `
        Summarize this audit: ${events.length} records, ${negativeMentions} negative, ${unfulfilledCommitmentsCount} tasks. 
        Risk Score: ${riskScore}/10.
        Also, extract 3 "Opportunities" (positive trends or areas of strength) and 5 "Top Entities" (most mentioned people/projects).
        Return JSON ONLY: { "narrative": "...", "opportunities": ["..."], "topEntities": ["..."] }
      `;

      const summaryRaw = await invokeModel({
        capability: 'chat',
        messages: [{ role: 'user', content: summaryPrompt }],
        system: 'You are a clinical intelligence analyst.',
        preference: 'auto'
      });

      const summaryMatch = summaryRaw?.match(/\{[\s\S]*\}/);
      const summaryResult = summaryMatch ? JSON.parse(summaryMatch[0]) : { narrative: summaryRaw, opportunities: [], topEntities: [] };

      // 5. Generate PDF Certificate (Async but waited)
      let reportUrl = null;
      try {
        console.log(`[Audit] Generating PDF for ${auditId}...`);
        const failureRate = events.length > 0 ? (negativeMentions / events.length) * 100 : 0;
        const complianceRate = 100 - failureRate;

        const auditForPdf: any = {
          id: auditId,
          status: 'completed',
          riskScore: riskScore,
          mentionsCount: events.length,
          commitmentsCount: unfulfilledCommitmentsCount,
          summaryNarrative: summaryResult.narrative,
          connectorsCovered: connectorsCovered,
          createdAt: new Date().toISOString(),
          metadata: { 
            commitments: extractedCommitments, 
            riskFindings: extractedFindings,
            topEntities: summaryResult.topEntities || [],
            opportunities: summaryResult.opportunities || [],
            sentimentBalance: weightedTotalMentions > 0 ? (1 - (weightedNegativeMentions / weightedTotalMentions)) : 1.0,
            failureRate: failureRate.toFixed(2),
            complianceRate: complianceRate.toFixed(2)
          }
        };
        reportUrl = await PDFGenerationService.generateAndUpload(auditForPdf, userId);
      } catch (pdfErr) {
        console.warn('[Audit] PDF generation skipped due to error:', pdfErr);
      }

      // 6. Persist and Finalize
      await supabase.from('reputation_audits').update({
        status: 'completed',
        risk_score: riskScore,
        mentions_count: events.length,
        commitments_count: unfulfilledCommitmentsCount,
        summary_narrative: summaryResult.narrative || 'Analysis complete.',
        connectors_covered: connectorsCovered,
        report_url: reportUrl,
        metadata: { 
          commitments: extractedCommitments, 
          riskFindings: extractedFindings,
          topEntities: summaryResult.topEntities,
          opportunities: summaryResult.opportunities,
          failureRate: (events.length > 0 ? (negativeMentions / events.length) * 100 : 0).toFixed(2),
          complianceRate: (100 - (events.length > 0 ? (negativeMentions / events.length) * 100 : 0)).toFixed(2)
        }
      }).eq('id', auditId);

      return { success: true, auditId };

    } catch (err) {
      console.error('[Audit Pipeline] REAL-WORLD FAILURE:', err);
      await supabase.from('reputation_audits').update({ 
        status: 'failed', 
        error_message: err instanceof Error ? err.message : String(err) 
      }).eq('id', auditId);
      throw err;
    }
  }
}
