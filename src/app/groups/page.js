'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [newName, setNewName] = useState('');
  const [editModal, setEditModal] = useState({ open: false, group: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const { show, ToastEl } = useToast();

  const load = () => fetch('/api/groups').then(r => r.json()).then(r => setGroups(r.data || []));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    const res = await fetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return show(data.error, 'error');
    show('Group created', 'success');
    setNewName('');
    load();
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${editModal.group.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editModal.group.name }),
    });
    const data = await res.json();
    if (!res.ok) return show(data.error, 'error');
    show('Group updated', 'success');
    setEditModal({ open: false, group: null });
    load();
  };

  const handleDelete = async (group) => {
    const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return show(data.error, 'error');
    show('Group deleted', 'success');
    setDeleteConfirm(null);
    load();
  };

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <h1 className="page-title">Medicine Groups</h1>
      </div>

      {/* Add form */}
      <div className="card p-5 mb-6">
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            className="input flex-1" placeholder="New group name (e.g. Antibiotic)"
            value={newName} onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? '…' : '+ Add Group'}
          </button>
        </form>
      </div>

      {/* Groups list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {groups.map(g => (
          <div key={g.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-100">{g.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{g.medicine_count} medicine{g.medicine_count !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditModal({ open: true, group: { ...g } })}
                className="btn-secondary btn-sm"
              >Edit</button>
              <button
                onClick={() => setDeleteConfirm(g)}
                className="btn-danger btn-sm"
                disabled={g.medicine_count > 0}
                title={g.medicine_count > 0 ? 'Cannot delete — has medicines' : ''}
              >Del</button>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-4 text-center py-12 text-gray-500">
            No groups yet — add one above
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ open: false, group: null })} title="Edit Group" size="sm">
        {editModal.group && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="label">Group Name</label>
              <input required className="input" value={editModal.group.name} onChange={e => setEditModal(p => ({ ...p, group: { ...p.group, name: e.target.value } }))} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1 justify-center">Save</button>
              <button type="button" onClick={() => setEditModal({ open: false, group: null })} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Group" size="sm">
        <p className="text-gray-300 mb-4">Delete group <strong className="text-white">{deleteConfirm?.name}</strong>?</p>
        <div className="flex gap-3">
          <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 justify-center">Delete</button>
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
