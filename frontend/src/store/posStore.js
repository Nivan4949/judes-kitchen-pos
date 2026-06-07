import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePOSStore = create(
  persist(
    (set, get) => ({
      cart: [],
      customer: null,
      loyaltyDiscount: 0,
      manualDiscount: 0,
      appliedPoints: 0,
      
      // Restaurant order state
      activeOrderId: null,
      orderType: 'Dine-in', // Dine-in, Takeaway, Delivery, Online
      waiterName: '',
      tableName: '',
      tableId: '',
      notes: '',
      serviceCharge: 0,
      parcelCharge: 0,
      deliveryCharge: 0,
      
      // Held Orders Queue
      heldOrders: [],

      initSocket: () => {
        console.log('Socket initialization disabled in this build');
      },

      setOrderType: (orderType) => set({ 
        orderType,
        // Clear irrelevant charges
        serviceCharge: orderType === 'Dine-in' ? get().serviceCharge : 0,
        parcelCharge: orderType === 'Takeaway' ? get().parcelCharge : 0,
        deliveryCharge: orderType === 'Delivery' ? get().deliveryCharge : 0
      }),

      setWaiter: (waiterName) => set({ waiterName }),
      
      setTable: (tableId, tableName) => set({ tableId, tableName }),
      
      setNotes: (notes) => set({ notes }),

      setCharges: (charges) => set((state) => ({
        serviceCharge: charges.serviceCharge !== undefined ? charges.serviceCharge : state.serviceCharge,
        parcelCharge: charges.parcelCharge !== undefined ? charges.parcelCharge : state.parcelCharge,
        deliveryCharge: charges.deliveryCharge !== undefined ? charges.deliveryCharge : state.deliveryCharge
      })),

      updatePrice: (productId, price) => set((state) => ({
        cart: state.cart.map((item) => 
          item.id === productId ? { ...item, sellingPrice: Math.max(0, price) } : item
        ),
      })),

      addToCart: (product, quantity = 1, selectedVariant = null, selectedModifiers = [], itemNotes = '') => set((state) => {
        if (!product) return state;

        // Generate a unique identifier for this cart line (based on item + variant + modifiers combination)
        const modifierKey = selectedModifiers.map(m => m.name).sort().join(',');
        const variantKey = selectedVariant ? selectedVariant.name : '';
        const cartLineId = `${product.id}-${variantKey}-${modifierKey}`;

        const existingItem = state.cart.find((item) => item.cartLineId === cartLineId);
        
        // Compute price based on variant and modifiers
        let itemPrice = product.sellingPrice;
        if (selectedVariant) {
          itemPrice = selectedVariant.price;
        }
        
        const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + (Number(m.price) || 0), 0);
        const finalPrice = itemPrice + modifiersPrice;

        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;
          return {
            cart: state.cart.map((item) =>
              item.cartLineId === cartLineId
                ? { ...item, quantity: newQuantity }
                : item
            ),
          };
        }

        const newItem = {
          ...product,
          cartLineId,
          quantity,
          sellingPrice: itemPrice, // Base price or variant price
          modifiersPrice,
          selectedVariant,
          selectedModifiers,
          notes: itemNotes,
          finalPrice // Total price per item unit (base/variant + modifiers)
        };

        return { cart: [...state.cart, newItem] };
      }),

      removeFromCart: (cartLineId) => set((state) => ({
        cart: state.cart.filter((item) => item.cartLineId !== cartLineId),
      })),

      updateQuantity: (cartLineId, quantity) => set((state) => ({
        cart: state.cart.map((item) => {
          if (item.cartLineId === cartLineId) {
            return { ...item, quantity: Math.max(0, quantity) };
          }
          return item;
        }),
      })),

      updateItemNotes: (cartLineId, notes) => set((state) => ({
        cart: state.cart.map((item) => 
          item.cartLineId === cartLineId ? { ...item, notes } : item
        )
      })),

      updateItemCustomizations: (cartLineId, variant, modifiers) => set((state) => {
        return {
          cart: state.cart.map((item) => {
            if (item.cartLineId === cartLineId) {
              const itemPrice = variant ? variant.price : item.sellingPrice;
              const modifiersPrice = modifiers.reduce((sum, m) => sum + (Number(m.price) || 0), 0);
              return {
                ...item,
                selectedVariant: variant,
                selectedModifiers: modifiers,
                sellingPrice: itemPrice,
                modifiersPrice,
                finalPrice: itemPrice + modifiersPrice
              };
            }
            return item;
          })
        };
      }),

      clearCart: () => set({ 
        cart: [], 
        customer: null, 
        loyaltyDiscount: 0, 
        manualDiscount: 0, 
        appliedPoints: 0,
        activeOrderId: null,
        waiterName: '',
        tableName: '',
        tableId: '',
        notes: '',
        serviceCharge: 0,
        parcelCharge: 0,
        deliveryCharge: 0
      }),
      
      setCustomer: (customer) => set({ customer, loyaltyDiscount: 0, appliedPoints: 0 }),

      setLoyaltyDiscount: (discount, points) => set({ loyaltyDiscount: discount, appliedPoints: points }),
      
      setManualDiscount: (discount) => set({ manualDiscount: discount }),
      
      // Hold Current Order
      holdCurrentOrder: () => set((state) => {
        if (state.cart.length === 0) return state;

        const orderToHold = {
          id: 'HOLD-' + Date.now().toString().slice(-6),
          orderType: state.orderType,
          waiterName: state.waiterName,
          tableName: state.tableName,
          tableId: state.tableId,
          cart: state.cart,
          customer: state.customer,
          serviceCharge: state.serviceCharge,
          parcelCharge: state.parcelCharge,
          deliveryCharge: state.deliveryCharge,
          notes: state.notes,
          manualDiscount: state.manualDiscount,
          loyaltyDiscount: state.loyaltyDiscount,
          appliedPoints: state.appliedPoints,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        return {
          heldOrders: [...state.heldOrders, orderToHold],
          cart: [],
          customer: null,
          loyaltyDiscount: 0,
          manualDiscount: 0,
          appliedPoints: 0,
          waiterName: '',
          tableName: '',
          tableId: '',
          notes: '',
          serviceCharge: 0,
          parcelCharge: 0,
          deliveryCharge: 0
        };
      }),

      // Resume Held Order
      resumeHeldOrder: (heldOrderId) => set((state) => {
        const order = state.heldOrders.find(o => o.id === heldOrderId);
        if (!order) return state;

        return {
          cart: order.cart,
          orderType: order.orderType,
          waiterName: order.waiterName,
          tableName: order.tableName,
          tableId: order.tableId,
          customer: order.customer,
          serviceCharge: order.serviceCharge,
          parcelCharge: order.parcelCharge,
          deliveryCharge: order.deliveryCharge,
          notes: order.notes,
          manualDiscount: order.manualDiscount,
          loyaltyDiscount: order.loyaltyDiscount,
          appliedPoints: order.appliedPoints,
          heldOrders: state.heldOrders.filter(o => o.id !== heldOrderId)
        };
      }),

      // Delete Held Order
      deleteHeldOrder: (heldOrderId) => set((state) => ({
        heldOrders: state.heldOrders.filter(o => o.id !== heldOrderId)
      })),

      // Load active running order directly into POS (e.g. from table management floor layout)
      loadRunningOrder: (order, items) => {
        // Map DB items to cart structure
        const cartItems = items.map((item) => {
          const modifiersPrice = Array.isArray(item.modifiers) 
            ? item.modifiers.reduce((sum, m) => sum + (Number(m.price) || 0), 0) 
            : 0;
          
          return {
            ...item.product,
            cartLineId: item.id,
            id: item.productId,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            sellingPrice: item.price,
            modifiersPrice,
            selectedVariant: item.variant ? { name: item.variant, price: item.price } : null,
            selectedModifiers: item.modifiers || [],
            notes: item.notes || '',
            finalPrice: item.price + modifiersPrice
          };
        });

        set({
          cart: cartItems,
          activeOrderId: order.id,
          orderType: order.orderType,
          waiterName: order.waiterName || '',
          tableName: order.tableName || '',
          tableId: order.tableId || '',
          notes: order.notes || '',
          serviceCharge: order.serviceCharge || 0,
          parcelCharge: order.parcelCharge || 0,
          deliveryCharge: order.deliveryCharge || 0,
          customer: order.customer || null,
          manualDiscount: order.discount || 0,
          loyaltyDiscount: 0,
          appliedPoints: 0
        });
      },

      getTotals: () => {
        const { cart, loyaltyDiscount, manualDiscount, serviceCharge, parcelCharge, deliveryCharge } = get();
        if (!cart) return { subtotal: 0, taxTotal: 0, grandTotal: 0, loyaltyDiscount: 0, manualDiscount: 0, serviceCharge: 0, parcelCharge: 0, deliveryCharge: 0 };
        
        const subtotal = cart.reduce(
          (acc, item) => acc + (item.sellingPrice + (item.modifiersPrice || 0)) * (item.quantity || 0),
          0
        );
        const taxTotal = cart.reduce(
          (acc, item) => acc + (((item.sellingPrice + (item.modifiersPrice || 0)) * ((item.gstRate || 0) / 100)) * (item.quantity || 0)),
          0
        );
        const savings = cart.reduce(
          (acc, item) => acc + ((item.mrp || item.sellingPrice || 0) - item.sellingPrice) * (item.quantity || 0),
          0
        );
        
        const grandTotal = Math.max(0, subtotal + taxTotal + serviceCharge + parcelCharge + deliveryCharge - (loyaltyDiscount || 0) - (manualDiscount || 0));
        const roundedTotal = Math.floor(grandTotal);
        
        return { subtotal, taxTotal, serviceCharge, parcelCharge, deliveryCharge, grandTotal, roundedTotal, loyaltyDiscount, manualDiscount, savings };
      },
    }),
    {
      name: 'pos-cart-storage-restaurant',
    }
  )
);

export default usePOSStore;
