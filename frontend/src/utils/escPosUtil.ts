/**
 * Minimal ESC/POS Builder for Thermal Printers
 * Supports basic text, alignment, and formatting
 */
export class EscPosBuilder {
  private buffer: number[] = [];
  private encoder = new TextEncoder();

  constructor() {
    this.init();
  }

  private init() {
    this.buffer.push(
      0x1B, 0x40,       // ESC @: Initialize printer
      0x1C, 0x2E,       // FS .: Disable Chinese Character Mode
      0x1B, 0x74, 0x00  // ESC t 0: Set Code Page to PC437 (Standard English)
    ); 
    return this;
  }

  text(str: string) {
    const bytes = this.encoder.encode(str);
    this.buffer.push(...Array.from(bytes));
    return this;
  }

  line(str: string = '') {
    this.text(str + '\n');
    return this;
  }

  alignCenter() {
    this.buffer.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1B, 0x61, 0x02);
    return this;
  }

  bold(on: boolean = true) {
    this.buffer.push(0x1B, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  doubleSize(on: boolean = true) {
    this.buffer.push(0x1B, 0x21, on ? 0x30 : 0x00);
    return this;
  }

  feed(lines: number = 3) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  cut() {
    this.buffer.push(0x1D, 0x56, 0x42, 0x00);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Helper to format an Order object into a restaurant receipt
   */
  static generateReceipt(order: any, settings: any): Uint8Array {
    const builder = new EscPosBuilder();
    const width = settings?.printerSize === '58mm' ? 32 : 48;
    const divider = '-'.repeat(width);

    // Header
    builder.alignCenter()
           .doubleSize(true)
           .bold(true)
           .line(settings?.name || 'JUDE\'S KITCHEN')
           .doubleSize(false)
           .bold(false)
           .line(settings?.address || 'Kodassery, Malappuram')
           .line(`Mob: ${settings?.phone || '8606391315'}`);
           
    if (settings?.gstin) {
      builder.line(`GSTIN: ${settings.gstin}`);
    }
    builder.line(divider);

    // Order Info
    builder.alignLeft()
           .line(`Invoice : ${order.invoiceNo || 'N/A'}`)
           .line(`Date    : ${new Date(order.createdAt || Date.now()).toLocaleString()}`)
           .line(`Cust    : ${order.customer?.name || 'Walk-in'}`)
           .line(`Mode    : ${order.orderType || 'Dine-in'}`);

    if (order.tableName) {
      builder.line(`Table   : ${order.tableName}`);
    }
    if (order.waiterName) {
      builder.line(`Waiter  : ${order.waiterName}`);
    }
    builder.line(divider);

    // Items Column Header
    builder.bold(true);
    if (width === 32) {
      builder.line('Item           Qty  Price  Total');
    } else {
      builder.line('#  Description       Qty      Price    Tax%     Total');
    }
    builder.bold(false);

    // Items
    (order.orderItems || []).forEach((item: any, idx: number) => {
      const slNo = (idx + 1).toString().padEnd(2);
      const variantSuffix = item.variant ? ` (${item.variant})` : '';
      const fullName = (item.product?.name || item.name || 'Item') + variantSuffix;
      const qtyVal = Number(item.quantity);
      const qty = qtyVal.toFixed(0);
      const priceVal = Number(item.price);
      
      const totalVal = Number(item.total);
      
      if (width === 32) {
        const itemLine = `${fullName.substring(0, 14).padEnd(14)} ${qty.padStart(3)} ${priceVal.toFixed(0).padStart(5)} ${totalVal.toFixed(0).padStart(6)}`;
        builder.line(itemLine);
      } else {
        const desc = fullName.substring(0, 16).padEnd(16);
        const gstRate = (item.gstRate || item.product?.gstRate || 0).toFixed(0).padStart(3);
        const itemLine = `${slNo} ${desc} ${qty.padStart(5)} ${priceVal.toFixed(2).padStart(10)} ${gstRate}% ${totalVal.toFixed(2).padStart(10)}`;
        builder.line(itemLine);
      }

      // Print modifiers
      if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        item.modifiers.forEach((m: any) => {
          builder.line(`  + ${m.name} (Rs.${m.price})`);
        });
      }

      // Print item notes
      if (item.notes) {
        builder.line(`  * Note: ${item.notes}`);
      }
    });

    builder.line(divider);

    // Totals & Charges
    builder.alignRight()
           .line(`Subtotal : Rs. ${Number(order.subtotal || 0).toFixed(2)}`);


    if (order.parcelCharge > 0) {
      builder.line(`Parcel Charge : Rs. ${Number(order.parcelCharge).toFixed(2)}`);
    }
    if (order.deliveryCharge > 0) {
      builder.line(`Delivery Charge : Rs. ${Number(order.deliveryCharge).toFixed(2)}`);
    }

    if (order.discount > 0) {
      builder.line(`Discount : -Rs. ${Number(order.discount).toFixed(2)}`);
    }

    builder.bold(true)
           .line(divider.slice(-16))
           .doubleSize(true)
           .line(`NET TOTAL: Rs.${Number(order.roundedTotal || order.grandTotal).toFixed(0)}`)
           .doubleSize(false)
           .line(divider.slice(-16))
           .bold(false)
           .line(`Tendered : Rs. ${Number(order.amountPaid || 0).toFixed(2)}`)
           .line(`Balance  : Rs. ${Number(order.balance || 0).toFixed(2)}`);

    builder.alignCenter()
           .feed(1)
           .line('THANK YOU VISIT AGAIN')
           .line('Powered by Jude\'s Kitchen')
           .feed(3)
           .cut();

    return builder.build();
  }

  /**
   * Helper to format a KOT ticket into thermal format
   */
  static generateKotReceipt(kot: any, settings: any): Uint8Array {
    const builder = new EscPosBuilder();
    const width = settings?.printerSize === '58mm' ? 32 : 48;
    const divider = '-'.repeat(width);

    builder.alignCenter()
           .doubleSize(true)
           .bold(true)
           .line(kot.status === 'CANCELLED' ? 'KOT CANCELLATION' : 'KOT TICKET')
           .doubleSize(false)
           .bold(false)
           .line(divider);

    builder.alignLeft()
           .line(`KOT No  : ${kot.kotNo}`)
           .line(`Date    : ${new Date(kot.createdAt || Date.now()).toLocaleTimeString()}`);
    
    if (kot.tableName) {
      builder.line(`Table   : ${kot.tableName}`);
    } else {
      builder.line(`Mode    : ${kot.orderType}`);
    }

    if (kot.waiterName) {
      builder.line(`Waiter  : ${kot.waiterName}`);
    }
    
    if (kot.reprintCount > 0) {
      builder.bold(true).line(`** REPRINT #${kot.reprintCount} **`).bold(false);
    }
    
    builder.line(divider);

    // Items list (simple description and quantity for chef)
    builder.bold(true);
    builder.line('Description                  Qty');
    builder.bold(false);
    builder.line(divider);

    (kot.items || []).forEach((item: any) => {
      const variantSuffix = item.variant ? ` (${item.variant})` : '';
      const fullName = item.name + variantSuffix;
      const qty = Number(item.quantity).toFixed(0).padStart(4);
      
      builder.line(`${fullName.substring(0, width - 6).padEnd(width - 6)} ${qty}`);

      // Modifiers
      if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        item.modifiers.forEach((m: any) => {
          builder.line(`  + ${m.name}`);
        });
      }

      // Notes/instructions
      if (item.notes) {
        builder.bold(true).line(`  * Note: ${item.notes}`).bold(false);
      }
    });

    builder.line(divider);
    builder.feed(3).cut();

    return builder.build();
  }
}
