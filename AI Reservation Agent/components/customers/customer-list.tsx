"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useActionState } from "react";
import {
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
  getCustomersAction,
} from "@/app/(dashboard)/dashboard/customers/actions";
import type { ActionResult } from "@/app/(dashboard)/dashboard/customers/actions";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  notes: string | null;
  _count: { reservations: number };
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const L = {
  en: {
    search: "Search by name or phone…",
    addCustomer: "Add Customer",
    name: "Name",
    phone: "Phone",
    email: "Email",
    preferredLanguage: "Preferred Language",
    notes: "Notes",
    reservations: "Reservations",
    actions: "Actions",
    view: "View",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    confirmDelete: "Confirm delete?",
    noCustomers: "No customers found",
    addNew: "Add new customer",
    customerDetails: "Customer Details",
    languageOptions: [
      { value: "en", label: "English" },
      { value: "ar", label: "Arabic" },
    ],
  },
  ar: {
    search: "بحث بالاسم أو رقم الهاتف…",
    addCustomer: "إضافة عميل",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    preferredLanguage: "اللغة المفضلة",
    notes: "ملاحظات",
    reservations: "الحجوزات",
    actions: "الإجراءات",
    view: "عرض",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ",
    cancel: "إلغاء",
    confirmDelete: "تأكيد الحذف؟",
    noCustomers: "لم يتم العثور على عملاء",
    addNew: "إضافة عميل جديد",
    customerDetails: "تفاصيل العميل",
    languageOptions: [
      { value: "en", label: "الإنجليزية" },
      { value: "ar", label: "العربية" },
    ],
  },
};

export function CustomerList({
  customers: initialCustomers,
  locale,
}: {
  customers: Customer[];
  locale: "en" | "ar";
}) {
  const lang = locale === "ar" ? L.ar : L.en;
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [createState, createFormAction, createPending] = useActionState(createCustomerAction, {
    ok: false,
  } as ActionResult);
  const [updateState, updateFormAction, updatePending] = useActionState(updateCustomerAction, {
    ok: false,
  } as ActionResult);
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteCustomerAction, {
    ok: false,
  } as ActionResult);

  const refreshCustomers = useCallback(async (searchTerm?: string) => {
    const formData = new FormData();
    formData.set("search", searchTerm ?? "");
    const result = await getCustomersAction({ ok: false }, formData);
    if (result.ok && result.data) {
      setCustomers(result.data as Customer[]);
    }
  }, []);

  useEffect(() => {
    if (createState.ok) {
      setTimeout(() => { refreshCustomers(search); setCreating(false); }, 0);
    }
  }, [createState, refreshCustomers, search]);

  useEffect(() => {
    if (updateState.ok) {
      setTimeout(() => { refreshCustomers(search); setEditingId(null); }, 0);
    }
  }, [updateState, refreshCustomers, search]);

  useEffect(() => {
    if (deleteState.ok) {
      setTimeout(() => { refreshCustomers(search); setConfirmDeleteId(null); }, 0);
    }
  }, [deleteState, refreshCustomers, search]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      refreshCustomers(value);
    }, 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={lang.search}
          className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + {lang.addCustomer}
          </button>
        )}
      </div>

      {creating && (
        <CustomerForm
          formAction={createFormAction}
          pending={createPending}
          state={createState}
          lang={lang}
          onCancel={() => setCreating(false)}
        />
      )}

      {editingId &&
        (() => {
          const customer = customers.find((c) => c.id === editingId);
          if (!customer) return null;
          return (
            <CustomerForm
              key={`edit-${editingId}`}
              customer={customer}
              formAction={updateFormAction}
              pending={updatePending}
              state={updateState}
              lang={lang}
              onCancel={() => setEditingId(null)}
            />
          );
        })()}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase text-stone-500">
              <th className="px-4 py-3">{lang.name}</th>
              <th className="px-4 py-3">{lang.phone}</th>
              <th className="px-4 py-3">{lang.email}</th>
              <th className="px-4 py-3">{lang.reservations}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                lang={lang}
                isViewing={viewingId === customer.id}
                isEditing={editingId === customer.id}
                isDeleting={confirmDeleteId === customer.id}
                deletePending={deletePending}
                onView={() => setViewingId(viewingId === customer.id ? null : customer.id)}
                onEdit={() => { setEditingId(customer.id); setCreating(false); }}
                onConfirmDelete={() => setConfirmDeleteId(customer.id)}
                onDelete={() => {
                  const formData = new FormData();
                  formData.set("customerId", customer.id);
                  deleteFormAction(formData);
                }}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            {lang.noCustomers}
          </div>
        )}
      </section>

      {(createState.error || updateState.error || deleteState.error) && (
        <p className="text-sm text-red-600">
          {(createState.error || updateState.error || deleteState.error) as string}
        </p>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  lang,
  isViewing,
  isEditing,
  isDeleting,
  deletePending,
  onView,
  onEdit,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: {
  customer: Customer;
  lang: typeof L.en;
  isViewing: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  deletePending: boolean;
  onView: () => void;
  onEdit: () => void;
  onConfirmDelete: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <>
      <tr className="border-b border-stone-100">
        <td className="px-4 py-3 font-medium text-stone-900">{customer.name}</td>
        <td className="px-4 py-3 text-stone-700">{customer.phone}</td>
        <td className="px-4 py-3 text-stone-600">{customer.email ?? "—"}</td>
        <td className="px-4 py-3 text-stone-600">{customer._count.reservations}</td>
        <td className="px-4 py-3">
          {!isEditing && (
            <div className="flex gap-1">
              <button
                onClick={onView}
                className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                {lang.view}
              </button>
              <button
                onClick={onEdit}
                className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                {lang.edit}
              </button>
              {isDeleting ? (
                <div className="flex gap-1">
                  <button
                    onClick={onDelete}
                    disabled={deletePending}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deletePending ? "…" : lang.confirmDelete}
                  </button>
                  <button
                    onClick={onCancelDelete}
                    className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {lang.cancel}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConfirmDelete}
                  className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  {lang.delete}
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {isViewing && (
        <tr>
          <td colSpan={5} className="border-b border-stone-100 bg-stone-50/50 px-4 py-4">
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold text-stone-900">{lang.customerDetails}</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="text-xs text-stone-500">{lang.preferredLanguage}</span>
                  <p className="font-medium text-stone-900">
                    {lang.languageOptions.find((l) => l.value === customer.preferredLanguage)?.label ??
                      customer.preferredLanguage}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-stone-500">{lang.reservations}</span>
                  <p className="font-medium text-stone-900">{customer._count.reservations}</p>
                </div>
              </div>
              {customer.notes && (
                <div>
                  <span className="text-xs text-stone-500">{lang.notes}</span>
                  <p className="mt-0.5 text-stone-700">{customer.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CustomerForm({
  customer,
  formAction,
  pending,
  state,
  lang,
  onCancel,
}: {
  customer?: Customer;
  formAction: (payload: FormData) => void;
  pending: boolean;
  state: ActionResult;
  lang: typeof L.en;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        formAction(new FormData(e.currentTarget));
      }}
      className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4"
    >
      {customer && <input type="hidden" name="customerId" value={customer.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.name}</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={customer?.name ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.phone}</label>
          <input
            name="phone"
            type="tel"
            required
            defaultValue={customer?.phone ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.email}</label>
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            {lang.preferredLanguage}
          </label>
          <select
            name="preferredLanguage"
            defaultValue={customer?.preferredLanguage ?? "en"}
            className={inputClass}
          >
            {lang.languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">{lang.notes}</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={customer?.notes ?? ""}
          className={inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "…" : lang.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          {lang.cancel}
        </button>
      </div>
    </form>
  );
}
