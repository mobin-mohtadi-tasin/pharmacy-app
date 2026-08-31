'use client';

export default function InvoiceReceipt({ invoice, items }) {
  if (!invoice) return null;

  const total = items.reduce((s, i) => s + i.quantity * i.selling_price, 0);

  const handlePrint = () => window.print();

  return (
    <div>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #receipt-print { display: block !important; position: fixed; inset: 0; background: white; color: black; font-size: 12px; padding: 16px; }
        }
      `}</style>

      <div id="receipt-print" className="font-mono text-xs text-gray-200 bg-[#131f17] rounded-xl p-5 border border-[#253d28] min-w-64">
        {/* Header */}
        <div className="text-center mb-4 border-b border-dashed border-gray-600 pb-4">
          <p className="text-base font-bold text-brand-400">PharmaCare</p>
          <p className="text-gray-400 text-[11px]">Pharmacy Billing System</p>
          <p className="text-gray-500 text-[10px] mt-1">Invoice: {invoice.invoice_no}</p>
          <p className="text-gray-500 text-[10px]">Date: {invoice.date} · {invoice.created_at?.slice(11, 16)}</p>
          <p className="text-gray-500 text-[10px]">Payment: {invoice.payment_method}</p>
        </div>

        {/* Items */}
        <table className="w-full text-[11px] mb-3">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left pb-1 text-gray-400">Item</th>
              <th className="text-right pb-1 text-gray-400">Qty</th>
              <th className="text-right pb-1 text-gray-400">Price</th>
              <th className="text-right pb-1 text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-[#1d3021]">
                <td className="py-1.5 pr-2">
                  <div className="text-gray-100">{item.medicine_name}</div>
                  {item.strength && <div className="text-gray-500 text-[10px]">{item.strength}</div>}
                </td>
                <td className="text-right text-gray-300">{item.quantity}</td>
                <td className="text-right text-gray-300">৳{Number(item.selling_price).toFixed(2)}</td>
                <td className="text-right text-gray-200">৳{(item.quantity * item.selling_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="border-t border-dashed border-gray-600 pt-3 flex justify-between items-center">
          <span className="font-bold text-gray-300">TOTAL</span>
          <span className="text-lg font-bold text-brand-400">৳{total.toFixed(2)}</span>
        </div>

        <div className="text-center mt-4 text-[10px] text-gray-600 border-t border-dashed border-gray-700 pt-3">
          Thank you for your purchase!
        </div>
      </div>

      <button onClick={handlePrint} className="btn-secondary btn-sm w-full mt-3">
        🖨️ Print Receipt
      </button>
    </div>
  );
}
