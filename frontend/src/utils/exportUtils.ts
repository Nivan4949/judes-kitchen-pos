import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Universal Export Utility
 */
export const exportUtils = {
  /**
   * Export JSON data to CSV
   */
  exportToCSV: (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    // 1. Extract Headers
    const headers = Object.keys(data[0]);
    
    // 2. Format Rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(fieldName => {
          let value = row[fieldName];
          if (value === null || value === undefined) value = '';
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value).replace(/"/g, '""');
          return stringValue.includes(',') || stringValue.includes('"') ? `"${stringValue}"` : stringValue;
        }).join(',')
      )
    ];

    // 3. Create Blob and Trigger Download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Export Table Data to PDF using jspdf-autotable
   */
  exportToPDF: (config: { title: string, headers: string[], data: any[][], filename: string }) => {
    const doc = new jsPDF() as any;

    // 1. Add Header / Branding
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text('JUDE\'S KITCHEN', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Delightful Food Truck & Kitchen Solutions', 14, 28);

    // 2. Add Report Title & Date
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(config.title, 14, 45);
    
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 52);

    // 3. Generate Table
    autoTable(doc, {
      startY: 60,
      head: [config.headers],
      body: config.data,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 60 },
      didDrawPage: (data: any) => {
        // Footer (Page Number)
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });

    // 4. Save
    doc.save(`${config.filename}.pdf`);
  }
};
