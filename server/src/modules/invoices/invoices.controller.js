import PDFDocument from 'pdfkit';
import { prisma } from '../../config/prisma.js';

export async function downloadInvoice(req, res) {
  const { id } = req.params;

  try {
    const order = await prisma.rentalOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { product: true, unit: true } },
        depositLedger: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderNumber}.pdf`);

    // Create a document
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Rental Invoice', { align: 'right' });
    doc.fontSize(10).text(`Order Number: ${order.orderNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    
    doc.moveDown();
    
    // Company Info
    doc.fontSize(14).text('OdooX Rentals');
    doc.fontSize(10).text('123 Tech Park, Innovation Valley');
    doc.text('contact@odoox.com');
    doc.text('+1 (555) 123-4567');

    doc.moveDown();

    // Bill To
    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(10).text(order.customer.name);
    doc.text(order.customer.email);
    if (order.customer.phoneNumber) doc.text(order.customer.phoneNumber);
    if (order.customer.address) doc.text(order.customer.address);

    doc.moveDown(2);

    // Line Items Header
    doc.font('Helvetica-Bold');
    doc.text('Item', 50, doc.y, { width: 250 });
    doc.text('Duration', 300, doc.y, { width: 100 });
    doc.text('Amount', 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.5);
    
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.font('Helvetica');
    
    // Line Items
    order.lines.forEach(line => {
      const y = doc.y;
      doc.text(line.product?.name || 'Item', 50, y, { width: 250 });
      doc.text(`${line.durationCount} ${line.durationUnit}`, 300, y, { width: 100 });
      doc.text(`$${parseFloat(line.lineSubtotal).toFixed(2)}`, 400, y, { width: 100, align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown();

    // Summary
    doc.font('Helvetica-Bold');
    doc.text('Subtotal:', 300, doc.y, { width: 100 });
    doc.text(`$${parseFloat(order.subtotal).toFixed(2)}`, 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.5);

    doc.text('Security Deposit:', 300, doc.y, { width: 100 });
    doc.text(`$${parseFloat(order.depositTotal).toFixed(2)}`, 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.5);

    doc.fontSize(12);
    const totalPaid = parseFloat(order.total) + parseFloat(order.depositTotal);
    doc.text('Total Paid:', 300, doc.y, { width: 100 });
    doc.text(`$${totalPaid.toFixed(2)}`, 400, doc.y, { width: 100, align: 'right' });
    
    doc.moveDown(2);
    
    doc.font('Helvetica').fontSize(10);
    doc.text('Thank you for your business!', { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Invoice Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
  }
}
