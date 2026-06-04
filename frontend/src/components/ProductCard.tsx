import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(product)}
      className="flex flex-col bg-white rounded-xl p-2 md:p-3 shadow-sm border border-transparent transition-all text-left group relative hover:border-brand-400 hover:shadow-md active:scale-95"
    >
      <div className="w-full h-24 md:h-32 bg-slate-50 mb-2 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 p-1">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-slate-300 font-black text-2xl md:text-3xl uppercase select-none group-hover:text-brand-secondary font-mono transition-colors">
            {product.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="font-semibold text-slate-700 truncate text-xs md:text-sm mb-0.5">{product.name}</div>
      <div className="text-brand-primary font-bold text-sm md:text-lg">₹{product.sellingPrice.toFixed(2)}</div>
      <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between items-end">
        <span className="truncate">Stock: {product.stockQuantity}</span>
      </div>
    </button>
  );
};

export default React.memo(ProductCard);
