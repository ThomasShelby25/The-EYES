import PDFDocument from 'pdfkit';
import { createClient } from '@/utils/supabase/server';
import { ReputationAudit } from '@/types/dashboard';

/**
 * Reputation Audit: PDF Generation Service
 * Implements Step 6 of the Audit Specification.
 */

export class PDFGenerationService {
  static async generateAndUpload(audit: ReputationAudit, userId: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Reputation Audit - ${audit.id}`,
            Author: 'EYES Neural Memory OS',
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
          const pdfBuffer = Buffer.concat(buffers);
          try {
            const url = await this.uploadToSupabase(pdfBuffer, audit.id, userId);
            resolve(url);
          } catch (uploadErr) {
            reject(uploadErr);
          }
        });

        // --- STYLING CONSTANTS ---
        const CREAM = '#FAFAF7';
        const INK_BLACK = '#1A1A1A';
        const FOREST_GREEN = '#1F4D3F';
        const MUTED_RED = '#8B2E2E';

        // --- FONT PATH RESOLUTION (Vercel/Production Optimized) ---
        const path = require('path');
        let dataDir = path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data');
        
        // Check if we are in a Vercel-like environment where PWD might be different
        if (process.env.VERCEL) {
          dataDir = path.join(process.cwd(), '.next', 'server', 'chunks', 'node_modules', 'pdfkit', 'js', 'data');
          // Fallback if the above tracing doesn't match exactly
          try {
            const resolved = path.dirname(require.resolve('pdfkit/js/data/Helvetica.afm'));
            dataDir = resolved;
          } catch (e) {}
        }

        const FONT_BODY = path.join(dataDir, 'Helvetica.afm');
        const FONT_BOLD = path.join(dataDir, 'Helvetica-Bold.afm');
        const FONT_MONO = path.join(dataDir, 'Courier.afm');

        // Helper to safely set font
        const setSafeFont = (fontPath: string, fallback: string = 'Helvetica') => {
          try {
            doc.font(fontPath);
          } catch (e) {
            try {
              doc.font(fallback);
            } catch (e2) {}
          }
        };

        // --- HELPER: HEADER & FOOTER ---
        const drawHeaderAndFooter = () => {
          const pages = doc.bufferedPageRange();
          for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            
            // Background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill(CREAM);

            // Watermark
            doc.save()
               .fillColor(INK_BLACK)
               .fillOpacity(0.03)
               .fontSize(60)
               .rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
               .text('CONFIDENTIAL', doc.page.width / 2 - 200, doc.page.height / 2, { align: 'center' })
               .restore();

            // Header
            setSafeFont(FONT_BOLD, 'Helvetica-Bold');
            doc.fillColor(FOREST_GREEN).fontSize(14).text('EYES', 50, 40);
            
            // Footer
            doc.moveTo(50, doc.page.height - 60).lineTo(doc.page.width - 50, doc.page.height - 60).strokeColor(FOREST_GREEN).lineWidth(0.5).stroke();
            doc.fillColor('#888888').fontSize(8);
            setSafeFont(FONT_BODY, 'Helvetica');
            doc.text(`Certificate ID: ${audit.id} | Non-transferable`, 50, doc.page.height - 50)
               .text(`Page ${i + 1} of ${pages.count}`, doc.page.width - 100, doc.page.height - 50, { align: 'right' });
          }
        };

        // --- PAGE 1: COVER ---
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.fillColor(INK_BLACK).fontSize(36).text('Audit\nCertificate', 50, 150);
        doc.moveTo(50, 240).lineTo(150, 240).strokeColor(FOREST_GREEN).lineWidth(4).stroke();
        
        doc.fontSize(12);
        setSafeFont(FONT_BODY, 'Helvetica');
        doc.text(`Prepared for: [Authenticated Subject]`, 50, 280);
        doc.text(`Date: ${new Date(audit.createdAt).toUTCString()}`, 50, 300);
        doc.text(`Audit ID: EYES-RA-${audit.id.slice(0, 8).toUpperCase()}`, 50, 320);

        doc.fontSize(10);
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.text('Connectors covered:', 50, 380);
        setSafeFont(FONT_BODY, 'Helvetica');
        doc.text(audit.connectorsCovered.join(' . ').toUpperCase(), 50, 400);

        // --- PAGE 2: EXECUTIVE SUMMARY ---
        doc.addPage();
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.fillColor(INK_BLACK).fontSize(20).text('Executive Summary', 50, 100);
        setSafeFont(FONT_BODY, 'Helvetica');
        doc.fontSize(12).lineGap(4).text(audit.summaryNarrative || 'No narrative generated.', 50, 140, { width: 500, align: 'justify' });

        // Headline Metrics
        let y = 280;
        doc.rect(50, y, 500, 100).fill('#FFFFFF').stroke(FOREST_GREEN);
        doc.fillColor(FOREST_GREEN).fontSize(24);
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.text(audit.mentionsCount.toString(), 100, y + 30);
        doc.fontSize(8).text('TOTAL MENTIONS', 100, y + 60);

        doc.fontSize(24).text(`${(audit.metadata.sentimentBalance * 100).toFixed(0)}%`, 250, y + 30);
        doc.fontSize(8).text('SENTIMENT BALANCE', 250, y + 60);

        doc.fontSize(24).text(audit.commitmentsCount.toString(), 400, y + 30);
        doc.fontSize(8).text('UNFULFILLED COMMITMENTS', 400, y + 60);

        // Risk Score
        y = 420;
        doc.rect(50, y, 500, 80).fill(FOREST_GREEN);
        doc.fillColor('#FFFFFF').fontSize(48);
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.text(audit.riskScore.toString(), 80, y + 15);
        doc.fontSize(14).text('RISK SCORE / 10', 180, y + 25);
        doc.fontSize(10);
        setSafeFont(FONT_BODY, 'Helvetica');
        doc.text(audit.riskScore > 7 ? 'Critical Exposure Identified' : audit.riskScore > 4 ? 'Moderate Risk Detected' : 'Minimal Trace Surface', 180, y + 45);

        // --- PAGES 3-5: PER-CONNECTOR BREAKDOWN (Simplified for demo) ---
        audit.connectorsCovered.forEach(platform => {
          doc.addPage();
          setSafeFont(FONT_BOLD, 'Helvetica-Bold');
          doc.fillColor(INK_BLACK).fontSize(20).text(`Platform Breakdown: ${platform.toUpperCase()}`, 50, 100);
          setSafeFont(FONT_MONO, 'Courier');
          doc.fontSize(10).text(`Indexing window: 24 months`, 50, 130);
          
          // Example records
          setSafeFont(FONT_BOLD, 'Helvetica-Bold');
          doc.fontSize(12).text('Significant Records:', 50, 170);
          const platformCommitments = audit.metadata.commitments.filter(c => c.platform === platform);
          platformCommitments.slice(0, 3).forEach((c, idx) => {
            doc.rect(50, 200 + (idx * 100), 500, 80).stroke('#E5E5E0');
            setSafeFont(FONT_MONO, 'Courier');
            doc.fontSize(9).fillColor('#666666').text(`Source ID: ${c.citation} | ${new Date(c.date).toLocaleDateString()}`, 60, 210 + (idx * 100));
            setSafeFont(FONT_BODY, 'Helvetica');
            doc.fontSize(11).fillColor(INK_BLACK).text(`"${c.text.slice(0, 200)}..."`, 60, 230 + (idx * 100), { width: 480 });
          });
        });

        // --- PAGE 6: COMMITMENTS & OPPORTUNITIES ---
        doc.addPage();
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.fillColor(INK_BLACK).fontSize(20).text('Commitments & Opportunities', 50, 100);
        
        doc.fontSize(12).text('Detected Commitments', 50, 140);
        audit.metadata.commitments.slice(0, 10).forEach((c, idx) => {
          setSafeFont(FONT_BOLD, 'Helvetica-Bold');
          doc.fillColor(MUTED_RED).fontSize(10).text(`[OVERDUE]`, 50, 170 + (idx * 30));
          setSafeFont(FONT_BODY, 'Helvetica');
          doc.fillColor(INK_BLACK).text(c.text.slice(0, 80) + '...', 120, 170 + (idx * 30));
          setSafeFont(FONT_MONO, 'Courier');
          doc.fontSize(8).fillColor('#888').text(c.platform.toUpperCase(), 450, 170 + (idx * 30));
        });

        // --- PAGE 7: RISK FINDINGS ---
        doc.addPage();
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.fillColor(INK_BLACK).fontSize(20).text('Risk Findings', 50, 100);
        audit.metadata.riskFindings.forEach((f, idx) => {
          doc.rect(50, 140 + (idx * 110), 500, 100).stroke('#E5E5E0');
          doc.fillColor(f.severity === 'High' ? MUTED_RED : FOREST_GREEN).fontSize(10).text(`${f.severity.toUpperCase()} RISK`, 60, 150 + (idx * 110));
          doc.fillColor(INK_BLACK).fontSize(12).text(f.finding, 60, 170 + (idx * 110));
          setSafeFont(FONT_BODY, 'Helvetica');
          doc.fontSize(10).text(f.impact, 60, 190 + (idx * 110), { width: 480 });
        });

        // --- PAGE 8: CITATIONS & LEGAL ---
        doc.addPage();
        setSafeFont(FONT_BOLD, 'Helvetica-Bold');
        doc.fillColor(INK_BLACK).fontSize(20).text('Legal Disclosure & GDPR Notice', 50, 100);
        setSafeFont(FONT_BODY, 'Helvetica');
        doc.fontSize(9).lineGap(6).text(`"This certificate has been generated using only the data sources you have explicitly authorized through OAuth. Citations referenced in this report are sourced from your authorized connectors only. EYES does not search the public web, query third-party data brokers, or enrich this report with information from sources outside your authorized scope."`, 50, 140, { width: 500, align: 'justify' });
        doc.text(`"Pursuant to Articles 15 and 20 of the General Data Protection Regulation (EU 2016/679), the data analysed in this report constitutes your personal data, processed on your instruction. You have the right to access, rectify, erase, and export this data at any time through your EYES account. EYES does not retain analysis artefacts beyond the audit delivery period and does not use your data to train any model without your separate, explicit, opt-in consent."`, 50, 240, { width: 500, align: 'justify' });

        // Finalize
        drawHeaderAndFooter();
        doc.end();

      } catch (err) {
        reject(err);
      }
    });
  }

  private static async uploadToSupabase(buffer: Buffer, auditId: string, userId: string): Promise<string> {
    const supabase = await createClient();
    
    const fileName = `audits/${userId}/${auditId}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('audits')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw new Error(`PDF Upload Failed: ${error.message}`);
    }

    // Generate Signed URL valid for 7 days
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audits')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    if (signedUrlError) {
      throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`);
    }

    return signedUrlData.signedUrl;
  }
}
