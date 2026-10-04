"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getFormSchemaAdminAction,
  updateFormFieldAction,
  reorderFormFieldAction,
  createFieldOptionAction,
  updateFieldOptionAction,
  deleteFieldOptionAction,
  reorderFieldOptionAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoryAction,
} from "@/app/actions/admin-form-schema";
import styles from "./ArtworkFormManager.module.css";

interface FieldOption {
  id: string;
  label: string;
  value: string;
  position: number;
  isSystem: boolean;
}

interface FormField {
  key: string;
  section: string;
  inputType: string;
  allowedInputTypes: string[];
  label: string;
  required: boolean;
  visible: boolean;
  position: number;
  systemLocked: boolean;
  optionsSource: string | null;
  options: FieldOption[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  artworksCount: number;
  childrenCount: number;
}

const SECTION_TITLES: Record<string, string> = {
  essentials: "Piece Essentials",
  craft: "Craft & Material Specifications",
  dimensions: "Physical Dimensions & Weight",
};

export function ArtworkFormManager() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // inline-edit state
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [expandedOptions, setExpandedOptions] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [optionDraft, setOptionDraft] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  const load = () => {
    startTransition(async () => {
      try {
        const data = await getFormSchemaAdminAction();
        setFields(data.fields);
        setCategories(data.categories);
        setError(null);
      } catch (e: any) {
        setError(e.message || "Failed to load form schema.");
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(load, []);

  const run = (fn: () => Promise<{ error?: string; success?: boolean; movedArtworks?: number }>, okMsg?: string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setError(res.error);
      } else {
        if (okMsg) setNotice(okMsg);
        if (typeof res.movedArtworks === "number" && res.movedArtworks > 0) {
          setNotice(`Deleted. ${res.movedArtworks} artwork${res.movedArtworks === 1 ? "" : "s"} moved.`);
        }
        load();
      }
    });
  };

  if (loading) return <div className={styles.container}><p>Loading form schema…</p></div>;

  const fieldsBySection: Record<string, FormField[]> = {};
  for (const f of fields) {
    (fieldsBySection[f.section] = fieldsBySection[f.section] || []).push(f);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Artwork Form Schema</h1>
          <p className={styles.subtitle}>
            Control what creators see when listing a piece: labels, required fields (*),
            visibility, order, and every dropdown option. Changes apply to the studio form immediately.
          </p>
        </div>
      </div>

      {error && <div className={styles.alertError}>{error}</div>}
      {notice && <div className={styles.alertOk}>{notice}</div>}

      {/* ── FIELDS ─────────────────────────────────────────── */}
      {Object.entries(fieldsBySection).map(([section, sectionFields]) => (
        <section key={section} className={styles.card}>
          <h2 className={styles.cardTitle}>{SECTION_TITLES[section] || section}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required *</th>
                  <th>Visible</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {[...sectionFields].sort((a, b) => a.position - b.position).map((f) => (
                  <tr key={f.key} className={f.visible ? "" : styles.hiddenRow}>
                    <td>
                      {editingLabel === f.key ? (
                        <span className={styles.inlineEdit}>
                          <input
                            value={labelDraft}
                            onChange={(e) => setLabelDraft(e.target.value)}
                            maxLength={80}
                            autoFocus
                          />
                          <button
                            className={styles.miniBtn}
                            disabled={isPending}
                            onClick={() => {
                              run(() => updateFormFieldAction({ key: f.key, label: labelDraft }));
                              setEditingLabel(null);
                            }}
                          >
                            Save
                          </button>
                          <button className={styles.miniBtnGhost} onClick={() => setEditingLabel(null)}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className={styles.labelCell}>
                          <strong>{f.label}</strong>
                          <span className={styles.keyHint}>{f.key}</span>
                          <button
                            className={styles.miniBtnGhost}
                            title="Edit label"
                            onClick={() => { setEditingLabel(f.key); setLabelDraft(f.label); }}
                          >
                            ✎
                          </button>
                          {f.systemLocked && <span className={styles.lockBadge} title="Core field — only the label is editable">core</span>}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{f.inputType}</span>
                      {f.allowedInputTypes.length > 0 && (
                        <button
                          className={styles.miniBtnGhost}
                          title="Switch between text and dropdown"
                          disabled={isPending}
                          onClick={() => {
                            const next = f.inputType === "select" ? "text" : "select";
                            run(() => updateFormFieldAction({ key: f.key, inputType: next as any }),
                              `“${f.label}” is now a ${next === "select" ? "dropdown" : "text field"}.`);
                          }}
                        >
                          ⇄
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        className={f.required ? styles.toggleOn : styles.toggleOff}
                        disabled={isPending || f.systemLocked}
                        title={f.systemLocked ? "Locked for core fields" : "Toggle required"}
                        onClick={() => run(() => updateFormFieldAction({ key: f.key, required: !f.required }))}
                      >
                        {f.required ? "★ Required" : "Optional"}
                      </button>
                    </td>
                    <td>
                      <button
                        className={f.visible ? styles.toggleOn : styles.toggleOff}
                        disabled={isPending || f.systemLocked}
                        title={f.systemLocked ? "Locked for core fields" : "Toggle visibility"}
                        onClick={() => run(() => updateFormFieldAction({ key: f.key, visible: !f.visible }))}
                      >
                        {f.visible ? "Visible" : "Hidden"}
                      </button>
                    </td>
                    <td>
                      <span className={styles.orderBtns}>
                        <button
                          className={styles.miniBtnGhost}
                          disabled={isPending || f.systemLocked}
                          onClick={() => run(() => reorderFormFieldAction({ key: f.key, direction: "up" }))}
                        >
                          ↑
                        </button>
                        <button
                          className={styles.miniBtnGhost}
                          disabled={isPending || f.systemLocked}
                          onClick={() => run(() => reorderFormFieldAction({ key: f.key, direction: "down" }))}
                        >
                          ↓
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* ── DROPDOWN OPTIONS ───────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Dropdown Options</h2>
        <p className={styles.cardHint}>
          Manage the choices inside each dropdown. Categories are managed separately below.
        </p>
        {fields.filter((f) => f.inputType === "select" && f.optionsSource !== "category").map((f) => (
          <div key={f.key} className={styles.optionGroup}>
            <button
              className={styles.optionGroupHead}
              onClick={() => setExpandedOptions(expandedOptions === f.key ? null : f.key)}
            >
              <strong>{f.label}</strong>
              <span className={styles.countBadge}>{f.options.length} options</span>
              <span>{expandedOptions === f.key ? "▾" : "▸"}</span>
            </button>
            {expandedOptions === f.key && (
              <div className={styles.optionList}>
                {f.options.map((o) => (
                  <div key={o.id} className={styles.optionRow}>
                    {editingOption === o.id ? (
                      <span className={styles.inlineEdit}>
                        <input value={optionDraft} onChange={(e) => setOptionDraft(e.target.value)} maxLength={80} autoFocus />
                        <button
                          className={styles.miniBtn}
                          disabled={isPending}
                          onClick={() => { run(() => updateFieldOptionAction({ id: o.id, label: optionDraft })); setEditingOption(null); }}
                        >
                          Save
                        </button>
                        <button className={styles.miniBtnGhost} onClick={() => setEditingOption(null)}>✕</button>
                      </span>
                    ) : (
                      <>
                        <span className={styles.optionLabel}>
                          {o.label}
                          {o.isSystem && <span className={styles.lockBadge}>system</span>}
                        </span>
                        <span className={styles.rowActions}>
                          <button className={styles.miniBtnGhost} title="Rename" onClick={() => { setEditingOption(o.id); setOptionDraft(o.label); }}>✎</button>
                          <button className={styles.miniBtnGhost} disabled={isPending} onClick={() => run(() => reorderFieldOptionAction({ id: o.id, direction: "up" }))}>↑</button>
                          <button className={styles.miniBtnGhost} disabled={isPending} onClick={() => run(() => reorderFieldOptionAction({ id: o.id, direction: "down" }))}>↓</button>
                          {!o.isSystem && (
                            <button
                              className={styles.miniBtnDanger}
                              disabled={isPending}
                              title="Delete option"
                              onClick={() => { if (confirm(`Delete option “${o.label}”?`)) run(() => deleteFieldOptionAction({ id: o.id })); }}
                            >
                              🗑
                            </button>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                ))}
                {f.optionsSource === "field-options" && (
                  <div className={styles.addRow}>
                    <input
                      placeholder={`New option for ${f.label}…`}
                      value={expandedOptions === f.key ? newOptionLabel : ""}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      maxLength={80}
                    />
                    <button
                      className={styles.miniBtn}
                      disabled={isPending || !newOptionLabel.trim()}
                      onClick={() => { run(() => createFieldOptionAction({ fieldKey: f.key, label: newOptionLabel.trim() })); setNewOptionLabel(""); }}
                    >
                      + Add
                    </button>
                  </div>
                )}
                {f.optionsSource === "enum-productType" && (
                  <p className={styles.cardHint}>Edition values are fixed (they map to the order system) — labels can be renamed and reordered.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── CATEGORIES ─────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Categories</h2>
        <p className={styles.cardHint}>
          Categories appear in the artwork form, explore filters, and the homepage. Deleting one moves its artworks to the category you choose.
        </p>
        <div className={styles.addRow}>
          <input
            placeholder="New category name… e.g. Mandala Art"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            maxLength={80}
          />
          <button
            className={styles.miniBtn}
            disabled={isPending || !newCategoryName.trim()}
            onClick={() => { run(() => createCategoryAction({ name: newCategoryName.trim() }), `Category “${newCategoryName.trim()}” created.`); setNewCategoryName(""); }}
          >
            + Add Category
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Artworks</th>
                <th>Active</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className={c.isActive ? "" : styles.hiddenRow}>
                  <td>
                    {editingCategory === c.id ? (
                      <span className={styles.inlineEdit}>
                        <input value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} maxLength={80} autoFocus />
                        <button
                          className={styles.miniBtn}
                          disabled={isPending}
                          onClick={() => { run(() => updateCategoryAction({ id: c.id, name: categoryDraft })); setEditingCategory(null); }}
                        >
                          Save
                        </button>
                        <button className={styles.miniBtnGhost} onClick={() => setEditingCategory(null)}>✕</button>
                      </span>
                    ) : (
                      <span className={styles.labelCell}>
                        <strong>{c.name}</strong>
                        <span className={styles.keyHint}>/{c.slug}</span>
                        <button className={styles.miniBtnGhost} title="Rename" onClick={() => { setEditingCategory(c.id); setCategoryDraft(c.name); }}>✎</button>
                      </span>
                    )}
                  </td>
                  <td><span className={styles.countBadge}>{c.artworksCount}</span></td>
                  <td>
                    <button
                      className={c.isActive ? styles.toggleOn : styles.toggleOff}
                      disabled={isPending}
                      onClick={() => run(() => updateCategoryAction({ id: c.id, isActive: !c.isActive }))}
                    >
                      {c.isActive ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td>
                    <span className={styles.orderBtns}>
                      <button className={styles.miniBtnGhost} disabled={isPending} onClick={() => run(() => reorderCategoryAction({ id: c.id, direction: "up" }))}>↑</button>
                      <button className={styles.miniBtnGhost} disabled={isPending} onClick={() => run(() => reorderCategoryAction({ id: c.id, direction: "down" }))}>↓</button>
                    </span>
                  </td>
                  <td>
                    <button
                      className={styles.miniBtnDanger}
                      disabled={isPending}
                      onClick={() => { setDeleteTarget(c); setReassignTo(categories.find((x) => x.id !== c.id && x.isActive)?.id || ""); }}
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DELETE-CATEGORY DIALOG ─────────────────────────── */}
      {deleteTarget && (
        <div className={styles.dialogOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3>Delete “{deleteTarget.name}”?</h3>
            <p>
              {deleteTarget.artworksCount > 0 ? (
                <>This will move <strong>{deleteTarget.artworksCount} artwork{deleteTarget.artworksCount === 1 ? "" : "s"}</strong> to the category you choose below.</>
              ) : (
                <>No artworks use this category. It will be removed permanently.</>
              )}
            </p>
            {deleteTarget.artworksCount > 0 && (
              <label className={styles.dialogLabel}>
                Move artworks to:
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="">— choose a category —</option>
                  {categories.filter((c) => c.id !== deleteTarget.id && c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className={styles.dialogActions}>
              <button className={styles.miniBtnGhost} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className={styles.miniBtnDanger}
                disabled={isPending || (deleteTarget.artworksCount > 0 && !reassignTo)}
                onClick={() => {
                  run(() => deleteCategoryAction(
                    deleteTarget.artworksCount > 0
                      ? { id: deleteTarget.id, reassignToId: reassignTo }
                      : { id: deleteTarget.id }
                  ));
                  setDeleteTarget(null);
                }}
              >
                {deleteTarget.artworksCount > 0 ? "Delete & Move" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
