'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import InvoiceReceipt from '@/components/InvoiceReceipt';

export default function InvoiceDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then(r => r.json()).then(r => { setData(r.data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Invoice not found</div>;

  const { invoice, items } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{invoice.invoice_no}</h1>
          <p className="text-sm text-gray-500 mt-1">{invoice.date} · {invoice.payment_method}</p>
        </div>
        <Link href="/invoices" className="btn-secondary">← Back</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Medicine</th><th>Qty</th><th>Selling Price</th><th>Cost</th><th>Revenue</th><th>Profit</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div className="font-medium text-gray-100">{item.medicine_name}</div>
                      <div className="text-xs text-gray-500">{item.strength}</div>
                    </td>
                    <td>{item.quantity}</td>
                    <td>৳{Number(item.selling_price).toFixed(2)}</td>
                    <td className="text-gray-400">৳{Number(item.cost_price_snapshot).toFixed(2)}</td>
                    <td className="text-brand-400">৳{(item.quantity * item.selling_price).toFixed(2)}</td>
                    <td className="text-brand-500">৳{((item.selling_price - item.cost_price_snapshot) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5 mt-4 space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>Subtotal</span>
              <span className="text-gray-200 font-medium">৳{Number(invoice.subtotal || invoice.total_amount).toFixed(2)}</span>
            </div>
            {invoice.discount_percent > 0 && (
              <div className="flex justify-between items-center text-sm text-yellow-400 font-medium">
                <span>Discount ({invoice.discount_percent}%)</span>
                <span>-৳{Number(invoice.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[#1d3021]">
              <span className="font-semibold text-gray-300">Total Paid</span>
              <span className="text-2xl font-bold text-brand-400">৳{Number(invoice.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div>
          <InvoiceReceipt invoice={invoice} items={items} />
        </div>
      </div>
    </div>
  );
}
