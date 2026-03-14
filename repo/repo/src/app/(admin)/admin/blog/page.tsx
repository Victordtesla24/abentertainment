"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, FileText, Eye, EyeOff } from "lucide-react";
import type { AdminBlogPost } from "@/lib/admin-store";

type PostFormData = Omit<AdminBlogPost, "id" | "slug" | "createdAt" | "updatedAt">;

const EMPTY_FORM: PostFormData = {
  title: "",
  status: "draft",
  excerpt: "",
  content: "",
  coverImage: "",
  author: "",
  tags: [],
  publishedAt: undefined,
};

export default function BlogPage() {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PostFormData>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPosts = useCallback(async () => {
    const res = await fetch("/api/admin/blog");
    const data = await res.json();
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
    setTagInput("");
  };

  const startEdit = (post: AdminBlogPost) => {
    setEditing(post.id);
    setCreating(false);
    setForm({
      title: post.title,
      status: post.status,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage ?? "",
      author: post.author,
      tags: post.tags,
      publishedAt: post.publishedAt,
    });
    setTagInput(post.tags.join(", "));
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
    setTagInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      ...form,
      tags,
      publishedAt:
        form.status === "published"
          ? form.publishedAt || new Date().toISOString()
          : form.publishedAt,
    };

    try {
      if (creating) {
        await fetch("/api/admin/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (editing) {
        await fetch(`/api/admin/blog/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      cancel();
      await fetchPosts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    await fetchPosts();
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Blog</h1>
          <p className="mt-2 text-sm text-white/40">
            Manage blog posts and editorial content.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New Post
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "New Blog Post" : "Edit Post"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                  placeholder="Post title..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                  Author
                </label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                  placeholder="Author name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as PostFormData["status"],
                    }))
                  }
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Excerpt
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Brief summary shown in listings..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Content (Markdown)
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={10}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Write your blog content here..."
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                  Cover Image
                </label>
                <input
                  type="text"
                  value={form.coverImage}
                  onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                  placeholder="/images/blog/cover.jpg"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                  placeholder="culture, music, events"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.title}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Create Post" : "Save Changes"}
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
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No blog posts yet. Create your first post above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 transition-all duration-200 hover:border-white/15"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8">
                {post.status === "published" ? (
                  <Eye className="h-4 w-4 text-green-400/70" />
                ) : (
                  <EyeOff className="h-4 w-4 text-white/30" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg text-white">{post.title}</h3>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-white/40">{post.author}</span>
                  <span className={`text-xs ${post.status === "published" ? "text-green-400/70" : "text-white/30"}`}>
                    {post.status}
                  </span>
                  {post.tags.length > 0 && (
                    <span className="text-xs text-[#c9a84c]/50">
                      {post.tags.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(post)}
                  className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(post.id)}
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
