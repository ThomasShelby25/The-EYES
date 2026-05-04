import PDFDocument from 'pdfkit';
import { createClient } from '@/utils/supabase/server';
import { ReputationAudit } from '@/types/dashboard';

/**
 * Reputation Audit: PDF Generation Service
 * Updated to match high-fidelity textual mock for EYES Audit Certificates.
 */

export class PDFGenerationService {
  static async generateAndUpload(audit: ReputationAudit, userId: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 0, // Manual margins for exact layout control
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
        const GRAY_FOOTER = '#666666';

        const FONT_BODY = 'Helvetica';
        const FONT_BOLD = 'Helvetica-Bold';
        const FONT_MONO = 'Courier';

        // --- PAGE 1: COVER PAGE ---
        // Background
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(CREAM);

        // Header Section
        doc.fillColor(INK_BLACK).fontSize(14).font(FONT_BOLD).text('EYES', 50, 40);
        doc.fillColor(MUTED_RED).fontSize(8).font(FONT_BOLD).text('CONFIDENTIAL · CERTIFICATE', 50, 40, { align: 'right', width: doc.page.width - 100 });
        
        // Horizontal Rule
        doc.moveTo(50, 60).lineTo(doc.page.width - 50, 60).strokeColor(INK_BLACK).lineWidth(0.5).stroke();

        // Main Title
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(32).text('Reputation Audit\nCertificate', 50, 150, { lineGap: 10 });
        
        // Subject & Info
        doc.fontSize(12).font(FONT_BODY).text(`Prepared for: ${audit.metadata.subjectName || 'Authenticated Subject'}`, 50, 280);
        
        const dateObj = new Date(audit.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = dateObj.getUTCHours().toString().padStart(2, '0') + ':' + dateObj.getUTCMinutes().toString().padStart(2, '0');
        doc.text(`Date: ${dateStr} · ${timeStr} UTC`, 50, 305);
        doc.text(`Audit ID: EYES-RA-${audit.id.slice(0, 8).toUpperCase()}`, 50, 330);

        // Connectors
        doc.fontSize(10).font(FONT_BOLD).text('Connectors covered', 50, 400);
        // Accent rule
        doc.moveTo(50, 415).lineTo(163, 415).strokeColor(FOREST_GREEN).lineWidth(2).stroke(); // ~4cm wide
        
        doc.fontSize(10).font(FONT_BODY).fillColor(INK_BLACK)
           .text(audit.connectorsCovered.join(' · '), 50, 430);

        // Footer
        doc.fillColor(GRAY_FOOTER).fontSize(7).font(FONT_BODY)
           .text("This certificate is bound to the audit ID above and is non-transferable. Generated using only the user's authorized data sources.", 50, doc.page.height - 50, { width: doc.page.width - 100, align: 'center' });

        // --- PAGE 2: EXECUTIVE SUMMARY ---
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(CREAM);

        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(20).text('Executive Summary', 50, 100);
        
        // Narrative
        doc.font(FONT_BODY).fontSize(11).lineGap(6)
           .text(audit.summaryNarrative || 'No narrative generated.', 50, 140, { width: 500, align: 'justify' });

        // Metrics Grid
        let y = 300;
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(14).text(`Risk score: ${audit.riskScore.toFixed(1)} / 10`, 50, y);
        doc.fontSize(8).font(FONT_BODY).text('(Methodology below.)', 50, y + 18);

        y += 60;
        const colWidth = 120;
        doc.fontSize(10).font(FONT_BOLD).text('Total mentions:', 50, y);
        doc.font(FONT_BODY).text(audit.mentionsCount.toString(), 50 + 80, y);

        doc.font(FONT_BOLD).text('Sentiment balance:', 50 + 170, y);
        const sentimentStr = (audit.metadata.sentimentBalance >= 0 ? '+' : '') + audit.metadata.sentimentBalance.toFixed(2);
        const sentimentLabel = audit.metadata.sentimentBalance > 0.1 ? '(positive)' : audit.metadata.sentimentBalance < -0.1 ? '(negative)' : '(neutral)';
        doc.font(FONT_BODY).text(`${sentimentStr} ${sentimentLabel}`, 50 + 170 + 100, y);

        y += 25;
        doc.font(FONT_BOLD).text('Unfulfilled commitments:', 50, y);
        doc.font(FONT_BODY).text(audit.commitmentsCount.toString(), 50 + 130, y);

        doc.font(FONT_BOLD).text('High-risk findings:', 50 + 260, y);
        doc.font(FONT_BODY).text(audit.metadata.riskFindings.filter(f => f.severity === 'High').length.toString(), 50 + 260 + 100, y);

        // Methodology Block
        y = 450;
        doc.fillColor(GRAY_FOOTER).fontSize(8).font(FONT_BODY)
           .text('Methodology', 50, y, { underline: true });
        doc.text('Risk score = ((negative × 2) + (neutral × 0.5) + (unfulfilled × 3)) / total × 10, capped at 10. Recency weighting: ≤30 days at 1.0x, ≤180 days at 0.5x, >180 days at 0.2x.', 50, y + 15, { width: 500 });

        // Footer for Page 2
        doc.fillColor(GRAY_FOOTER).fontSize(7).font(FONT_BODY)
           .text(`Audit ID: ${audit.id} | Page 2`, 50, doc.page.height - 50, { align: 'center', width: doc.page.width - 100 });

        // Finalize
        doc.end();

      } catch (err) {
        reject(err);
      }
    });
  }

  private static async uploadToSupabase(buffer: Buffer, auditId: string, userId: string): Promise<string> {
    const supabase = await createClient();
    const fileName = `audits/${userId}/${auditId}.pdf`;
    
    const { error } = await supabase.storage
      .from('audits')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw new Error(`PDF Upload Failed: ${error.message}`);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audits')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    if (signedUrlError) throw new Error(`Signed URL Failed: ${signedUrlError.message}`);

    return signedUrlData.signedUrl;
  }
}
