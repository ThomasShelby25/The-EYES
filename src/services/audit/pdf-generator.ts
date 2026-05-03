import PDFDocument from 'pdfkit';
import { createClient } from '@/utils/supabase/server';
import { ReputationAudit } from '@/types/dashboard';

/**
 * Reputation Audit: PDF Generation Service
 * Migrated to Standard Fonts (Helvetica/Courier) for maximum Vercel/Turbopack compatibility.
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

        // --- STYLING CONSTANTS (Standard Fonts) ---
        const CREAM = '#FAFAF7';
        const INK_BLACK = '#1A1A1A';
        const EYES_BLUE = '#2563EB';
        const FOREST_GREEN = '#1F4D3F';
        const MUTED_RED = '#8B2E2E';
        const MUTED_TEXT = '#666666';

        // Standard Font Names (No files needed)
        const FONT_BODY = 'Helvetica';
        const FONT_BOLD = 'Helvetica-Bold';
        const FONT_MONO = 'Courier';

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
            doc.fillColor(FOREST_GREEN).fontSize(14).font(FONT_BOLD).text('EYES', 50, 40);
            
            // Footer
            doc.moveTo(50, doc.page.height - 60).lineTo(doc.page.width - 50, doc.page.height - 60).strokeColor(FOREST_GREEN).lineWidth(0.5).stroke();
            doc.fillColor('#888888').fontSize(8).font(FONT_BODY)
               .text(`Certificate ID: ${audit.id} | Non-transferable`, 50, doc.page.height - 50)
               .text(`Page ${i + 1} of ${pages.count}`, doc.page.width - 100, doc.page.height - 50, { align: 'right' });
          }
        };

        // --- PAGE 1: COVER ---
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(36).text('Audit\nCertificate', 50, 150);
        doc.moveTo(50, 240).lineTo(150, 240).strokeColor(FOREST_GREEN).lineWidth(4).stroke();
        
        doc.fontSize(12).font(FONT_BODY).text(`Prepared for: [Authenticated Subject]`, 50, 280);
        doc.text(`Date: ${new Date(audit.createdAt).toUTCString()}`, 50, 300);
        doc.text(`Audit ID: EYES-RA-${audit.id.slice(0, 8).toUpperCase()}`, 50, 320);

        doc.fontSize(10).font(FONT_BOLD).text('Connectors covered:', 50, 380);
        doc.font(FONT_BODY).text(audit.connectorsCovered.join(' . ').toUpperCase(), 50, 400);

        // --- PAGE 2: EXECUTIVE SUMMARY ---
        doc.addPage();
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(20).text('Executive Summary', 50, 100);
        doc.font(FONT_BODY).fontSize(12).lineGap(4).text(audit.summaryNarrative || 'No narrative generated.', 50, 140, { width: 500, align: 'justify' });

        // Headline Metrics
        let y = 280;
        doc.rect(50, y, 500, 100).fill('#FFFFFF').stroke(FOREST_GREEN);
        doc.fillColor(FOREST_GREEN).font(FONT_BOLD).fontSize(24).text(audit.mentionsCount.toString(), 100, y + 30);
        doc.fontSize(8).text('TOTAL MENTIONS', 100, y + 60);

        doc.fontSize(24).text(`${(audit.metadata.sentimentBalance * 100).toFixed(0)}%`, 250, y + 30);
        doc.fontSize(8).text('SENTIMENT BALANCE', 250, y + 60);

        doc.fontSize(24).text(audit.commitmentsCount.toString(), 400, y + 30);
        doc.fontSize(8).text('UNFULFILLED COMMITMENTS', 400, y + 60);

        // Risk Score
        y = 420;
        doc.rect(50, y, 500, 80).fill(FOREST_GREEN);
        doc.fillColor('#FFFFFF').font(FONT_BOLD).fontSize(48).text(audit.riskScore.toString(), 80, y + 15);
        doc.fontSize(14).text('RISK SCORE / 10', 180, y + 25);
        doc.fontSize(10).font(FONT_BODY).text(audit.riskScore > 7 ? 'Critical Exposure Identified' : audit.riskScore > 4 ? 'Moderate Risk Detected' : 'Minimal Trace Surface', 180, y + 45);

        // --- PAGES 3-5: PER-CONNECTOR BREAKDOWN ---
        audit.connectorsCovered.forEach(platform => {
          doc.addPage();
          doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(20).text(`Platform Breakdown: ${platform.toUpperCase()}`, 50, 100);
          doc.font(FONT_MONO).fontSize(10).text(`Indexing window: 24 months`, 50, 130);
          
          doc.font(FONT_BOLD).fontSize(12).text('Significant Records:', 50, 170);
          const platformCommitments = audit.metadata.commitments.filter(c => c.platform === platform);
          platformCommitments.slice(0, 3).forEach((c, idx) => {
            doc.rect(50, 200 + (idx * 100), 500, 80).stroke('#E5E5E0');
            doc.font(FONT_MONO).fontSize(9).fillColor('#666666').text(`Source ID: ${c.citation} | ${new Date(c.date).toLocaleDateString()}`, 60, 210 + (idx * 100));
            doc.font(FONT_BODY).fontSize(11).fillColor(INK_BLACK).text(`"${c.text.slice(0, 200)}..."`, 60, 230 + (idx * 100), { width: 480 });
          });
        });

        // --- PAGE 6: COMMITMENTS ---
        doc.addPage();
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(20).text('Detected Commitments', 50, 100);
        audit.metadata.commitments.slice(0, 10).forEach((c, idx) => {
          doc.fillColor(MUTED_RED).font(FONT_BOLD).fontSize(10).text(`[OVERDUE]`, 50, 150 + (idx * 30));
          doc.fillColor(INK_BLACK).font(FONT_BODY).text(c.text.slice(0, 80) + '...', 120, 150 + (idx * 30));
        });

        // --- PAGE 7: RISK FINDINGS ---
        doc.addPage();
        doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(20).text('Risk Findings', 50, 100);
        audit.metadata.riskFindings.forEach((f, idx) => {
          doc.rect(50, 140 + (idx * 110), 500, 100).stroke('#E5E5E0');
          doc.fillColor(f.severity === 'High' ? MUTED_RED : FOREST_GREEN).font(FONT_BOLD).fontSize(10).text(`${f.severity.toUpperCase()} RISK`, 60, 150 + (idx * 110));
          doc.fillColor(INK_BLACK).font(FONT_BOLD).fontSize(12).text(f.finding, 60, 170 + (idx * 110));
          doc.font(FONT_BODY).fontSize(10).text(f.impact, 60, 190 + (idx * 110), { width: 480 });
        });

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
