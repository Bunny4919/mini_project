const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { v4: uuidv4 } = require('uuid');

/**
 * Export processed document to specified format
 * @param {Object} content - Processed document content
 * @param {string} format - Export format (pdf, docx, txt)
 * @param {string} exportDir - Directory to save exports
 * @returns {string} Path to exported file
 */
async function exportDocument(content, format, exportDir) {
    const filename = `document-${uuidv4()}`;
    const sections = content.sections;

    switch (format.toLowerCase()) {
        case 'pdf':
            return await exportToPDF(content.text, path.join(exportDir, `${filename}.pdf`), sections);
        case 'docx':
            return await exportToDOCX(content.text, path.join(exportDir, `${filename}.docx`), sections);
        case 'txt':
            return exportToTXT(content.text, path.join(exportDir, `${filename}.txt`));
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}

/**
 * Export comparison report to specified format
 */
async function exportReport(original, processed, changes, format, exportDir) {
    const filename = `report-${uuidv4()}`;
    const reportContent = generateReportContent(original, processed, changes);

    switch (format.toLowerCase()) {
        case 'pdf':
            return await exportReportToPDF(reportContent, path.join(exportDir, `${filename}.pdf`));
        case 'docx':
            return await exportReportToDOCX(reportContent, path.join(exportDir, `${filename}.docx`));
        case 'txt':
            return exportToTXT(reportContent.text, path.join(exportDir, `${filename}.txt`));
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}

/**
 * Generate report content structure
 */
function generateReportContent(original, processed, changes) {
    const lines = [
        'DOCUMENT FORMATTING REPORT',
        '='.repeat(50),
        '',
        `Generated: ${new Date().toISOString()}`,
        `Total Changes: ${changes.length}`,
        '',
        'SUMMARY OF CHANGES',
        '-'.repeat(50),
    ];

    changes.forEach((change, idx) => {
        lines.push(`${idx + 1}. ${change.description}`);
        if (change.before && change.after) {
            lines.push(`   Before: "${change.before}"`);
            lines.push(`   After: "${change.after}"`);
        }
        lines.push('');
    });

    lines.push('');
    lines.push('ORIGINAL DOCUMENT');
    lines.push('-'.repeat(50));
    lines.push(original.text);
    lines.push('');
    lines.push('PROCESSED DOCUMENT');
    lines.push('-'.repeat(50));
    lines.push(processed.text);

    return {
        text: lines.join('\n'),
        original,
        processed,
        changes
    };
}

/**
 * Export to PDF
 * @param {string} text - Fallback text if sections not provided
 * @param {string} filepath - Path to save
 * @param {Array} sections - Optional sections with specific formatting
 */
async function exportToPDF(text, filepath, sections = null) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        if (sections && sections.length > 0) {
            sections.forEach(section => {
                const fmt = section.formatting || {};
                const size = parseInt(fmt.size) || 12;
                const isBold = fmt.bold === 'true';
                const align = fmt.align || 'left';

                doc.fontSize(size)
                    .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(section.content, {
                        align: align === 'justify' ? 'justify' : align,
                        lineGap: 2
                    });
                doc.moveDown(0.5);
            });
        } else {
            // Add title
            doc.fontSize(16).font('Helvetica-Bold').text('Formatted Document', { align: 'center' });
            doc.moveDown();

            // Add content
            doc.fontSize(12).font('Helvetica');

            const paragraphs = text.split('\n\n');
            paragraphs.forEach(para => {
                if (para.trim()) {
                    doc.text(para.trim(), { align: 'left', lineGap: 2 });
                    doc.moveDown(0.5);
                }
            });
        }

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
    });
}

/**
 * Export report to PDF
 */
async function exportReportToPDF(reportContent, filepath) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Document Formatting Report', { align: 'center' });
        doc.moveDown();

        // Metadata
        doc.fontSize(10).font('Helvetica')
            .text(`Generated: ${new Date().toLocaleString()}`)
            .text(`Total Changes: ${reportContent.changes.length}`);
        doc.moveDown();

        // Changes section
        doc.fontSize(14).font('Helvetica-Bold').text('Summary of Changes');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        reportContent.changes.forEach((change, idx) => {
            doc.font('Helvetica-Bold').text(`${idx + 1}. ${change.type.toUpperCase()}`, { continued: false });
            doc.font('Helvetica').text(`   ${change.description}`);
            if (change.before && change.after && !change.appliedDuringExport) {
                doc.fillColor('red').text(`   Before: ${change.before.substring(0, 80)}`, { continued: false });
                doc.fillColor('green').text(`   After: ${change.after.substring(0, 80)}`);
                doc.fillColor('black');
            }
            doc.moveDown(0.3);
        });

        // Original document
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Original Document');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(reportContent.original.text.substring(0, 3000));

        // Processed document
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Processed Document');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(reportContent.processed.text.substring(0, 3000));

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
    });
}

/**
 * Export to DOCX
 * @param {string} text - Fallback text if sections not provided
 * @param {string} filepath - Path to save
 * @param {Array} sections - Optional sections with specific formatting
 */
async function exportToDOCX(text, filepath, sections = null) {
    const children = [];

    if (sections && sections.length > 0) {
        sections.forEach(section => {
            const fmt = section.formatting || {};
            const size = (parseInt(fmt.size) || 12) * 2; // docx uses half-points
            const isBold = fmt.bold === 'true';
            let alignment = 'left';

            if (fmt.align === 'center') alignment = 'center';
            if (fmt.align === 'right') alignment = 'right';
            if (fmt.align === 'justify') alignment = 'both';

            children.push(
                new Paragraph({
                    alignment: alignment,
                    children: [
                        new TextRun({
                            text: section.content,
                            bold: isBold,
                            size: size,
                            font: fmt.font || 'Times New Roman'
                        })
                    ]
                })
            );
        });
    } else {
        const paragraphs = text.split('\n').filter(line => line.trim() !== '');
        children.push(
            new Paragraph({
                children: [new TextRun({ text: 'Formatted Document', bold: true, size: 32 })],
                heading: HeadingLevel.TITLE,
            }),
            ...paragraphs.map(para =>
                new Paragraph({
                    children: [new TextRun({ text: para, size: 24 })],
                })
            )
        );
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

/**
 * Export report to DOCX
 */
async function exportReportToDOCX(reportContent, filepath) {
    const children = [
        new Paragraph({
            children: [new TextRun({ text: 'Document Formatting Report', bold: true, size: 40 })],
            heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
            children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20 })],
        }),
        new Paragraph({
            children: [new TextRun({ text: `Total Changes: ${reportContent.changes.length}`, size: 20 })],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
            children: [new TextRun({ text: 'Summary of Changes', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
        }),
    ];

    // Add changes
    reportContent.changes.forEach((change, idx) => {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: `${idx + 1}. `, bold: true, size: 22 }),
                    new TextRun({ text: change.description, size: 22 }),
                ],
            })
        );
        if (change.before && change.after && !change.appliedDuringExport) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: '   Before: ', bold: true, size: 20 }),
                        new TextRun({ text: change.before.substring(0, 80), size: 20, color: 'CC0000' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: '   After: ', bold: true, size: 20 }),
                        new TextRun({ text: change.after.substring(0, 80), size: 20, color: '00CC00' }),
                    ],
                })
            );
        }
    });

    // Add original document section
    children.push(
        new Paragraph({ children: [] }),
        new Paragraph({
            children: [new TextRun({ text: 'Original Document', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
            children: [new TextRun({ text: reportContent.original.text.substring(0, 5000), size: 20 })],
        })
    );

    // Add processed document section
    children.push(
        new Paragraph({ children: [] }),
        new Paragraph({
            children: [new TextRun({ text: 'Processed Document', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
            children: [new TextRun({ text: reportContent.processed.text.substring(0, 5000), size: 20 })],
        })
    );

    const doc = new Document({
        sections: [{ properties: {}, children }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

/**
 * Export to TXT
 */
function exportToTXT(text, filepath) {
    fs.writeFileSync(filepath, text, 'utf-8');
    return filepath;
}

module.exports = { exportDocument, exportReport };
