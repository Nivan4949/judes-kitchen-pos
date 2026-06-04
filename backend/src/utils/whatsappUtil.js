const axios = require('axios');

/**
 * WhatsApp Utility to send automated receipts
 * Supports UltraMsg and other generic WhatsApp API instances
 */
const whatsappUtil = {
  /**
   * Helper to format the API URL (ensures endpoint is included)
   */
  getFormattedURL: (apiURL) => {
    if (!apiURL) return null;
    let url = apiURL.trim();
    // UltraMsg typically uses /messages/chat for text messages
    if (!url.includes('/messages/chat') && url.includes('ultramsg.com')) {
      url = url.endsWith('/') ? `${url}messages/chat` : `${url}/messages/chat`;
    }
    return url;
  },

  /**
   * Send a formatted PDF receipt to a customer
   * @param {Object} order - The created order object (with orderItems and product details)
   * @param {string} phone - The customer's 10-digit phone number
   */
  sendReceipt: async (order, phone, requestedHost = null) => {
    const baseURL = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    
    // Dynamic host detection: Priority to request header, fallback to APP_URL
    const appURL = requestedHost 
      ? `https://${requestedHost}` 
      : (process.env.APP_URL || 'https://freshnaad.vercel.app');

    if (!baseURL || !apiKey || !phone) {
      console.warn('WhatsApp PDF automation skipped: Missing API URL or Key.');
      return { success: false, error: 'Incomplete Configuration' };
    }

    // Format phone: strip non-digits, take last 10, prefix 91
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const formattedPhone = `91${cleanPhone}`;

    // PDF URL pointing to our public endpoint (Cache Buster added)
    let pdfUrl = `${appURL.replace(/\/$/, '')}/api/orders/${order.id}/pdf?t=${Date.now()}`;
    
    // Vercel Deployment Protection Bypass if token is provided
    const bypassToken = process.env.VERCEL_BYPASS_TOKEN;
    if (bypassToken) {
      const separator = pdfUrl.includes('?') ? '&' : '?';
      pdfUrl += `${separator}x-vercel-protection-bypass=${bypassToken}&x-vercel-set-bypass-cookie=true`;
    }

    const docEndpoint = baseURL.includes('ultramsg.com') 
        ? (baseURL.endsWith('/') ? `${baseURL}messages/document` : `${baseURL}/messages/document`)
        : baseURL;

    try {
      console.log(`[WhatsApp] Triggering PDF Delivery to ${formattedPhone} (Invoice: ${order.invoiceNo}, Domain: ${appURL})`);
      
      // DIAGNOSTIC CHECK: Is the host localhost? (UltraMsg cannot reach localhost)
      if (appURL.includes('localhost') || appURL.includes('127.0.0.1')) {
        console.warn('[WhatsApp] LOCALHOST WARNING: UltraMsg cannot access your laptop to download the PDF. Delivery WILL fail in dev mode.');
      }

      const params = new URLSearchParams();
      params.append('token', apiKey);
      params.append('to', formattedPhone);
      params.append('document', pdfUrl);
      params.append('filename', `Invoice-${order.invoiceNo}.pdf`);
      params.append('caption', `*TAX INVOICE: ${order.invoiceNo}*\nThank you for shopping with Fresh Naad India\nHave a nice day 🤍,visit again..!\n\n\n\nhttps://www.instagram.com/freshnaad?igsh=MWQ1Zjc2NTVtbjJyeQ== \n.\n.\n.\nFor more products and updates follow us ❕❕`);

      const response = await axios.post(docEndpoint, params, { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000 // Invoices can take time to generate
      });

      console.log(`[WhatsApp] Document API Response:`, JSON.stringify(response.data));
      return { success: true, message: 'PDF Sent Successfully', data: response.data };
    } catch (error) {
      let errorData = error.message;
      if (error.response?.data) {
        errorData = typeof error.response.data === 'object' 
          ? JSON.stringify(error.response.data) 
          : error.response.data;
      }
      console.error(`[WhatsApp] PDF Delivery Failure:`, errorData);
      return { success: false, error: 'Document API Error', details: errorData };
    }
  },

  /**
   * Send a formatted PDF credit note to a customer
   */
  sendReturnReceipt: async (salesReturn, phone, requestedHost = null) => {
    const baseURL = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    
    // Dynamic host detection
    const appURL = requestedHost 
      ? `https://${requestedHost}` 
      : (process.env.APP_URL || 'https://freshnaad.vercel.app');

    if (!baseURL || !apiKey || !phone) {
      console.warn('WhatsApp Return PDF skipped: Missing config.');
      return { success: false, error: 'Incomplete Configuration' };
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const formattedPhone = `91${cleanPhone}`;
    let pdfUrl = `${appURL.replace(/\/$/, '')}/api/sales-returns/${salesReturn.id}/pdf?t=${Date.now()}`;
    
    // Vercel Deployment Protection Bypass
    const bypassToken = process.env.VERCEL_BYPASS_TOKEN;
    if (bypassToken) {
      const separator = pdfUrl.includes('?') ? '&' : '?';
      pdfUrl += `${separator}x-vercel-protection-bypass=${bypassToken}&x-vercel-set-bypass-cookie=true`;
    }

    const docEndpoint = baseURL.includes('ultramsg.com') 
        ? (baseURL.endsWith('/') ? `${baseURL}messages/document` : `${baseURL}/messages/document`)
        : baseURL;

    try {
      console.log(`[WhatsApp] Triggering Return PDF to ${formattedPhone} (Return: ${salesReturn.returnNo}, Domain: ${appURL})`);

      const params = new URLSearchParams();
      params.append('token', apiKey);
      params.append('to', formattedPhone);
      params.append('document', pdfUrl);
      params.append('filename', `CreditNote-${salesReturn.returnNo}.pdf`);
      params.append('caption', `*CREDIT NOTE: ${salesReturn.returnNo}*\nAmount added to your digital wallet.`);

      const response = await axios.post(docEndpoint, params, { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000 
      });

      console.log(`[WhatsApp] Return API Response:`, JSON.stringify(response.data));
      return { success: true, message: 'Return PDF Sent' };
    } catch (error) {
       const errorData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
       console.error(`[WhatsApp] Return PDF Failure:`, errorData);
       return { success: false, error: 'Return Document API Error' };
    }
  }
};

module.exports = whatsappUtil;
