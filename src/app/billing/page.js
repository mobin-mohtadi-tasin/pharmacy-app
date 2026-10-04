'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import MedicineSearch from '@/components/MedicineSearch';
import Modal from '@/components/Modal';
import InvoiceReceipt from '@/components/InvoiceReceipt';
import { useToast } from '@/components/Toast';
import AnimatedNumber from '@/components/AnimatedNumber';
import { burstConfetti } from '@/components/Confetti';

const money = (n) => n.toFixed(2);

const PAYMENT_METHODS = ['Cash', 'Card', 'bKash', 'Nagad', 'Bank Transfer'];

function CartRow({ item, index, onUpdate, onRemove }) {
  const total = (item.quantity * item.selling_price).toFixed(2);
  const profit = ((item.selling_price - item.cost_price_snapshot) * item.quantity).toFixed(2);
  const maxStock = item.current_stock + item.quantity; // original stock before adding to cart
  const overStock = item.quantity > maxStock;

  return (
    <tr className={`border-t border-[#1d3021] transition-colors duration-200 animate-fade-up ${overStock ? 'bg-red-900/10' : 'hover:bg-[#131f17] hover:shadow-[inset_3px_0_0_#22c55e]'}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-100">{item.name}</div>
        <div className="text-xs text-gray-500">{item.strength} {item.dosage_form && `· ${item.dosage_form}`}</div>
        <div className="text-xs text-gray-600">Stock: {item.current_stock}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate(index, 'quantity', Math.max(1, item.quantity - 1))}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#253d28] hover:bg-brand-700 hover:scale-110 active:scale-90 transition-transform text-white text-sm"
          >−</button>
          <input
            type="number" min="1" max={item.current_stock}
            value={item.quantity}
            onChange={e => onUpdate(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 input text-center py-1 px-1"
          />
          <button
            onClick={() => onUpdate(index, 'quantity', item.quantity + 1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#253d28] hover:bg-brand-700 hover:scale-110 active:scale-90 transition-transform text-white text-sm"
          >+</button>
        </div>
        {item.quantity > item.current_stock && (
          <p className="text-xs text-red-400 mt-1">⚠ Exceeds stock ({item.current_stock})</p>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-sm">৳</span>
          <input
            type="number" min="0" step="0.5"
            value={item.selling_price}
            onChange={e => onUpdate(index, 'selling_price', parseFloat(e.target.value) || 0)}
            className="w-24 input py-1 px-2 text-right"
          />
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <div key={total} className="text-gray-100 font-medium inline-block animate-pop">৳{total}</div>
        <div className="text-xs text-brand-500">+৳{profit}</div>
      </td>
      <td className="px-3 py-3">
        <button onClick={() => onRemove(index)} aria-label="Remove item" className="text-red-400 hover:text-red-300 hover:rotate-90 hover:scale-125 transition-transform duration-300 text-lg px-2">×</button>
      </td>
    </tr>
  );
}

export default function BillingPage() {
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ open: false, invoice: null, items: [] });
  const { show, ToastEl } = useToast();

  const handleCheckoutRef = useRef(null);

  // Keyboard shortcut: / to focus search, F2 to checkout
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('billing-search')?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleCheckoutRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(r => setGroups(r.data || []));
  }, []);

  const addToCart = useCallback((med) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.medicine_id === med.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, {
        medicine_id: med.id,
        name: med.name,
        strength: med.strength,
        dosage_form: med.dosage_form,
        current_stock: med.current_stock,
        selling_price: med.last_selling_price || med.mrp || med.avg_cost_price || 0,
        cost_price_snapshot: med.avg_cost_price,
        quantity: 1,
        unit_type: med.unit_type,
      }];
    });
    show(`Added: ${med.name}`, 'success');
  }, [show]);

  const updateItem = (index, field, value) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.selling_price, 0);
  const discountAmount = Number(((subtotal * (discountPercent || 0)) / 100).toFixed(2));
  const total = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
  const totalCost = cart.reduce((s, i) => s + (i.cost_price_snapshot * i.quantity), 0);
  const totalProfit = Math.max(0, Number((total - totalCost).toFixed(2)));
  const hasStockError = cart.some(i => i.quantity > i.current_stock);

  const handleCheckout = async () => {
    if (cart.length === 0) return show('Cart is empty', 'error');
    if (hasStockError) return show('Fix stock quantity errors before checkout', 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ medicine_id: i.medicine_id, quantity: i.quantity, selling_price: i.selling_price })),
          payment_method: paymentMethod,
          discount_percent: discountPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setReceiptModal({ open: true, invoice: data.data.invoice, items: data.data.items });
      setCart([]);
      setDiscountPercent(0);
      burstConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      show(`Invoice ${data.data.invoice.invoice_no} created!`, 'success');
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheckoutRef.current = handleCheckout;
  });

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing / Point of Sale</h1>
          <p className="text-xs text-gray-500 mt-1">Press <kbd className="px-1.5 py-0.5 bg-[#1d3021] rounded text-gray-300 font-mono">/</kbd> to search · <kbd className="px-1.5 py-0.5 bg-[#1d3021] rounded text-gray-300 font-mono">F2</kbd> to checkout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Search + Cart */}
        <div className="xl:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="card p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Search Medicine (local inventory only)</label>
                <div id="billing-search">
                  <MedicineSearch
                    onSelect={addToCart}
                    groupId={selectedGroup}
                    autoFocus
                    placeholder="Type medicine name… (/ to focus)"
                  />
                </div>
              </div>
              <div className="w-40">
                <label className="label">Filter by Group</label>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="input"
                >
                  <option value="">All Groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Cart table */}
          <div className="card">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 animate-fade-in">
                <span className="text-5xl mb-3 inline-block animate-float drop-shadow-[0_8px_16px_rgb(34_197_94/0.25)]">🛒</span>
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Search and add medicines above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#131f17] text-gray-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Medicine</th>
                      <th className="px-3 py-3 text-left w-36">Quantity</th>
                      <th className="px-3 py-3 text-left w-36">Selling Price / Unit</th>
                      <th className="px-3 py-3 text-right w-28">Total</th>
                      <th className="px-3 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, i) => (
                      <CartRow key={item.medicine_id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order summary + checkout */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-200">Order Summary</h2>

            {/* Payment method */}
            <div>
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${
                      paymentMethod === m
                        ? 'bg-brand-600/20 border-brand-500/60 text-brand-300 shadow-[0_0_16px_-4px_rgb(34_197_94/0.5)] animate-pop'
                        : 'bg-[#131f17] border-[#253d28] text-gray-400 hover:border-brand-700 hover:text-gray-200'
                    }`}
                  >
                    {m === 'Cash' ? '💵' : m === 'Card' ? '💳' : m === 'bKash' ? '📱' : m === 'Nagad' ? '📲' : '🏦'} {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Segment */}
            <div className="border-t border-[#1d3021] pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0 flex items-center gap-1.5 text-gray-300">
                  <span>🏷️</span> Overall Discount (%)
                </label>
                {discountPercent > 0 && (
                  <span className="text-xs text-yellow-400 font-medium">
                    -৳{discountAmount.toFixed(2)} off
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercent === 0 ? '' : discountPercent}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) setDiscountPercent(0);
                      else setDiscountPercent(Math.min(100, Math.max(0, val)));
                    }}
                    placeholder="0"
                    className="input pr-8 text-right font-semibold text-yellow-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">%</span>
                </div>
                {discountPercent > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountPercent(0)}
                    className="btn-secondary btn-sm px-2 text-xs text-gray-400 hover:text-red-400"
                    title="Reset discount to 0%"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick preset percentage chips */}
              <div className="flex gap-1.5 mt-2">
                {[0, 5, 7.5, 10, 15].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountPercent(pct)}
                    className={`flex-1 py-1 text-xs rounded-md border transition-all duration-200 ${
                      discountPercent === pct
                        ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300 font-bold shadow-sm'
                        : 'bg-[#131f17] border-[#253d28] text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    }`}
                  >
                    {pct === 0 ? '0%' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-[#1d3021] pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Items</span>
                <span><AnimatedNumber value={cart.reduce((s, i) => s + i.quantity, 0)} duration={400} /> units</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>৳<AnimatedNumber value={subtotal} format={money} duration={400} /></span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm text-yellow-400 animate-fade-in font-medium">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-৳<AnimatedNumber value={discountAmount} format={money} duration={400} /></span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-400">
                <span>Est. Profit</span>
                <span className="text-brand-500">৳<AnimatedNumber value={totalProfit} format={money} duration={500} /></span>
              </div>
              <div className="flex justify-between text-xl font-bold text-white border-t border-[#253d28] pt-3 mt-2">
                <span>Total</span>
                <span className="text-brand-400 inline-block drop-shadow-[0_0_12px_rgb(34_197_94/0.35)]">৳<AnimatedNumber value={total} format={money} duration={500} /></span>
              </div>
            </div>

            {hasStockError && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-xs text-red-400 animate-fade-up">
                ⚠ Some items exceed available stock. Reduce quantities to continue.
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading || hasStockError}
              className="btn-primary w-full btn-lg justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</span>
              ) : (
                `✓ Checkout — ৳${total.toFixed(2)}`
              )}
            </button>

            {cart.length > 0 && (
              <button
                onClick={() => { setCart([]); setDiscountPercent(0); }}
                className="btn-danger btn-sm w-full justify-center"
              >
                🗑 Clear Cart
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Modal isOpen={receiptModal.open} onClose={() => setReceiptModal(p => ({ ...p, open: false }))} title="Invoice Created!" size="sm">
        <InvoiceReceipt invoice={receiptModal.invoice} items={receiptModal.items} />
        <div className="mt-4 flex gap-2">
          <button onClick={() => setReceiptModal(p => ({ ...p, open: false }))} className="btn-secondary flex-1 justify-center">
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
