"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, Users, GripVertical } from "lucide-react";
import type { AdminTeamMember } from "@/lib/admin-store";

type MemberFormData = Omit<AdminTeamMember, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: MemberFormData = {
  name: "",
  role: "",
  bio: "",
  photoUrl: "",
  email: "",
  linkedIn: "",
  order: 0,
};

export default function TeamPage() {
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MemberFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/admin/team");
    const data = await res.json();
    setMembers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...EMPTY_FORM, order: members.length + 1 });
  };

  const startEdit = (member: AdminTeamMember) => {
    setEditing(member.id);
    setCreating(false);
    setForm({
      name: member.name,
      role: member.role,
      bio: member.bio,
      photoUrl: member.photoUrl ?? "",
      email: member.email ?? "",
      linkedIn: member.linkedIn ?? "",
      order: member.order,
    });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        await fetch("/api/admin/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch(`/api/admin/team/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      cancel();
      await fetchMembers();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team member?")) return;
    await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    await fetchMembers();
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Team</h1>
          <p className="mt-2 text-sm text-white/40">
            Manage team members displayed on the website.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Member
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "Add Team Member" : "Edit Team Member"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Role / Title
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Creative Director"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="A brief biography..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Photo URL
              </label>
              <input
                type="text"
                value={form.photoUrl}
                onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="/images/team/photo.jpg"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="name@abentertainment.com.au"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                LinkedIn URL
              </label>
              <input
                type="text"
                value={form.linkedIn}
                onChange={(e) => setForm((p) => ({ ...p, linkedIn: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Display Order
              </label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.role}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Add Member" : "Save Changes"}
            </button>
            <button
              onClick={cancel}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No team members yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 transition-all duration-200 hover:border-white/15"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-white/20" />
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c9a84c]/10 font-serif text-lg font-semibold text-[#c9a84c]">
                {member.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg text-white">{member.name}</h3>
                <p className="text-xs text-[#c9a84c]/70">{member.role}</p>
                <p className="mt-1 line-clamp-1 text-xs text-white/40">{member.bio}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(member)}
                  className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="rounded-lg p-2 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
