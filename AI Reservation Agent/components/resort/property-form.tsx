"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { updatePropertyAction } from "@/app/(dashboard)/dashboard/resort-info/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { FACILITY_ICONS } from "@/lib/facilities";
import type { ClientFacility, ClientProperty } from "@/components/resort/types";

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

type FacilityDraft = { label_en: string; label_ar: string; icon: string };

export function PropertyForm({
  property,
  locale,
  dict,
}: {
  property: ClientProperty;
  locale: "en" | "ar";
  dict: Dictionary;
}) {
  const [facilities, setFacilities] = useState<ClientFacility[]>(property.facilities);
  const [images, setImages] = useState(property.images);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [facilityDraft, setFacilityDraft] = useState<FacilityDraft>({
    label_en: "",
    label_ar: "",
    icon: "pool",
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const facilitiesInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(updatePropertyAction, { ok: false });

  useEffect(() => {
    if (facilitiesInputRef.current) {
      facilitiesInputRef.current.value = JSON.stringify(facilities);
    }
    if (imagesInputRef.current) {
      imagesInputRef.current.value = JSON.stringify(
        images.map((image) => ({ url: image.url, altText: image.altText ?? "" }))
      );
    }
  }, [facilities, images]);

  useEffect(() => {
    if (!state.ok) return;
    const showTimer = setTimeout(() => setSavedFlash(true), 0);
    const hideTimer = setTimeout(() => setSavedFlash(false), 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [state]);

  function addFacility() {
    const labelEn = facilityDraft.label_en.trim();
    const labelAr = facilityDraft.label_ar.trim();
    if (!labelEn && !labelAr) return;
    setFacilities((current) => [
      ...current,
      {
        key: `facility-${Date.now()}`,
        label_en: labelEn,
        label_ar: labelAr,
        icon: facilityDraft.icon,
      },
    ]);
    setFacilityDraft({ label_en: "", label_ar: "", icon: "pool" });
    setShowFacilityForm(false);
  }

  function removeFacility(key: string) {
    setFacilities((current) => current.filter((f) => f.key !== key));
  }

  function updatePhoto(index: number, patch: Partial<{ url: string; altText: string }>) {
    setImages((current) =>
      current.map((image, i) => (i === index ? { ...image, ...patch } : image))
    );
  }

  function removePhoto(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="propertyId" value={property.id} />
      <input type="hidden" name="facilitiesJson" ref={facilitiesInputRef} />
      <input type="hidden" name="imagesJson" ref={imagesInputRef} />

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-semibold text-stone-900">{dict.resort.propertyDetails}</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.name}
            </label>
            <input id="name" name="name" type="text" required defaultValue={property.name} className={inputClass} />
          </div>
          <div>
            <label htmlFor="addressText" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.address}
            </label>
            <input
              id="addressText"
              name="addressText"
              type="text"
              required
              defaultValue={property.addressText}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.description}
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              defaultValue={property.description}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-stone-400">{dict.resort.descriptionHint}</p>
          </div>

          <div>
            <label htmlFor="mapsUrl" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.mapsUrl}{" "}
              <span className="font-normal text-stone-400">({dict.resort.mapsUrlOptional})</span>
            </label>
            <input
              id="mapsUrl"
              name="mapsUrl"
              type="url"
              dir="ltr"
              defaultValue={property.mapsUrl ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="checkInTime" className="mb-1 block text-sm font-medium text-stone-700">
                {dict.resort.checkIn}
              </label>
              <input
                id="checkInTime"
                name="checkInTime"
                type="time"
                required
                defaultValue={property.checkInTime}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="checkOutTime" className="mb-1 block text-sm font-medium text-stone-700">
                {dict.resort.checkOut}
              </label>
              <input
                id="checkOutTime"
                name="checkOutTime"
                type="time"
                required
                defaultValue={property.checkOutTime}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="maxGuests" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.maxGuests}
            </label>
            <input
              id="maxGuests"
              name="maxGuests"
              type="number"
              required
              min={1}
              max={100}
              defaultValue={property.maxGuests}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="minStayNights" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.minStay}
            </label>
            <input
              id="minStayNights"
              name="minStayNights"
              type="number"
              required
              min={1}
              defaultValue={property.minStayNights}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="bedrooms" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.bedrooms}
            </label>
            <input id="bedrooms" name="bedrooms" type="number" required min={0} defaultValue={property.bedrooms} className={inputClass} />
          </div>
          <div>
            <label htmlFor="beds" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.beds}
            </label>
            <input id="beds" name="beds" type="number" required min={0} defaultValue={property.beds} className={inputClass} />
          </div>
          <div>
            <label htmlFor="bathrooms" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.bathrooms}
            </label>
            <input id="bathrooms" name="bathrooms" type="number" required min={0} defaultValue={property.bathrooms} className={inputClass} />
          </div>

          <div>
            <label htmlFor="depositAmount" className="mb-1 block text-sm font-medium text-stone-700">
              {dict.resort.deposit}
            </label>
            <input
              id="depositAmount"
              name="depositAmount"
              type="number"
              required
              min={0}
              step="0.5"
              defaultValue={property.depositAmount}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-stone-400">{dict.resort.depositHint}</p>
          </div>
          <div>
            <label
              htmlFor="cancellationRefundDays"
              className="mb-1 block text-sm font-medium text-stone-700"
            >
              {dict.resort.cancellationWindow}
            </label>
            <input
              id="cancellationRefundDays"
              name="cancellationRefundDays"
              type="number"
              required
              min={0}
              defaultValue={property.cancellationRefundDays}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-stone-400">{dict.resort.cancellationHint}</p>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                name="allowSameDayBooking"
                defaultChecked={property.allowSameDayBooking}
                className="h-4 w-4 rounded border-stone-300 accent-emerald-600"
              />
              {dict.resort.sameDay}
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-semibold text-stone-900">{dict.resort.facilities}</h2>
        <p className="mt-1 text-sm text-stone-500">{dict.resort.facilitiesHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {facilities.map((facility) => (
            <span
              key={facility.key}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 py-1.5 pe-2 ps-3 text-sm text-emerald-900"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                {facility.icon.slice(0, 1).toUpperCase()}
              </span>
              <span>
                {facility.label_en}
                {facility.label_en && facility.label_ar ? " / " : ""}
                {facility.label_ar}
              </span>
              <button
                type="button"
                onClick={() => removeFacility(facility.key)}
                className="text-emerald-700 hover:text-red-600"
                aria-label={dict.resort.remove}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {showFacilityForm ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-4">
            <input
              type="text"
              dir="ltr"
              placeholder={dict.resort.facilityLabelEn}
              value={facilityDraft.label_en}
              onChange={(e) => setFacilityDraft((d) => ({ ...d, label_en: e.target.value }))}
              className={inputClass}
            />
            <input
              type="text"
              dir="rtl"
              placeholder={dict.resort.facilityLabelAr}
              value={facilityDraft.label_ar}
              onChange={(e) => setFacilityDraft((d) => ({ ...d, label_ar: e.target.value }))}
              className={inputClass}
            />
            <select
              value={facilityDraft.icon}
              onChange={(e) => setFacilityDraft((d) => ({ ...d, icon: e.target.value }))}
              className={inputClass}
            >
              {FACILITY_ICONS.map((icon) => (
                <option key={icon.icon} value={icon.icon}>
                  {locale === "ar" ? icon.labelAr : icon.labelEn}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addFacility}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {dict.resort.add}
              </button>
              <button
                type="button"
                onClick={() => setShowFacilityForm(false)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                {dict.resort.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFacilityForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            + {dict.resort.addFacility}
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-semibold text-stone-900">{dict.resort.photos}</h2>
        <p className="mt-1 text-sm text-stone-500">{dict.resort.photosHint}</p>

        <div className="mt-4 space-y-3">
          {images.map((image, index) => (
            <div key={image.id} className="flex items-start gap-3">
              {image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt=""
                  className="mt-1 h-14 w-14 rounded-lg object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ) : null}
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  dir="ltr"
                  placeholder={dict.resort.photoUrl}
                  value={image.url}
                  onChange={(e) => updatePhoto(index, { url: e.target.value })}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder={dict.resort.photoAlt}
                  value={image.altText ?? ""}
                  onChange={(e) => updatePhoto(index, { altText: e.target.value })}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                {dict.resort.remove}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setImages((current) => [
              ...current,
              { id: `photo-${Date.now()}`, url: "", altText: "" },
            ])
          }
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + {dict.resort.addPhoto}
        </button>
      </section>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? dict.resort.saving : dict.resort.save}
        </button>
        {savedFlash ? (
          <span className="text-sm font-medium text-emerald-700">{dict.resort.saved}</span>
        ) : null}
        {!state.ok && state.error ? (
          <span className="text-sm text-red-600">{dict.resort.saveError}</span>
        ) : null}
      </div>
    </form>
  );
}
