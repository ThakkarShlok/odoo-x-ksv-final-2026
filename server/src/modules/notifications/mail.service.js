import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const isGmail = env.smtpHost?.toLowerCase() === 'gmail' || env.smtpUser?.toLowerCase().endsWith('@gmail.com');

  if (isGmail && env.smtpUser && env.smtpPass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  } else if (env.smtpHost && env.smtpUser && env.smtpPass) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  } else if (process.env.NODE_ENV === 'test') {
    // Only return mock transporter in Vitest test suite to keep endpoints tests green
    transporter = {
      sendMail: async (mailOptions) => {
        return { messageId: `mock_test_${crypto.randomUUID()}` };
      }
    };
  } else {
    throw new Error('SMTP/Gmail credentials are not configured on this server. Set SMTP_USER and SMTP_PASS in server/.env.');
  }
  return transporter;
}

export function generateInvoicePdfBuffer(order, invoiceNumber) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Add Header with branding
      doc.fillColor('#1e293b').fontSize(22).text('ZENITH RENTALS', { align: 'left' });
      doc.fontSize(9).fillColor('#64748b').text('Premium Asset & Equipment Rentals', { align: 'left' });
      doc.moveDown();

      // Invoice metadata
      doc.fillColor('#1e293b').fontSize(14).text('INVOICE', { align: 'right' });
      doc.fontSize(10).fillColor('#64748b').text(`Invoice Number: ${invoiceNumber || 'INV-TEMP'}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown(2);

      // Bill To section
      doc.fillColor('#1e293b').fontSize(12).text('BILL TO:', { underline: true });
      doc.fontSize(10).fillColor('#334155').text(`Customer Name: ${order.customer?.name || 'Customer'}`);
      doc.text(`Email: ${order.customer?.email || ''}`);
      doc.moveDown(1.5);

      // Order Info
      doc.fontSize(12).text('ORDER DETAILS:', { underline: true });
      doc.fontSize(10).text(`Order Number: ${order.orderNumber}`);
      doc.text(`Rental Period: ${new Date(order.rentalStart).toLocaleDateString()} to ${new Date(order.rentalEnd).toLocaleDateString()}`);
      doc.moveDown(2);

      // Table Header
      doc.fillColor('#1e293b').fontSize(10);
      const tableTop = doc.y;
      doc.text('Item Description', 50, tableTop, { width: 300 });
      doc.text('Daily Rate', 350, tableTop, { width: 100, align: 'right' });
      doc.text('Subtotal', 450, tableTop, { width: 100, align: 'right' });
      doc.moveDown(0.5);

      // Draw horizontal line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.5);

      // Table Rows
      if (order.lines && order.lines.length > 0) {
        order.lines.forEach((line) => {
          const prodName = line.productUnit?.product?.name || 'Rental Equipment';
          doc.text(prodName, 50, doc.y, { width: 300 });
          doc.text(`INR ${parseFloat(line.rateApplied).toFixed(2)}`, 350, doc.y, { width: 100, align: 'right' });
          doc.text(`INR ${parseFloat(line.lineSubtotal).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
          doc.moveDown();
        });
      } else {
        doc.text('Equipment Rental Fee', 50, doc.y, { width: 300 });
        doc.text(`INR ${parseFloat(order.total).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
        doc.moveDown();
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(1);

      // Totals
      const startY = doc.y;
      doc.text('Rental Subtotal:', 300, startY, { width: 150, align: 'right' });
      doc.text(`INR ${parseFloat(order.total).toFixed(2)}`, 450, startY, { width: 100, align: 'right' });
      doc.moveDown(0.5);

      doc.text('Security Deposit (Held):', 300, doc.y, { width: 150, align: 'right' });
      doc.text(`INR ${parseFloat(order.depositTotal).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
      doc.moveDown(0.5);

      doc.fillColor('#b45309').fontSize(11);
      doc.text('Total Paid:', 300, doc.y, { width: 150, align: 'right' });
      doc.text(`INR ${(Number(order.total) + Number(order.depositTotal)).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });

      doc.moveDown(3);
      doc.fillColor('#64748b').fontSize(8).text('Thank you for choosing Zenith Rentals!', { align: 'center' });
      doc.text('For support or inquiries, please reach out to support@zenith.dev', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function getEmailLayout(title, contentHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      overflow: hidden;
    }
    .header {
      background-color: #1e293b;
      padding: 32px;
      text-align: center;
      border-bottom: 4px solid #b45309;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .header p {
      margin: 4px 0 0 0;
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 16px;
      color: #0f172a;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .highlight-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .highlight-title {
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }
    .btn {
      display: inline-block;
      background-color: #b45309;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 8px;
      text-align: center;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .table th {
      text-align: left;
      padding: 10px;
      font-size: 12px;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    .table td {
      padding: 12px 10px;
      font-size: 14px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>ZENITH RENTALS</h1>
        <p>Premium Equipment & Asset Management</p>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p>&copy; 2026 Zenith Rentals. All rights reserved.</p>
        <p style="margin-top: 4px;">123 Industrial Park, Suite 100 | support@zenith.dev</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function getPaymentConfirmedHtml(order) {
  const itemsHtml = order.lines
    .map(
      (line) => `
    <tr>
      <td>${line.productUnit?.product?.name || 'Equipment Rental Item'}</td>
      <td>${line.durationCount} Days</td>
      <td style="text-align: right;">INR ${parseFloat(line.lineSubtotal).toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <h2 class="greeting">Booking Confirmed!</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">We have successfully verified your payment for order <strong>${order.orderNumber}</strong>. Your rental booking is now officially confirmed and your equipment has been reserved.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Booking Details</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Rental Start:</strong> ${new Date(order.rentalStart).toLocaleDateString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Scheduled Return:</strong> ${new Date(order.rentalEnd).toLocaleDateString()}</p>
    </div>

    <h3 style="margin-top: 24px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Reserved Assets</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Duration</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 16px; font-size: 14px; line-height: 1.5; color: #334155;">
      <p style="margin: 4px 0;">Rental Fee: <strong>INR ${parseFloat(order.total).toFixed(2)}</strong></p>
      <p style="margin: 4px 0;">Security Deposit (Held): <strong>INR ${parseFloat(order.depositTotal).toFixed(2)}</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 16px; color: #b45309; font-weight: bold;">Total Amount Paid: INR ${(Number(order.total) + Number(order.depositTotal)).toFixed(2)}</p>
    </div>

    <p class="text" style="margin-top: 24px;">Your official invoice is attached to this email as a PDF document. Please keep it for your financial records.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn">View Order Dashboard</a>
    </div>
  `;
}

function getHandoverCompletedHtml(order) {
  const itemsHtml = order.lines
    .map(
      (line) => `
    <tr>
      <td>${line.productUnit?.product?.name || 'Equipment'}</td>
      <td><code>${line.productUnit?.serialNumber || 'N/A'}</code></td>
    </tr>
  `
    )
    .join('');

  return `
    <h2 class="greeting">Equipment Handover Completed</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">The physical handover of your rented equipment has been successfully recorded for order <strong>${order.orderNumber}</strong>. The items are now in your active custody.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Rental Period Status</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Start Time (Actual):</strong> ${new Date().toLocaleString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Scheduled Return:</strong> ${new Date(order.rentalEnd).toLocaleString()}</p>
    </div>

    <h3 style="margin-top: 24px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Rented Assets Checked Out</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Serial / Barcode</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p class="text" style="margin-top: 24px;">Please make sure to return the equipment before the scheduled return date to avoid late return penalties. If you have any operational issues or need support, contact our team.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn">View Order Details</a>
    </div>
  `;
}

function getReturnCompletedHtml(order, penalties = 0) {
  return `
    <h2 class="greeting">Equipment Return Completed</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">We have successfully received and processed the return scan of the equipment for order <strong>${order.orderNumber}</strong>.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Return Summary</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Return Time (Actual):</strong> ${new Date().toLocaleString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Deposit Held:</strong> INR ${parseFloat(order.depositTotal).toFixed(2)}</p>
      ${
        penalties > 0
          ? `
        <p style="margin: 4px 0; font-size: 14px; color: #ef4444;"><strong>Late Penalties Incurred:</strong> INR ${parseFloat(penalties).toFixed(2)}</p>
        <p style="margin: 4px 0; font-size: 14px; color: #10b981;"><strong>Deposit Reconciled / Refundable:</strong> INR ${(Math.max(0, Number(order.depositTotal) - Number(penalties))).toFixed(2)}</p>
      `
          : `
        <p style="margin: 4px 0; font-size: 14px; color: #10b981;"><strong>Deposit Reconciled / Refundable:</strong> INR ${parseFloat(order.depositTotal).toFixed(2)}</p>
      `
      }
    </div>

    ${
      penalties > 0
        ? `
      <p class="text" style="color: #ef4444;">Note: A late return penalty of <strong>INR ${parseFloat(penalties).toFixed(2)}</strong> was assessed. This has been deducted from your held security deposit.</p>
    `
        : `
      <p class="text">All equipment was returned in good order and on time. Your held security deposit has been fully reconciled.</p>
    `
    }

    <p class="text">We appreciate your business and hope to serve you again soon!</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn">View Order Dashboard</a>
    </div>
  `;
}

function getWelcomeEmailHtml(user) {
  return `
    <h2 class="greeting">Welcome to Zenith Rentals!</h2>
    <p class="text">Dear ${user.name || 'User'},</p>
    <p class="text">Thank you for registering an account with Zenith Rentals. Your account has been successfully created and you can now log in to manage your bookings, browse our rental catalog, and request equipment quotes.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Your Profile Details</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Email Address:</strong> ${user.email}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Role:</strong> Customer</p>
    </div>

    <p class="text">Browse our catalog to select premium assets for your upcoming operations. We offer competitive pricing, direct-to-site fulfillment, and a streamlined checkout flow.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/login" class="btn">Login to Your Account</a>
    </div>
  `;
}

function getQuotationCreatedHtml(order) {
  return `
    <h2 class="greeting">New Quotation Prepared</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">A new rental quotation <strong>${order.orderNumber}</strong> has been successfully prepared for you and is now awaiting checkout.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Quotation Summary</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Quotation Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Rental Period:</strong> ${new Date(order.rentalStart).toLocaleDateString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Rental Subtotal:</strong> INR ${parseFloat(order.total).toFixed(2)}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Security Deposit:</strong> INR ${parseFloat(order.depositTotal).toFixed(2)}</p>
      <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: bold; color: #b45309;">Total Due Now: INR ${(Number(order.total) + Number(order.depositTotal)).toFixed(2)}</p>
    </div>

    <p class="text">Please review the details and proceed to payment to confirm your booking and lock in the equipment availability. The reservation hold will automatically expire if payment is not received before the checkout window.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn" style="background-color: #d97706;">Pay and Confirm Booking</a>
    </div>
  `;
}

function getOverdueHtml(order) {
  return `
    <h2 class="greeting" style="color: #ef4444;">Rental Return Overdue Reminder</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">This is a reminder that the rental period for order <strong>${order.orderNumber}</strong> has expired and your return is now overdue.</p>
    
    <div class="highlight-box" style="border-left: 4px solid #ef4444;">
      <div class="highlight-title" style="color: #ef4444;">Overdue Details</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Order ID:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Scheduled Return Date:</strong> ${new Date(order.rentalEnd).toLocaleString()}</p>
    </div>

    <p class="text">Please return the rented equipment to our warehouse immediately. Overdue items are subject to a daily late fee as outlined in your contract.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn" style="background-color: #ef4444;">View Order Dashboard</a>
    </div>
  `;
}

function getPickupDueTomorrowHtml(order) {
  return `
    <h2 class="greeting">Pickup Reminder: Order Tomorrow</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">This is a reminder that your equipment rental order <strong>${order.orderNumber}</strong> is scheduled for pickup/fulfillment tomorrow.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Scheduled Pickup Details</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Order ID:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Pickup Date/Time:</strong> ${new Date(order.rentalStart).toLocaleString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Fulfillment Method:</strong> ${order.fulfillmentMethod}</p>
    </div>

    <p class="text">Please be ready to receive the shipment or visit our pickup counter according to your fulfillment details. Make sure you have your confirmation code and ID handy.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn">View Order Dashboard</a>
    </div>
  `;
}

function getReturnDueTomorrowHtml(order) {
  return `
    <h2 class="greeting">Return Reminder: Due Back Tomorrow</h2>
    <p class="text">Dear ${order.customer?.name || 'Valued Customer'},</p>
    <p class="text">This is a friendly reminder that the equipment for your rental order <strong>${order.orderNumber}</strong> is due to be returned tomorrow.</p>
    
    <div class="highlight-box">
      <div class="highlight-title">Return Details</div>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Order ID:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Return Deadline:</strong> ${new Date(order.rentalEnd).toLocaleString()}</p>
    </div>

    <p class="text">Please ensure all rented equipment is returned to our warehouse on time tomorrow to avoid late charges. Contact support if you need to request a rental extension.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${env.clientOrigin}/rentals/${order.id}" class="btn">View Order Dashboard</a>
    </div>
  `;
}

export const mailService = {
  async sendMail({ to, subject, html, attachments }) {
    const activeTransporter = getTransporter();
    return activeTransporter.sendMail({
      from: env.smtpFrom,
      to,
      subject,
      html,
      attachments,
    });
  },

  async sendWelcomeEmail(user) {
    const html = getEmailLayout('Welcome to Zenith Rentals', getWelcomeEmailHtml(user));
    return this.sendMail({
      to: user.email,
      subject: 'Welcome to Zenith Rentals!',
      html,
    });
  },

  async sendOrderNotificationEmail(orderId, type, customData = {}) {
    try {
      const order = await prisma.rentalOrder.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          lines: {
            include: {
              productUnit: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!order || !order.customer?.email) {
        console.warn(`[mail] Order ${orderId} or customer email not found. Skipping email.`);
        return;
      }

      let subject = '';
      let html = '';
      let attachments = [];

      switch (type) {
        case 'QUOTATION_CREATED':
          subject = `New Quotation Prepared: ${order.orderNumber}`;
          html = getEmailLayout(subject, getQuotationCreatedHtml(order));
          break;
          
        case 'PAYMENT_CONFIRMED':
          subject = `Booking Confirmed: ${order.orderNumber}`;
          html = getEmailLayout(subject, getPaymentConfirmedHtml(order));
          
          // Generate invoice attachment
          try {
            const invoiceNumber = `INV-2026-${order.orderNumber.split('-').slice(-1)}`;
            const pdfBuffer = await generateInvoicePdfBuffer(order, invoiceNumber);
            attachments.push({
              filename: `${invoiceNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            });
          } catch (pdfErr) {
            console.error('[mail] Failed to generate PDF invoice attachment:', pdfErr);
          }
          break;

        case 'HANDOVER_COMPLETED':
          subject = `Equipment Handover Complete: ${order.orderNumber}`;
          html = getEmailLayout(subject, getHandoverCompletedHtml(order));
          break;

        case 'PENALTY_APPLIED':
          subject = `Return Completed (Penalties Applied): ${order.orderNumber}`;
          html = getEmailLayout(subject, getReturnCompletedHtml(order, customData.penalties || order.totalPenalties));
          break;

        case 'RETURN_COMPLETED':
          subject = `Equipment Return Reconciled: ${order.orderNumber}`;
          html = getEmailLayout(subject, getReturnCompletedHtml(order, 0));
          break;

        case 'RETURN_OVERDUE':
          subject = `Return Overdue Reminder: ${order.orderNumber}`;
          html = getEmailLayout(subject, getOverdueHtml(order));
          break;

        case 'PICKUP_DUE_TOMORROW':
          subject = `Pickup Reminder: Order ${order.orderNumber}`;
          html = getEmailLayout(subject, getPickupDueTomorrowHtml(order));
          break;

        case 'RETURN_DUE_TOMORROW':
          subject = `Return Reminder: Due Tomorrow: ${order.orderNumber}`;
          html = getEmailLayout(subject, getReturnDueTomorrowHtml(order));
          break;

        default:
          console.warn(`[mail] Unsupported email notification type: ${type}. Skipping.`);
          return;
      }

      await this.sendMail({
        to: order.customer.email,
        subject,
        html,
        attachments,
      });
    } catch (err) {
      console.error(`[mail] Failed to send order notification email (${type}) for order ${orderId}:`, err);
    }
  },
};
